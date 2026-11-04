import { z } from "zod";
import { FetchPageError, fetchPage, normalizeInputUrl } from "@/lib/net/fetch-page";
import { parseRobots, parseSitemap, type RobotsRules } from "@/lib/seo/robots";
import { normalizeCrawlUrl, sameSite } from "@/lib/seo/site-audit";

const Body = z.object({ url: z.string().min(1).max(2048) });
const MAX_SITEMAP_URLS = 2000;
const MAX_SITEMAP_FILES = 6;

/** Discover crawl inputs for a site: robots.txt rules and sitemap URLs. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Provide a site URL." }, { status: 400 });

  let start: URL;
  try {
    start = normalizeInputUrl(parsed.data.url);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Invalid URL." }, { status: 400 });
  }

  // Resolve the start URL first so redirects (http→https, www) set the real origin.
  let origin = start.origin;
  let startUrl = start.href;
  try {
    const page = await fetchPage(start.href);
    startUrl = page.url;
    origin = new URL(page.url).origin;
  } catch (e) {
    const msg = e instanceof FetchPageError ? e.message : "Couldn't reach that site.";
    return Response.json({ error: msg }, { status: 502 });
  }

  let robots: RobotsRules = { allow: [], disallow: [], sitemaps: [] };
  let robotsFound = false;
  try {
    const r = await fetchPage(`${origin}/robots.txt`, { accept: /text|plain/i, maxBytes: 512 * 1024 });
    if (r.status === 200) {
      robots = parseRobots(r.html);
      robotsFound = true;
    }
  } catch { /* no robots.txt is fine */ }

  const queue = robots.sitemaps.length ? [...robots.sitemaps] : [`${origin}/sitemap.xml`];
  const seen = new Set<string>();
  const urls = new Set<string>();
  const sitemapFiles: string[] = [];
  while (queue.length && seen.size < MAX_SITEMAP_FILES && urls.size < MAX_SITEMAP_URLS) {
    const sm = queue.shift()!;
    if (seen.has(sm)) continue;
    seen.add(sm);
    try {
      const res = await fetchPage(sm, { accept: /xml|text/i, maxBytes: 10 * 1024 * 1024 });
      if (res.status !== 200) continue;
      const { isIndex, urls: locs } = parseSitemap(res.html);
      sitemapFiles.push(sm);
      if (isIndex) queue.push(...locs);
      else for (const u of locs) {
        const n = normalizeCrawlUrl(u);
        if (n && sameSite(n, origin)) urls.add(n);
        if (urls.size >= MAX_SITEMAP_URLS) break;
      }
    } catch { /* skip unreadable sitemap */ }
  }

  return Response.json({
    startUrl: normalizeCrawlUrl(startUrl) ?? startUrl,
    origin,
    robotsFound,
    robots,
    sitemapFiles,
    sitemapUrls: [...urls],
  });
}
