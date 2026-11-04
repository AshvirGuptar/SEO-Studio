import { z } from "zod";
import { analyzePage } from "@/lib/seo/analyze-page";
import type { Check } from "@/lib/seo/types";
import { summarize } from "@/lib/seo/score";
import { FetchPageError, fetchPage } from "@/lib/net/fetch-page";

// Order matters: the HTML variant must be tried first, otherwise a request with
// both `html` and `url` would match the URL-only shape and the HTML would be dropped.
const Body = z.union([
  z.object({ html: z.string().min(1).max(5_000_000), url: z.string().max(2048).optional(), keyword: z.string().max(100).optional() }),
  z.object({ url: z.string().min(1).max(2048), keyword: z.string().max(100).optional() }),
]);

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Provide a URL or HTML to analyze." }, { status: 400 });
  }
  const input = parsed.data;

  try {
    if ("html" in input) {
      return Response.json(analyzePage(input.html, { url: input.url || undefined, keyword: input.keyword }));
    }
    const page = await fetchPage(input.url);
    const report = analyzePage(page.html, { url: page.url, keyword: input.keyword });

    // HTTP-level checks only available when we fetched the page ourselves.
    const extra: Check[] = [
      {
        id: "http-status", category: "technical", label: "HTTP status", weight: 10, value: String(page.status),
        ...(page.status === 200
          ? { severity: "pass", message: "Page returns 200 OK." }
          : { severity: "fail", message: `Page returned HTTP ${page.status}.`, fix: "Indexable pages must return 200." }),
      },
      {
        id: "redirects", category: "technical", label: "Redirect chain", weight: 3, value: `${page.redirects.length} hops`,
        ...(page.redirects.length <= 1
          ? { severity: "pass", message: page.redirects.length ? "Single redirect." : "No redirects." }
          : { severity: "warn", message: "Multiple redirects before reaching the page.", fix: "Link directly to the final URL; collapse redirect chains." }),
      },
      {
        id: "response-time", category: "technical", label: "Response time", weight: 4, value: `${page.elapsedMs} ms`,
        ...(page.elapsedMs < 800
          ? { severity: "pass", message: "Server responded quickly." }
          : page.elapsedMs < 2000
            ? { severity: "warn", message: "Server response is a bit slow.", fix: "Improve TTFB with caching/CDN." }
            : { severity: "fail", message: "Server response is slow.", fix: "Investigate hosting, caching and backend performance." }),
      },
    ];
    if (/noindex/i.test(page.headers["x-robots-tag"] ?? "")) {
      extra.push({ id: "x-robots", category: "technical", label: "X-Robots-Tag header", severity: "fail", weight: 10,
        message: `X-Robots-Tag: ${page.headers["x-robots-tag"]} blocks indexing.`, fix: "Remove noindex from the response header." });
    }
    const checks = [...extra, ...report.checks];
    return Response.json({ ...report, checks, summary: summarize(checks), fetch: { status: page.status, redirects: page.redirects, elapsedMs: page.elapsedMs } });
  } catch (e) {
    if (e instanceof FetchPageError) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ error: "Something went wrong analyzing that page." }, { status: 500 });
  }
}
