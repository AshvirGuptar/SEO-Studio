/** Full on-page SEO audit: combines extraction + all relevant checks. */
import type { Check, ScoreSummary } from "./types";
import { extractFacts, type PageFacts } from "./extract";
import { analyzeBodyCopy, analyzeMetaDescription, analyzeTitle } from "./copy";
import { analyzeUrl } from "./slug";
import { containsPhrase, topTerms } from "./text";
import { summarize } from "./score";

export interface PageReport {
  url?: string;
  keyword?: string;
  summary: ScoreSummary;
  checks: Check[];
  facts: Omit<PageFacts, "bodyText"> & { wordCount: number; bodyPreview: string };
  topTerms: { term: string; count: number }[];
  analyzedAt: string;
}

export function analyzePage(html: string, opts: { url?: string; keyword?: string } = {}): PageReport {
  const keyword = opts.keyword?.trim() || undefined;
  const f = extractFacts(html, opts.url);
  const checks: Check[] = [
    ...analyzeTitle(f.title, keyword),
    ...analyzeMetaDescription(f.metaDescription, keyword),
    ...headingChecks(f, keyword),
    ...analyzeBodyCopy(f.bodyText, keyword, { minWords: 300 }),
    ...imageChecks(f, keyword),
    ...linkChecks(f),
    ...technicalChecks(f),
    ...socialChecks(f),
    ...(f.url ? analyzeUrl(f.url, keyword) : []),
  ];

  if (f.titleCount > 1) {
    checks.push({ id: "title-multiple", category: "meta", label: "Single title tag", severity: "warn", weight: 3,
      message: `Found ${f.titleCount} <title> tags.`, fix: "Keep exactly one <title> in <head>." });
  }
  if (f.metaDescriptionCount > 1) {
    checks.push({ id: "meta-multiple", category: "meta", label: "Single meta description", severity: "warn", weight: 3,
      message: `Found ${f.metaDescriptionCount} meta descriptions.`, fix: "Keep exactly one." });
  }

  const { bodyText, ...rest } = f;
  return {
    url: f.url,
    keyword,
    summary: summarize(checks),
    checks,
    facts: { ...rest, wordCount: bodyText.split(/\s+/).filter(Boolean).length, bodyPreview: bodyText.slice(0, 600) },
    topTerms: topTerms(bodyText, 15),
    analyzedAt: new Date().toISOString(),
  };
}

function headingChecks(f: PageFacts, keyword?: string): Check[] {
  const checks: Check[] = [];
  const h1s = f.headings.filter((h) => h.level === 1);
  checks.push({
    id: "h1-count", category: "headings", label: "Single H1", weight: 7, value: `${h1s.length} found`,
    ...(h1s.length === 1
      ? { severity: "pass", message: "Page has exactly one H1." }
      : h1s.length === 0
        ? { severity: "fail", message: "No H1 heading.", fix: "Add one H1 that describes the page's main topic." }
        : { severity: "warn", message: "Multiple H1 headings.", fix: "Use one H1; demote others to H2." }),
  });

  if (keyword && h1s.length > 0) {
    checks.push({
      id: "h1-keyword", category: "keywords", label: "Keyword in H1", weight: 6,
      ...(h1s.some((h) => containsPhrase(h.text, keyword))
        ? { severity: "pass", message: "H1 contains the keyword." }
        : { severity: "warn", message: "H1 doesn't contain the keyword.", fix: "Include the target keyword in the H1." }),
    });
  }

  let skipped = false;
  for (let i = 1; i < f.headings.length; i++) {
    if (f.headings[i].level - f.headings[i - 1].level > 1) { skipped = true; break; }
  }
  checks.push({
    id: "heading-order", category: "headings", label: "Heading hierarchy", weight: 3,
    ...(skipped
      ? { severity: "warn", message: "Heading levels are skipped (e.g. H2 → H4).", fix: "Nest headings in order for accessibility and structure." }
      : { severity: "pass", message: "Headings are in logical order." }),
  });

  const subs = f.headings.filter((h) => h.level === 2).length;
  checks.push({
    id: "subheadings", category: "headings", label: "Subheadings", weight: 3, value: `${subs} H2s`,
    ...(subs > 0
      ? { severity: "pass", message: "Content is broken into sections." }
      : { severity: "warn", message: "No H2 subheadings.", fix: "Break content into scannable sections with H2s." }),
  });

  if (f.headings.some((h) => h.text.length === 0)) {
    checks.push({ id: "heading-empty", category: "headings", label: "Empty headings", severity: "warn", weight: 2,
      message: "Some headings are empty.", fix: "Remove empty heading tags or give them text." });
  }
  return checks;
}

function imageChecks(f: PageFacts, keyword?: string): Check[] {
  if (f.images.length === 0) {
    return [{ id: "images", category: "images", label: "Images", severity: "info", weight: 1,
      message: "No images found. Visuals help engagement and image search traffic." }];
  }
  const missing = f.images.filter((i) => i.alt === null).length;
  const checks: Check[] = [{
    id: "img-alt", category: "images", label: "Image alt text", weight: 5,
    value: `${f.images.length - missing}/${f.images.length} have alt`,
    ...(missing === 0
      ? { severity: "pass", message: "All images have alt attributes." }
      : { severity: missing / f.images.length > 0.3 ? "fail" : "warn",
          message: `${missing} image(s) missing alt text.`, fix: "Describe each meaningful image in its alt attribute (use alt=\"\" for decorative ones)." }),
  }];
  if (keyword) {
    const any = f.images.some((i) => i.alt && containsPhrase(i.alt, keyword));
    checks.push({
      id: "img-alt-keyword", category: "keywords", label: "Keyword in an image alt", weight: 2,
      ...(any
        ? { severity: "pass", message: "At least one image alt references the keyword." }
        : { severity: "info", message: "No image alt text mentions the keyword." }),
    });
  }
  return checks;
}

function linkChecks(f: PageFacts): Check[] {
  const internal = f.links.filter((l) => l.internal);
  const external = f.links.filter((l) => !l.internal);
  const generic = f.links.filter((l) => /^(click here|here|read more|more|learn more|link)$/i.test(l.text)).length;
  const empty = f.links.filter((l) => !l.text).length;
  const checks: Check[] = [
    {
      id: "internal-links", category: "links", label: "Internal links", weight: 4, value: `${internal.length}`,
      ...(internal.length >= 3
        ? { severity: "pass", message: "Page links to other pages on the site." }
        : { severity: "warn", message: "Few internal links.", fix: "Link to related pages to spread authority and help crawling." }),
    },
    {
      id: "external-links", category: "links", label: "External links", weight: 1, value: `${external.length}`,
      severity: "info",
      message: external.length > 0 ? `${external.filter((l) => l.nofollow).length} of ${external.length} are nofollow.` : "No outbound links.",
    },
  ];
  if (generic > 0 || empty > 0) {
    checks.push({
      id: "anchor-text", category: "links", label: "Descriptive anchor text", severity: "warn", weight: 3,
      value: `${generic} generic · ${empty} empty`,
      message: "Some links use generic or empty anchor text.", fix: "Use descriptive anchors that say where the link goes.",
    });
  }
  return checks;
}

function technicalChecks(f: PageFacts): Check[] {
  const checks: Check[] = [];
  const noindex = /noindex/i.test(f.robots ?? "");
  checks.push({
    id: "indexable", category: "technical", label: "Indexable", weight: 10,
    ...(noindex
      ? { severity: "fail", message: `Robots meta is "${f.robots}" — this page is blocked from search.`, fix: "Remove noindex if this page should rank." }
      : { severity: "pass", message: "No noindex directive found." }),
  });
  checks.push({
    id: "canonical", category: "technical", label: "Canonical URL", weight: 5, value: f.canonical,
    ...(f.canonical
      ? { severity: "pass", message: "Canonical tag is set." }
      : { severity: "warn", message: "No canonical tag.", fix: "Add <link rel=\"canonical\"> to prevent duplicate-content issues." }),
  });
  checks.push({
    id: "viewport", category: "technical", label: "Mobile viewport", weight: 6,
    ...(f.viewport
      ? { severity: "pass", message: "Viewport meta tag present." }
      : { severity: "fail", message: "No viewport meta tag; page may not be mobile-friendly.", fix: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">." }),
  });
  checks.push({
    id: "lang", category: "technical", label: "Language attribute", weight: 2, value: f.lang,
    ...(f.lang
      ? { severity: "pass", message: "<html lang> is set." }
      : { severity: "warn", message: "Missing <html lang>.", fix: "Set the page language, e.g. <html lang=\"en\">." }),
  });
  checks.push({
    id: "structured-data", category: "technical", label: "Structured data", weight: 4,
    value: f.jsonLdTypes.join(", ") || undefined,
    ...(f.jsonLdTypes.length > 0
      ? { severity: "pass", message: `JSON-LD found: ${f.jsonLdTypes.join(", ")}.` }
      : { severity: "warn", message: "No JSON-LD structured data.", fix: "Add schema.org markup (Product, Article, Organization, BreadcrumbList…) for rich results." }),
  });
  checks.push({
    id: "favicon", category: "technical", label: "Favicon", weight: 1,
    ...(f.favicon ? { severity: "pass", message: "Favicon declared." } : { severity: "info", message: "No favicon <link> found." }),
  });
  const kb = Math.round(f.htmlBytes / 1024);
  checks.push({
    id: "html-size", category: "technical", label: "HTML size", weight: 2, value: `${kb} KB`,
    ...(kb <= 500
      ? { severity: "pass", message: "HTML document size is reasonable." }
      : { severity: "warn", message: "Large HTML document.", fix: "Reduce inline scripts/styles and DOM size." }),
  });
  return checks;
}

function socialChecks(f: PageFacts): Check[] {
  const need = ["title", "description", "image"];
  const missingOg = need.filter((k) => !f.openGraph[k]);
  return [
    {
      id: "open-graph", category: "social", label: "Open Graph tags", weight: 3,
      ...(missingOg.length === 0
        ? { severity: "pass", message: "og:title, og:description and og:image are set." }
        : { severity: "warn", message: `Missing og:${missingOg.join(", og:")}.`, fix: "Add Open Graph tags so shares look good on social and chat apps." }),
    },
    {
      id: "twitter-card", category: "social", label: "Twitter/X card", weight: 1,
      ...(f.twitter.card
        ? { severity: "pass", message: `twitter:card = ${f.twitter.card}.` }
        : { severity: "info", message: "No twitter:card tag (falls back to Open Graph)." }),
    },
  ];
}
