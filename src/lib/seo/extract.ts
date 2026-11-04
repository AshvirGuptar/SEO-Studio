/** Parse raw HTML into the structured facts the analyzers need. */
import * as cheerio from "cheerio";

export interface PageFacts {
  url?: string;
  lang?: string;
  charset?: string;
  title: string;
  titleCount: number;
  metaDescription: string;
  metaDescriptionCount: number;
  canonical?: string;
  robots?: string;
  viewport?: string;
  favicon: boolean;
  headings: { level: number; text: string }[];
  images: { src: string; alt: string | null }[];
  links: { href: string; text: string; internal: boolean; nofollow: boolean }[];
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
  jsonLdTypes: string[];
  hreflang: string[];
  bodyText: string;
  htmlBytes: number;
  /** Signals used by the GEO (AI search) analyzer. */
  geo: GeoFacts;
}

export interface GeoFacts {
  author?: string; // meta author, schema author or visible byline
  datePublished?: string;
  dateModified?: string;
  sameAsCount: number; // Organization/Person sameAs links (entity disambiguation)
  faqQuestions: number; // FAQPage questions in JSON-LD
  /** Each heading with the first paragraph that follows it (answer-first structure). */
  sections: { level: number; heading: string; firstParagraphWords: number; words: number }[];
  firstParagraphWords: number;
  paragraphWordCounts: number[];
  lists: number; // ul/ol with 3+ items
  tables: number;
  scriptCount: number;
  appShellOnly: boolean; // empty SPA root, i.e. content probably needs JavaScript
}

export function extractFacts(html: string, pageUrl?: string): PageFacts {
  const $ = cheerio.load(html);
  let base: URL | undefined;
  try { base = pageUrl ? new URL(pageUrl) : undefined; } catch { base = undefined; }

  const meta = (name: string): string | undefined =>
    $(`meta[name="${name}" i]`).first().attr("content")?.trim();

  const openGraph: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const p = $(el).attr("property");
    const c = $(el).attr("content");
    if (p && c) openGraph[p.slice(3)] = c.trim();
  });
  const twitter: Record<string, string> = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const p = $(el).attr("name");
    const c = $(el).attr("content");
    if (p && c) twitter[p.slice(8)] = c.trim();
  });

  const jsonLdTypes: string[] = [];
  const ld: LdSignals = { sameAs: 0, faq: 0 };
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).text());
      collectTypes(json, jsonLdTypes);
      collectLdSignals(json, ld);
    } catch { /* ignore invalid JSON-LD; reported as missing */ }
  });

  const headings: PageFacts["headings"] = [];
  $("h1,h2,h3,h4,h5,h6").each((_, el) => {
    headings.push({ level: Number(el.tagName[1]), text: $(el).text().replace(/\s+/g, " ").trim() });
  });

  const images: PageFacts["images"] = [];
  $("img").each((_, el) => {
    const alt = $(el).attr("alt");
    images.push({ src: $(el).attr("src") ?? $(el).attr("data-src") ?? "", alt: alt === undefined ? null : alt.trim() });
  });

  const links: PageFacts["links"] = [];
  $("a[href]").each((_, el) => {
    const raw = ($(el).attr("href") ?? "").trim();
    if (!raw || raw.startsWith("#") || /^(mailto|tel|javascript):/i.test(raw)) return;
    let internal = !/^https?:\/\//i.test(raw);
    let href = raw;
    if (base) {
      try {
        const abs = new URL(raw, base);
        href = abs.href;
        internal = abs.hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, "");
      } catch { /* keep raw */ }
    }
    links.push({
      href,
      text: $(el).text().replace(/\s+/g, " ").trim() || ($(el).find("img").attr("alt") ?? ""),
      internal,
      nofollow: /nofollow/i.test($(el).attr("rel") ?? ""),
    });
  });

  const hreflang = $('link[rel="alternate"][hreflang]').map((_, el) => $(el).attr("hreflang") ?? "").get().filter(Boolean);
  const titleCount = $("head title").length || $("title").length;
  const title = $("title").first().text().replace(/\s+/g, " ").trim();
  const metaDescriptionCount = $('meta[name="description" i]').length;

  const geo = extractGeo($, ld, meta);

  // Body text: drop non-content elements before reading text.
  const body = $("body").clone();
  body.find("script,style,noscript,template,svg,iframe").remove();
  body.find("p,div,li,h1,h2,h3,h4,h5,h6,br,tr,section,article").after("\n");
  const bodyText = body.text().replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();

  return {
    url: base?.href,
    lang: $("html").attr("lang")?.trim() || undefined,
    charset: $("meta[charset]").attr("charset") ?? undefined,
    title,
    titleCount,
    metaDescription: meta("description") ?? "",
    metaDescriptionCount,
    canonical: $('link[rel="canonical"]').attr("href")?.trim(),
    robots: meta("robots"),
    viewport: meta("viewport"),
    favicon: $('link[rel~="icon"]').length > 0,
    headings,
    images,
    links,
    openGraph,
    twitter,
    jsonLdTypes: [...new Set(jsonLdTypes)],
    hreflang,
    bodyText,
    htmlBytes: Buffer.byteLength(html, "utf8"),
    geo,
  };
}

interface LdSignals { author?: string; datePublished?: string; dateModified?: string; sameAs: number; faq: number }

function collectLdSignals(node: unknown, out: LdSignals): void {
  if (Array.isArray(node)) return node.forEach((n) => collectLdSignals(n, out));
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  const author = o.author as unknown;
  if (!out.author && author) {
    const a = Array.isArray(author) ? author[0] : author;
    out.author = typeof a === "string" ? a : typeof (a as Record<string, unknown>)?.name === "string" ? String((a as Record<string, unknown>).name) : undefined;
  }
  if (!out.datePublished && typeof o.datePublished === "string") out.datePublished = o.datePublished;
  if (!out.dateModified && typeof o.dateModified === "string") out.dateModified = o.dateModified;
  if (Array.isArray(o.sameAs)) out.sameAs = Math.max(out.sameAs, o.sameAs.length);
  else if (typeof o.sameAs === "string") out.sameAs = Math.max(out.sameAs, 1);
  const type = o["@type"];
  if ((type === "FAQPage" || (Array.isArray(type) && type.includes("FAQPage"))) && Array.isArray(o.mainEntity)) out.faq += o.mainEntity.length;
  for (const k of ["@graph", "mainEntity", "publisher", "itemListElement"]) if (o[k] && k !== "mainEntity") collectLdSignals(o[k], out);
}

const wc = (t: string) => (t.match(/[\p{L}\p{N}]+/gu) ?? []).length;

function extractGeo($: cheerio.CheerioAPI, ld: LdSignals, meta: (n: string) => string | undefined): GeoFacts {
  const prop = (p: string) => $(`meta[property="${p}"]`).attr("content")?.trim();
  const byline = $('[rel="author"], [itemprop="author"], .author, .byline, [class*="author-name"]').first().text().replace(/\s+/g, " ").trim();
  const timeEl = $("time[datetime]").first().attr("datetime");

  const body = $("body");
  const paragraphs = body.find("p").map((_, el) => wc($(el).text())).get().filter((n) => n > 0);

  // Walk headings and capture the first <p> after each, plus words until the next heading.
  const sections: GeoFacts["sections"] = [];
  body.find("h1,h2,h3,h4").each((_, el) => {
    const heading = $(el).text().replace(/\s+/g, " ").trim();
    let first = 0;
    let words = 0;
    let node = $(el).next();
    for (let i = 0; node.length && i < 40 && !/^h[1-4]$/i.test(node.prop("tagName") ?? ""); i++) {
      const tag = (node.prop("tagName") ?? "").toLowerCase();
      const text = node.text();
      if (!first && (tag === "p" || node.find("p").length)) first = wc(tag === "p" ? text : node.find("p").first().text());
      words += wc(text);
      node = node.next();
    }
    sections.push({ level: Number(el.tagName[1]), heading, firstParagraphWords: first, words });
  });

  const lists = body.find("ul,ol").filter((_, el) => $(el).children("li").length >= 3).length;
  const root = $("#__next, #root, #app, [data-reactroot]").first();
  const bodyWords = wc(body.clone().find("script,style,noscript,template").remove().end().text());
  const appShellOnly = bodyWords < 50 && (root.length > 0 || $("script[src]").length >= 3);

  return {
    author: meta("author") || ld.author || prop("article:author") || byline || undefined,
    datePublished: ld.datePublished || prop("article:published_time") || timeEl || undefined,
    dateModified: ld.dateModified || prop("article:modified_time") || prop("og:updated_time") || undefined,
    sameAsCount: ld.sameAs,
    faqQuestions: ld.faq,
    sections,
    firstParagraphWords: paragraphs[0] ?? 0,
    paragraphWordCounts: paragraphs,
    lists,
    tables: body.find("table").length,
    scriptCount: $("script").length,
    appShellOnly,
  };
}

function collectTypes(node: unknown, out: string[]): void {
  if (Array.isArray(node)) {
    node.forEach((n) => collectTypes(n, out));
  } else if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    if (typeof t === "string") out.push(t);
    else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && out.push(x));
    if (obj["@graph"]) collectTypes(obj["@graph"], out);
  }
}
