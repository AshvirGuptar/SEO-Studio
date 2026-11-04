/**
 * Server-side page fetcher with SSRF protection.
 * The deployed app fetches user-supplied URLs, so we must never let it reach
 * private/internal network addresses (cloud metadata, localhost, LAN).
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class FetchPageError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface FetchedPage {
  url: string; // final URL after redirects
  status: number;
  html: string;
  redirects: string[];
  contentType: string;
  elapsedMs: number;
  headers: Record<string, string>;
}

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15_000;
const USER_AGENT = "SEOGEOStudioBot/0.2 (+internal SEO/GEO audit tool)";

export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === "::" || s === "::1") return true;
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(s);
  }
  return true;
}

export function normalizeInputUrl(input: string): URL {
  const s = input.trim();
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    throw new FetchPageError("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchPageError("Only http and https URLs are supported.");
  }
  if (url.username || url.password) throw new FetchPageError("URLs with credentials are not allowed.");
  return url;
}

async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new FetchPageError("Internal hosts are not allowed.");
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => {
    throw new FetchPageError(`Could not resolve ${host}.`);
  });
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) {
    throw new FetchPageError("That host resolves to a private network address.");
  }
}

export interface FetchOptions {
  /** Content types to accept (default: HTML/XML). */
  accept?: RegExp;
  /** Max body size in bytes (default 5 MB). */
  maxBytes?: number;
}

export async function fetchPage(input: string, opts: FetchOptions = {}): Promise<FetchedPage> {
  const accept = opts.accept ?? /html|xml/i;
  const maxBytes = opts.maxBytes ?? MAX_BYTES;
  let url = normalizeInputUrl(input);
  const redirects: string[] = [];
  const started = Date.now();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" },
      });
    } catch (e) {
      const msg = e instanceof Error && e.name === "TimeoutError" ? "The page took too long to respond." : "Couldn't connect to that site.";
      throw new FetchPageError(msg, 502);
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      redirects.push(`${res.status} ${url.href}`);
      url = new URL(res.headers.get("location")!, url);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new FetchPageError("Redirected to an unsupported protocol.");
      continue;
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType && !accept.test(contentType)) {
      await res.body?.cancel();
      throw new FetchPageError(`Expected an HTML page but got "${contentType}".`, 415);
    }
    const html = await readCapped(res, maxBytes);
    return {
      url: url.href,
      status: res.status,
      html,
      redirects,
      contentType,
      elapsedMs: Date.now() - started,
      headers: Object.fromEntries(res.headers.entries()),
    };
  }
  throw new FetchPageError("Too many redirects.", 508);
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new FetchPageError(`Response is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`, 413);
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
