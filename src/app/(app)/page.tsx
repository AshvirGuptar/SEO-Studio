import Link from "next/link";
import { TOOLS, toolStatus } from "@/components/nav";
import { isAuthEnabled } from "@/lib/auth/server";
import { BRAND } from "@/lib/brand";
import { ToolIcon, ToolPreview } from "./home/ToolPreview";
import { AI_CRAWLERS } from "@/lib/seo/geo";

export default function Home() {
  const authEnabled = isAuthEnabled();
  return (
    <div className="space-y-20 pb-10">
      <Hero />

      <section>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Everything in one studio</h2>
            <p className="text-sm text-muted">Hover a tool to see what it&apos;s for.</p>
          </div>
          <Link href="/guide" className="inline-flex min-h-10 items-center text-sm text-accent hover:underline">Read the playbook →</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {TOOLS.map((t, i) => {
            const live = toolStatus(t, authEnabled) === "live";
            // Flagship tools (SEO + GEO) span two columns so 7 cards fill a 3-column grid evenly.
            const wide = t.href === "/analyzer" || t.href === "/audit";
            const className = `card group relative flex flex-col overflow-hidden p-0 transition duration-300 rise ${wide ? "xl:col-span-2" : ""} ${live ? "hover:-translate-y-1 hover:border-accent/50 hover:shadow-[0_18px_50px_-18px_rgb(241_90_41/0.45)] focus-visible:border-accent" : ""}`;
            const style = { animationDelay: `${i * 60}ms` };
            const body = (
              <>
                <div className="relative h-28 border-b border-border bg-surface-2/40">
                  <ToolPreview href={t.href} />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-3">
                    <ToolIcon href={t.href} />
                    <h3 className="font-medium">{t.name}</h3>
                    <span className="ml-auto flex gap-1">
                      {!live ? (
                        <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-subtle">
                          {t.needsAuth ? "Sign-in" : "Soon"}
                        </span>
                      ) : (
                        t.tags?.map((tag) => (
                          <span key={tag} className="rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted">{tag}</span>
                        ))
                      )}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted">{t.blurb}</p>

                  {t.useCases && (
                    <div className="reveal absolute inset-x-0 bottom-0 top-28 flex flex-col bg-surface/95 p-5 backdrop-blur">
                      <div className="label">Use it to</div>
                      <ul className="space-y-2 text-sm">
                        {t.useCases.map((u) => (
                          <li key={u} className="flex gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            <span>{u}</span>
                          </li>
                        ))}
                      </ul>
                      <span className="mt-auto pt-3 text-sm font-medium text-accent">
                        {live ? "Open tool →" : t.needsAuth ? "Available once sign-in is set up" : "Coming soon"}
                      </span>
                    </div>
                  )}
                </div>
              </>
            );
            return live ? (
              <Link key={t.href} href={t.href} className={className} style={style}>{body}</Link>
            ) : (
              <div key={t.href} className={className} style={style}>{body}</div>
            );
          })}
        </div>
      </section>

      <SeoVsGeo />
      <Workflow />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative -mx-4 overflow-hidden px-4 pt-2 sm:-mx-6 sm:px-6 md:pt-6 lg:-mx-8 lg:px-8">
      <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative grid items-center gap-10 xl:grid-cols-[1.1fr_1fr]">
        <div className="rise">
          <span className="chip">SEO + GEO toolkit for our team</span>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight md:text-6xl">
            Rank in search.
            <br />
            <span className="bg-gradient-to-r from-[#ff8a5c] via-accent to-accent-deep bg-clip-text text-transparent">Get cited by AI.</span>
          </h1>
          <p className="mt-5 max-w-xl text-muted md:text-lg">
            Audit pages and whole sites, tune copy and URLs, and check how ready your content is for
            ChatGPT, Perplexity, Google AI Overviews and Claude. All in one place.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/analyzer" className="btn px-5 py-2.5">Analyze a page</Link>
            <Link href="/audit" className="btn-ghost px-5 py-2.5">Audit a whole site</Link>
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-border pt-6">
            {[
              ["60+", "SEO & GEO checks"],
              [String(AI_CRAWLERS.length), "AI crawlers tracked"],
              ["500", "pages per site crawl"],
            ].map(([n, l]) => (
              <div key={l}>
                <dt className="sr-only">{l}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{n}</dd>
                <dd className="text-xs text-subtle">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
        <HeroVisual />
      </div>
    </section>
  );
}

/** Decorative product preview: scores, a Google result and an AI answer citing the page. */
function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md md:max-w-lg xl:max-w-none" aria-hidden="true">
      <div className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(closest-side,rgb(241_90_41/0.25),transparent)]" />
      <div className="card float relative">
        <div className="flex items-center justify-between">
          <span className="text-xs text-subtle">example-pc.com/graphics-cards/aurora-12gb</span>
          <span className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-surface-2" />)}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            ["SEO", 92, "var(--pass)", "Search engines"],
            ["GEO", 78, "var(--warn)", "AI answer engines"],
          ].map(([k, v, c, sub]) => {
            const r = 26, circ = 2 * Math.PI * r;
            return (
              <div key={String(k)} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/40 p-3">
                <svg width="64" height="64">
                  <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="6" />
                  <circle cx="32" cy="32" r={r} fill="none" stroke={String(c)} strokeWidth="6" strokeLinecap="round" strokeDasharray={circ}
                    strokeDashoffset={circ * (1 - Number(v) / 100)} transform="rotate(-90 32 32)" className="draw" style={{ ["--len" as string]: circ }} />
                  <text x="32" y="32" textAnchor="middle" dominantBaseline="central" fontSize="16" fontWeight="600" fill="var(--foreground)">{v}</text>
                </svg>
                <div>
                  <div className="text-sm font-semibold">{k}</div>
                  <div className="text-[11px] text-subtle">{sub}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 rounded-xl border border-border bg-[#1f1f1f] p-3 font-[arial,sans-serif]">
          <div className="text-[11px] text-[#bdc1c6]">example-pc.com › graphics-cards</div>
          <div className="text-[15px] text-[#99c3ff]">Aurora 12GB Graphics Card – 1440p Gaming | Example PC</div>
          <div className="mt-0.5 text-[11px] leading-snug text-[#bdc1c6]">12GB GDDR6X, PCIe 4.0 and quiet triple-fan cooling. Fits most mid-tower cases. 3-year warranty.</div>
        </div>
      </div>
      <div className="card float-delay relative -mt-6 ml-auto w-[85%] p-4 shadow-2xl">
        <div className="flex items-center gap-2 text-[11px] text-subtle">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-accent-soft text-[10px] text-accent">AI</span>
          AI answer
          <span className="typing ml-auto flex gap-0.5">{[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 rounded-full bg-muted" />)}</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          For 1440p gaming at high settings, pick a card with at least 12 GB of VRAM, then check it fits your case and power supply.
          <span className="ml-1 rounded bg-accent-soft px-1 text-[10px] text-accent">example-pc.com [1]</span>
        </p>
      </div>
    </div>
  );
}

function SeoVsGeo() {
  const cols = [
    { k: "SEO", t: "Search engine optimization", d: "Rank in Google and Bing results.", items: ["Titles, meta descriptions & headings", "Crawlability, canonicals, speed", "Keywords, links & structured data"] },
    { k: "GEO", t: "Generative engine optimization", d: "Get found, quoted and cited in AI answers.", items: ["AI crawler access & snippet controls", "Answer-first, question-led content", "Authors, dates, sources & entity schema"] },
  ];
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">Two ways people find you now</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Shoppers still search Google, but more and more ask an AI assistant. {BRAND.name} scores every page for both.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {cols.map((c) => (
          <div key={c.k} className="card">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold text-accent">{c.k}</span>
              <span className="text-sm text-muted">{c.t}</span>
            </div>
            <p className="mt-2 text-sm">{c.d}</p>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              {c.items.map((i) => (
                <li key={i} className="flex gap-2"><span className="text-pass">✓</span>{i}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Workflow() {
  const steps = [
    ["Audit", "Crawl the site and fix errors first.", "/audit"],
    ["Plan", "Cluster keywords into one page per topic.", "/keywords"],
    ["Optimize", "Tune each page for search and AI answers.", "/analyzer"],
    ["Track", "Save audits and watch scores improve.", "/projects"],
  ];
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">A simple monthly loop</h2>
      <ol className="mt-6 grid gap-4 md:grid-cols-4">
        {steps.map(([t, d, href], i) => (
          <li key={t} className="relative">
            <Link href={href} className="card block h-full transition hover:border-accent/50">
              <span className="text-xs font-semibold text-accent">0{i + 1}</span>
              <div className="mt-1 font-medium">{t}</div>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </Link>
            {i < steps.length - 1 && <span className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-subtle md:block" aria-hidden="true">→</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
