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
}

export function extractFacts(html: string, pageUrl?: string): PageFacts {
  const $ = cheerio.load(html);
  let base: URL | undefined;
  try { base = pageUrl ? new URL(pageUrl) : undefined; } catch { base = undefined; }

  const meta = (name: string) =>
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
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      collectTypes(JSON.parse($(el).text()), jsonLdTypes);
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
