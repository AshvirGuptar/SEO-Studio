import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Guide" };

const TOC = [
  { id: "tools", label: "The tools at a glance" },
  { id: "workflow", label: "Recommended workflow" },
  { id: "geo", label: "Getting cited by AI (GEO)" },
  { id: "ecommerce", label: "Ecommerce playbook" },
  { id: "scores", label: "Understanding scores" },
  { id: "reference", label: "Quick reference" },
  { id: "faq", label: "FAQ" },
];

export default function GuidePage() {
  return (
    <div className="grid gap-10 xl:grid-cols-[1fr_200px]">
      <article className="min-w-0 space-y-12">
        <header>
          <span className="chip">Guide</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">How to use SEO &amp; GEO Studio</h1>
          <p className="mt-2 max-w-2xl text-muted">
            A practical playbook for website and online-store owners: what each tool is for, the order to use them in,
            and what “good” looks like. Work through it top to bottom the first time, then repeat the cycle monthly.
          </p>
        </header>

        <Section id="tools" title="The tools at a glance">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-subtle">
                <tr><th className="pb-2 pr-4">Tool</th><th className="pb-2 pr-4">Answers the question…</th><th className="pb-2">Use it when</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                <ToolRow href="/audit" name="Site Audit" q="What’s broken or weak across my whole site?" when="First, then monthly" />
                <ToolRow href="/keywords" name="Keyword Clusters" q="What should each page target, and what pages am I missing?" when="Planning content or a new section" />
                <ToolRow href="/content" name="Content Optimizer" q="Is this title, meta description and copy well optimized?" when="Writing or rewriting a page" />
                <ToolRow href="/urls" name="URL Optimizer" q="Are my URLs clean? What should they be?" when="Creating pages or restructuring" />
                <ToolRow href="/analyzer" name="Page Analyzer" q="How does this page score for search (SEO) and AI answers (GEO)?" when="After publishing, or checking a competitor" />
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="workflow" title="Recommended workflow">
          <ol className="space-y-6">
            <Step n={1} title="Fix the foundation with a Site Audit" href="/audit">
              <p>Enter your homepage and crawl up to 500 pages. Fix issues in this order:</p>
              <ul>
                <li><b>Errors first:</b> broken pages, broken internal links, missing titles. These actively lose traffic.</li>
                <li><b>Then warnings:</b> duplicate titles and metas, thin content, missing H1s, redirecting links, orphan pages.</li>
                <li><b>Review notices:</b> noindex and canonicalized pages. Make sure each one is intentional.</li>
              </ul>
              <p>Export the CSV to share with whoever maintains the site, then re-run the audit to confirm the fixes.</p>
            </Step>
            <Step n={2} title="Find out what people search for" href="/keywords">
              <p>Build a keyword list. Good free sources:</p>
              <ul>
                <li><b>Google Search Console</b> → Performance → Queries → Export. These are words people <i>already</i> use to find you.</li>
                <li><b>Google Keyword Planner</b> for monthly search volumes.</li>
                <li>Google autocomplete, “People also ask”, and competitors’ category names.</li>
              </ul>
              <p>
                Paste the list (with volumes if you have them) into Keyword Clusters, plus a list of your existing pages. Then read the results:
              </p>
              <ul>
                <li><b>One cluster = one page.</b> The top keyword is the page’s primary keyword; the rest are supporting terms.</li>
                <li><b>Intent tells you the page type:</b> transactional/commercial → product or category page; informational → blog post or guide.</li>
                <li><b>Content gaps</b> are clusters with no page. Create one (the suggested URL is a good start).</li>
                <li><b>Cannibalization</b> means one page is the best match for several clusters, or several pages compete. Give each cluster its own clearly focused page, or merge them.</li>
              </ul>
            </Step>
            <Step n={3} title="Optimize each page’s content" href="/content">
              <p>
                For each page, enter its primary keyword and paste the title, meta description and body copy into the Content
                Optimizer. Work through the issues until every field is green (80+). The search preview shows how it will look on Google.
              </p>
              <p>Aim high, but write for people first: a natural 85 beats a robotic 100.</p>
            </Step>
            <Step n={4} title="Clean up URLs (carefully)" href="/urls">
              <p>
                Use short, lowercase, hyphenated URLs that contain the keyword. <b>For new pages, always.</b> For existing pages
                that already get traffic, only change the URL if the gain is clear, and <b>always add a 301 redirect</b> from the old URL.
              </p>
              <p>Export the redirect map CSV and import it into your platform (e.g. Shopify → Navigation → URL Redirects).</p>
            </Step>
            <Step n={5} title="Verify the live page" href="/analyzer">
              <p>
                After publishing, run the live URL through the Page Analyzer to catch anything the CMS changed (missing canonical,
                duplicate H1 from the theme, missing structured data). Then use <b>URL Inspection → Request indexing</b> in Search Console.
              </p>
            </Step>
            <Step n={6} title="Monitor and repeat">
              <p>
                Re-run the Site Audit monthly and after big site changes. Watch clicks and impressions in Search Console; SEO
                changes typically take 2–8 weeks to show up. Save each audit to a project to track scores over time and see what changed.
              </p>
            </Step>
          </ol>
        </Section>

        <Section id="geo" title="Getting cited by AI (GEO)">
          <p className="mb-4 max-w-3xl text-sm text-muted">
            <b className="text-foreground">Generative engine optimization</b> is about being found, understood and <i>cited</i> by AI
            answer engines: ChatGPT search, Perplexity, Google AI Overviews / Gemini, Claude and Copilot. Good SEO is the foundation;
            GEO adds a few things on top. The Page Analyzer&apos;s <b className="text-foreground">GEO / AI</b> tab and the Site Audit&apos;s
            <b className="text-foreground"> AI visibility</b> card check all of these.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="1. Let AI search crawlers in">
              <p>Check robots.txt doesn&apos;t block <code>OAI-SearchBot</code>, <code>ChatGPT-User</code>, <code>PerplexityBot</code>, <code>Claude-SearchBot</code>. Blocking training-only bots (<code>GPTBot</code>, <code>CCBot</code>, <code>Google-Extended</code>) is a business choice and doesn&apos;t stop citations.</p>
              <p>Avoid <code>nosnippet</code> / <code>max-snippet:0</code>; they also remove you from Google&apos;s AI Overviews.</p>
            </Card>
            <Card title="2. Make content readable without JavaScript">
              <p>Most AI crawlers don&apos;t run JavaScript. If your product details or descriptions load client-side, AI engines may see an empty page. Server-render key content.</p>
            </Card>
            <Card title="3. Write answer-first">
              <ul>
                <li>Open with a 1–3 sentence summary of the page.</li>
                <li>Use headings phrased as real questions (“Will this graphics card fit my case?”).</li>
                <li>Answer each in the first 25–90 words below it, then add detail.</li>
                <li>Put specs, steps and comparisons in lists and tables.</li>
              </ul>
            </Card>
            <Card title="4. Show you're a credible source">
              <ul>
                <li>Name an author or source, and show “Updated &lt;date&gt;”.</li>
                <li>Use concrete numbers: sizes, prices, test results, percentages.</li>
                <li>Link to authoritative sources for claims.</li>
                <li>Add Organization schema with <code>sameAs</code> links to your official profiles, plus Product / Article / FAQPage schema.</li>
              </ul>
            </Card>
          </div>
          <p className="mt-4 text-sm text-muted">
            Coming soon: <b className="text-foreground">AI Visibility</b> will track whether AI assistants actually mention and cite your brand for the
            questions your customers ask.
          </p>
        </Section>

        <Section id="ecommerce" title="Ecommerce playbook">
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Product titles">
              <p>A reliable formula: <code>Brand + Product type + Key attribute + Variant</code></p>
              <p className="text-subtle">e.g. “Example PC Aurora Graphics Card – 12GB GDDR6X, PCIe 4.0”</p>
              <p>Keep the page title under ~60 characters; put the product type (what people search) early.</p>
            </Card>
            <Card title="Product descriptions">
              <ul>
                <li>Write <b>unique</b> copy. Manufacturer descriptions are duplicated across hundreds of stores.</li>
                <li>Lead with who it’s for and the main benefit, then specs (compatibility, performance, dimensions, power).</li>
                <li>Add a short FAQ (compatibility, installation, shipping, returns); it answers long-tail searches.</li>
                <li>150+ words is a good floor for products.</li>
                <li>Paste your <b>Specs</b> tab into the Content Optimizer as “Label: Value” lines. Complete, unit-labeled specs help shoppers, search filters and AI shopping answers.</li>
              </ul>
            </Card>
            <Card title="Category pages">
              <p>
                Often your highest-value pages: they target broad commercial keywords like “graphics cards”. Add 150–300 words of
                helpful intro or buying-guide copy, a keyword-focused H1, and link to related categories.
              </p>
            </Card>
            <Card title="Images">
              <ul>
                <li>Descriptive alt text: “Triple-fan 12GB graphics card, angled view”, not “IMG_2041”.</li>
                <li>Descriptive file names and compressed sizes (WebP) for speed.</li>
              </ul>
            </Card>
            <Card title="Structured data">
              <p>
                Add <code>Product</code> schema with price, availability and review rating so Google can show rich results
                (stars, price, “In stock”). Add <code>BreadcrumbList</code> on products and categories. Most platforms or
                apps can add these; the Page Analyzer shows which are present.
              </p>
            </Card>
            <Card title="Variants, filters & stock">
              <ul>
                <li>Color/size variants: one indexable URL per product, with variants canonicalized to it.</li>
                <li>Filter and sort URLs (<code>?color=</code>, <code>?sort=</code>): canonical to the main category or noindex them.</li>
                <li>Temporarily out of stock: keep the page live. Discontinued: 301 to the closest alternative or category.</li>
              </ul>
            </Card>
          </div>
        </Section>

        <Section id="scores" title="Understanding scores">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
            <div className="space-y-2 text-sm">
              <p>Every check is weighted by importance. Passing earns full credit, a warning half, a failure none; notices don’t count.</p>
              <ul className="space-y-1.5">
                <li><Dot c="bg-pass" /> <b>90–100 (A)</b> Excellent; only polish left.</li>
                <li><Dot c="bg-pass" /> <b>80–89 (B)</b> Good; fix the remaining warnings.</li>
                <li><Dot c="bg-warn" /> <b>60–79 (C/D)</b> Needs work; clear errors first.</li>
                <li><Dot c="bg-fail" /> <b>Below 60 (F)</b> Fundamental problems.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-surface-2/50 p-4 text-sm">
              <p className="font-medium">A high score isn’t a ranking guarantee</p>
              <p className="mt-1 text-muted">
                SEO &amp; GEO Studio measures on-page quality: the part you control directly. Rankings also depend on backlinks,
                competition, how well the page matches search intent, site reputation and page experience. Think of the score
                as “nothing on this page is holding it back”.
              </p>
            </div>
          </div>
        </Section>

        <Section id="reference" title="Quick reference">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <tbody className="divide-y divide-border">
                {[
                  ["Title tag", "30–60 characters (~580px); primary keyword near the start; unique per page"],
                  ["Meta description", "120–160 characters; includes keyword; ends with a call to action"],
                  ["URL", "Lowercase, hyphens, ≤75 characters, ≤6 slug words, contains keyword, no IDs"],
                  ["Headings", "Exactly one H1 with the keyword; H2s for sections; don’t skip levels"],
                  ["Content length", "Products 150+ words · Categories 250+ · Articles 800+"],
                  ["Keyword density", "Roughly 0.5–2.5%; over 5% reads as stuffing"],
                  ["Keyword placement", "Title, H1, URL, first 100 words, one image alt"],
                  ["Images", "Every meaningful image has alt text"],
                  ["Links", "3+ internal links per page with descriptive anchor text (not “click here”)"],
                  ["Technical", "HTTPS, mobile viewport, canonical tag, no accidental noindex, server response <0.8s"],
                ].map(([k, v]) => (
                  <tr key={k}><td className="w-44 py-2 pr-4 font-medium">{k}</td><td className="py-2 text-muted">{v}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="faq" title="FAQ">
          <div className="space-y-4 text-sm">
            <Faq q="The Page Analyzer or Site Audit can’t fetch my site. Why?">
              Some sites block automated requests (bot protection, firewalls, Cloudflare challenges) or require a login. Use
              <b> Paste HTML</b> in the Page Analyzer: open the page, View Source, copy everything, paste it in.
            </Faq>
            <Faq q="How big a site can the Site Audit handle?">
              Up to 500 pages per run. The crawl runs from your browser tab, so keep the tab open until it finishes. Large stores
              can audit sections separately by starting from a category URL.
            </Faq>
            <Faq q="Where do search volumes come from?">
              SEO &amp; GEO Studio doesn’t buy search data. Bring your own volumes from Google Search Console or Keyword Planner and
              paste them with your keywords. Clustering works without volumes too.
            </Faq>
            <Faq q="Is my work saved? How do I share results?">
              Results stay in your tab while you switch between tools; use <b>Start over</b> to clear them. Click <b>Download PDF report</b> on the
              Page Analyzer or Site Audit to get a shareable report, or <b>Save to project</b> (when signed in) to keep it and track changes over time.
            </Faq>
            <Faq q="Can it write copy for me?">
              AI rewriting of titles, meta descriptions and product descriptions is planned. Every AI suggestion will be scored
              by the same rules you see today.
            </Faq>
          </div>
        </Section>
      </article>

      <nav className="hidden xl:block">
        <div className="sticky top-10 space-y-1 text-sm">
          <div className="label">On this page</div>
          {TOC.map((t) => <a key={t.id} href={`#${t.id}`} className="block rounded-lg px-2 py-1 text-muted hover:bg-surface-2 hover:text-foreground">{t.label}</a>)}
        </div>
      </nav>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="mb-4 text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Step({ n, title, href, children }: { n: number; title: string; href?: string; children: React.ReactNode }) {
  return (
    <li className="card flex gap-4">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-accent/40 bg-accent-soft text-sm font-semibold text-accent">{n}</span>
      <div className="min-w-0 flex-1 space-y-2 text-sm text-muted [&_b]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-medium text-foreground">{title}</h3>
          {href && <Link href={href} className="text-xs font-medium text-accent hover:underline">Open tool →</Link>}
        </div>
        {children}
      </div>
    </li>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-2 text-sm text-muted [&_b]:text-foreground [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
      <h3 className="font-medium text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function ToolRow({ href, name, q, when }: { href: string; name: string; q: string; when: string }) {
  return (
    <tr>
      <td className="py-2.5 pr-4"><Link href={href} className="font-medium text-accent hover:underline">{name}</Link></td>
      <td className="py-2.5 pr-4 text-muted">{q}</td>
      <td className="py-2.5 text-subtle">{when}</td>
    </tr>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="card group p-4 [&_b]:text-foreground">
      <summary className="flex min-h-8 cursor-pointer list-none items-center font-medium marker:hidden">
        <span className="mr-2 inline-block text-accent transition group-open:rotate-90">›</span>{q}
      </summary>
      <p className="mt-2 pl-5 text-muted">{children}</p>
    </details>
  );
}

function Dot({ c }: { c: string }) {
  return <span className={`mr-1 inline-block h-2 w-2 rounded-full ${c}`} />;
}
