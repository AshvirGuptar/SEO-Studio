import { z } from "zod";
import { FetchPageError, fetchPage } from "@/lib/net/fetch-page";
import { analyzePage } from "@/lib/seo/analyze-page";
import { summarizeReport, type CrawledPage } from "@/lib/seo/site-audit";

const Body = z.object({ url: z.string().url().max(2048), depth: z.number().int().min(-1).max(100) });

/** Fetch + summarize a single page for the client-driven site crawl. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Provide url and depth." }, { status: 400 });
  const { url, depth } = parsed.data;

  try {
    const page = await fetchPage(url);
    const report = analyzePage(page.html, { url: page.url });
    const summary = summarizeReport(report, {
      requestedUrl: url,
      status: page.status,
      redirects: page.redirects.length,
      elapsedMs: page.elapsedMs,
      depth,
    });
    // Error pages: keep status but don't follow their links.
    if (page.status >= 400) summary.internalLinks = [];
    return Response.json(summary satisfies CrawledPage);
  } catch (e) {
    const error = e instanceof FetchPageError ? e.message : "Unexpected error.";
    if (!(e instanceof FetchPageError)) console.error(e);
    const result: CrawledPage = { url, depth, status: 0, error, redirects: 0, internalLinks: [] };
    return Response.json(result);
  }
}
