/** URL / slug analysis and generation. */
import type { Check } from "./types";
import { STOP_WORDS, containsPhrase, words } from "./text";

export const SLUG_MAX_CHARS = 60;
export const SLUG_MAX_WORDS = 6;

/** Turn arbitrary text into a clean, SEO-friendly slug. */
export function slugify(text: string, opts: { removeStopWords?: boolean; maxWords?: number } = {}): string {
  const { removeStopWords = true, maxWords = SLUG_MAX_WORDS } = opts;
  const ascii = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .toLowerCase();
  let parts = ascii.split(/[^a-z0-9]+/).filter(Boolean);
  if (removeStopWords) {
    const kept = parts.filter((p) => !STOP_WORDS.has(p));
    if (kept.length > 0) parts = kept;
  }
  // de-duplicate while preserving order
  parts = parts.filter((p, i) => parts.indexOf(p) === i);
  return parts.slice(0, maxWords).join("-");
}

/** Extract the path part from a full URL or a bare path/slug. */
export function pathOf(input: string): string {
  const s = input.trim();
  try {
    return new URL(s).pathname;
  } catch {
    return s.startsWith("/") ? s : `/${s}`;
  }
}

export function analyzeUrl(input: string, keyword?: string): Check[] {
  const checks: Check[] = [];
  let parsed: URL | null = null;
  try { parsed = new URL(input.trim()); } catch { /* bare path */ }
  const path = pathOf(input);
  const segments = path.split("/").filter(Boolean);
  const last = decodeURIComponent(segments.at(-1) ?? "");

  if (parsed) {
    checks.push({
      id: "url-https", category: "url", label: "HTTPS", weight: 6,
      ...(parsed.protocol === "https:"
        ? { severity: "pass", message: "URL uses HTTPS." }
        : { severity: "fail", message: "URL is not HTTPS.", fix: "Serve the page over HTTPS and 301-redirect HTTP." }),
    });
    const params = [...parsed.searchParams.keys()];
    if (params.length > 0) {
      checks.push({
        id: "url-params", category: "url", label: "Query parameters", weight: 3, value: params.join(", "),
        severity: params.length > 2 ? "warn" : "info",
        message: "URL has query parameters, which can create duplicate-content variants.",
        fix: "Prefer clean paths and set a canonical URL for parameterized variants.",
      });
    }
  }

  const full = parsed ? parsed.href : path;
  checks.push({
    id: "url-length", category: "url", label: "URL length", weight: 4, value: `${full.length} chars`,
    ...(full.length <= 75
      ? { severity: "pass", message: "URL is concise." }
      : full.length <= 115
        ? { severity: "warn", message: "URL is getting long.", fix: "Shorter URLs are easier to share and read in results." }
        : { severity: "fail", message: "URL is very long.", fix: "Shorten the path; remove filler words and IDs." }),
  });

  checks.push({
    id: "url-depth", category: "url", label: "Folder depth", weight: 2, value: `${segments.length} levels`,
    ...(segments.length <= 3
      ? { severity: "pass", message: "Shallow, easy-to-crawl structure." }
      : { severity: "warn", message: "Deeply nested URL.", fix: "Keep important pages within 3 folder levels." }),
  });

  if (/[A-Z]/.test(path)) {
    checks.push({
      id: "url-case", category: "url", label: "Lowercase", severity: "warn", weight: 4,
      message: "Path contains uppercase letters; URLs are case-sensitive and this can cause duplicates.",
      fix: "Use lowercase only and redirect mixed-case variants.",
    });
  } else {
    checks.push({ id: "url-case", category: "url", label: "Lowercase", severity: "pass", weight: 4, message: "Path is lowercase." });
  }

  if (/_/.test(path)) {
    checks.push({
      id: "url-underscores", category: "url", label: "Word separators", severity: "warn", weight: 4,
      message: "Underscores are not treated as word separators by Google.", fix: "Use hyphens (-) between words.",
    });
  }

  if (/%[0-9a-f]{2}|[^a-zA-Z0-9\-/._~]/i.test(path)) {
    checks.push({
      id: "url-special", category: "url", label: "Special characters", severity: "warn", weight: 3,
      message: "Path contains spaces, encoded or special characters.", fix: "Stick to a–z, 0–9 and hyphens.",
    });
  }

  if (/\.(php|aspx?|html?|jsp)$/i.test(last)) {
    checks.push({
      id: "url-extension", category: "url", label: "File extension", severity: "info", weight: 1,
      message: "File extensions in URLs are unnecessary and tie URLs to technology.",
    });
  }

  if (/\b\d{5,}\b/.test(path) || /[a-f0-9]{16,}/i.test(path)) {
    checks.push({
      id: "url-ids", category: "url", label: "Opaque IDs", severity: "warn", weight: 3,
      message: "Path contains long numeric/hash IDs that carry no meaning.", fix: "Use descriptive words instead of IDs where possible.",
    });
  }

  const slugWords = last.split(/[-_]+/).filter(Boolean);
  const stop = slugWords.filter((w) => STOP_WORDS.has(w.toLowerCase()));
  if (stop.length > 0) {
    checks.push({
      id: "url-stopwords", category: "url", label: "Stop words", severity: "info", weight: 1, value: stop.join(", "),
      message: "Slug contains stop words that add length without meaning.",
    });
  }
  if (slugWords.length > SLUG_MAX_WORDS) {
    checks.push({
      id: "url-slug-words", category: "url", label: "Slug word count", severity: "warn", weight: 3, value: `${slugWords.length} words`,
      message: "Slug is wordy.", fix: `Keep slugs to about ${SLUG_MAX_WORDS} meaningful words.`,
    });
  }

  if (keyword) {
    const pathText = segments.join(" ").replace(/[-_]/g, " ");
    checks.push({
      id: "url-keyword", category: "keywords", label: "Keyword in URL", weight: 7,
      ...(containsPhrase(pathText, keyword)
        ? { severity: "pass", message: "URL contains the target keyword." }
        : { severity: "warn", message: `URL doesn't include "${keyword}".`, fix: `Consider a slug like "${slugify(keyword)}".` }),
    });
  }

  return checks;
}

/** Suggest an improved URL keeping the host and parent folders. */
export function suggestUrl(input: string, opts: { keyword?: string; title?: string } = {}): string {
  let origin = "";
  try { origin = new URL(input.trim()).origin; } catch { /* path only */ }
  const segments = pathOf(input).split("/").filter(Boolean);
  const last = decodeURIComponent(segments.pop() ?? "").replace(/\.(php|aspx?|html?|jsp)$/i, "");
  const parents = segments.map((s) => slugify(decodeURIComponent(s), { removeStopWords: false, maxWords: 4 })).filter(Boolean);

  // Drop opaque numeric IDs (e.g. "_12345") from the slug source; they carry no meaning.
  const source = opts.title || last.replace(/[-_]+/g, " ").replace(/\b\d{4,}\b/g, " ");
  let slug = slugify(source);
  if (opts.keyword && !containsPhrase(slug.replace(/-/g, " "), opts.keyword)) {
    slug = slugify(`${opts.keyword} ${source}`);
  }
  const kw = opts.keyword ? words(opts.keyword).length : 0;
  if (!slug) slug = slugify(opts.keyword ?? "page", { maxWords: Math.max(kw, 1) });
  return `${origin}/${[...parents, slug].join("/")}`;
}
