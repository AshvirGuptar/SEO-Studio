# SEO Studio — Log

Dated entries, newest at the bottom. Each entry: what was planned, what changed, decisions, next steps.
Agents: read the last few entries before starting work, and add one at the end of every session.

---

## 2026-11-04 — Session 1: scaffold + core engine

**Plan:** set up the project so it can last five weeks, and ship a first usable slice that needs
no paid APIs.

**Changes**
- Scaffolded Next.js 16 / React 19 / TypeScript / Tailwind v4 app (`create-next-app`).
- Wrote `CLAUDE.md` (agent guide), `docs/PLAN.md` (phased roadmap through Dec 7), this log.
- Built the pure-TS SEO engine in `src/lib/seo/` with a shared `Check` contract and weighted score.
- Page Analyzer (`/analyzer`, `POST /api/analyze`): live URL or pasted HTML; 35+ checks plus
  HTTP status, redirect chain, response time and X-Robots-Tag when fetched.
- SSRF-protected fetcher (`src/lib/net/fetch-page.ts`) since the deployed app fetches arbitrary URLs.
- Content Optimizer (`/content`): live client-side scoring of title, meta, URL and body with a SERP preview.
- URL Optimizer (`/urls`): bulk checks, slug suggestions, CSV redirect-map export.
- 33 Vitest unit tests; lint and production build pass.

**Bugs found while testing**
- `/api/analyze` zod union matched the URL-only shape first, so pasted HTML was silently ignored
  when a URL was also provided. Fixed by ordering the HTML variant first (commented in code).
- "Coming soon" sidebar links caused 404 prefetches; they're now non-link labels.
- Slug suggestions kept opaque numeric IDs; keyword density of 27% only warned. Both fixed + tested.

**Decisions**
- Start rule-based (no API key yet); the AI rewrite button is visible but disabled until Phase 2.
- Engine has no React/Next dependency so it can run client-side (instant scoring) and be tested alone.
- Deploy target: Vercel.

**Next**
- Added GitHub Actions CI (test, lint, build). Next: deploy to Vercel and share with the team.
- Phase 1: database + team auth + saved history.

## 2026-11-04 — Session 1b: brand theme

**Changes**
- New dark theme built around brand orange `#F15A29`: near-black surfaces, subtle orange glow,
  orange gradient logo mark, orange primary buttons with dark text, orange active-nav indicator.
- Home page hero ("Ship pages that rank.") and hover-lift tool cards.
- SERP preview now uses Google's dark-mode colors.

**Decisions**
- Orange is reserved for brand/actions; status colors moved off amber (warn → yellow, fail → rose)
  so warnings can't be confused with buttons. Rules written into CLAUDE.md.
- Dark-only for now; tokens are CSS variables so a light theme can be added later.

## 2026-11-04 — Session 1c: access control for deployment

**Changes**
- Added a temporary site-wide password gate: `src/proxy.ts` (Next 16's renamed middleware) +
  `src/lib/auth/basic-auth.ts` with constant-time comparison and tests. Active only when
  `SITE_PASSWORD` is set, so local dev stays open. Covers pages and `/api/*`.
- README: Vercel deployment + access instructions. `.env.example` documents the new variables.

**Decisions**
- Basic Auth as a stopgap (zero dependencies, no database) because the API fetches arbitrary URLs
  and the tool is internal. Replaced in Phase 1 by real per-person sign-in with admin/member roles.
- The repo's only branch (and GitHub default) is currently `claude/festive-allen-xz3809`;
  a `main` branch should become the production branch before inviting the team.

## 2026-11-04 — Session 1d: hosting decision + main branch

**Decisions**
- Deploy publicly (no `SITE_PASSWORD`) for testing and grading: no stored data, SSRF guard in place,
  noindex set. **Must turn the gate on before Phase 1 stores data or Phase 2 adds an AI key.**
- Created `main` from the current work; it becomes the production branch. Future work goes on
  feature branches merged into `main` through PRs.

## 2026-11-04 — Session 1e: deployed

- Live at https://seo-studio-weld.vercel.app/ (Vercel Hobby, production branch `main`, public).
- Needed the Vercel GitHub app installed on the repo before the import worked.
- Skipped custom domain and Speed Insights for now (no domain yet; Speed Insights measures this
  app's load speed, not analyzed pages). Revisit domain after Phase 1 sign-in; consider Vercel Web
  Analytics later for usage numbers for the demo.
- To verify on the live site: Page Analyzer "Live URL" mode (untested from the dev sandbox).

## 2026-11-04 — Session 2: Site Audit, Keyword Clusters, Guide

**Plan:** the user asked why three tools said "coming soon" and for a how-to guide. Built the two
tools that need no database now; Projects & History stays blocked on the Phase 1 database.

**Changes**
- Site Audit (`/audit`): `/api/audit/discover` reads robots.txt + sitemaps (incl. indexes);
  `/api/audit/page` fetches and summarizes one page. `src/lib/seo/crawler.ts` runs a BFS crawl in
  the browser (concurrency 4, robots-aware, stop button, sitemap fallback for orphans).
  `site-audit.ts` computes 17 site-wide issue types and a health score. CSV export.
- Keyword Clusters (`/keywords`): `keywords.ts` with intent classification, light stemming,
  Jaccard clustering (strictness slider), page mapping, content gaps, and two cannibalization types
  (one page ← many clusters; many pages → one cluster). Sample store data preloaded. CSV export.
- Guide (`/guide`): workflow, ecommerce playbook, score meaning, quick reference, FAQ. Added a
  Help section to the sidebar and Guide/Audit buttons to the home hero.
- `fetchPage` takes `accept`/`maxBytes` options (robots.txt is text/plain, sitemaps can be big).
- Shared `src/lib/csv.ts`; URL Optimizer uses it.
- 64 tests passing. UI verified in Playwright with a fake 11-page store injected at the API layer
  (live crawling can't run from the dev sandbox).

**Bugs found while testing**
- Crawler fell back to sitemap URLs while pages were still in flight, so link-reachable pages
  were labeled "sitemap only". Now waits until nothing is queued or in flight.
- Keyword mapping matched on shared generic words ("hiking"), creating false cannibalization and
  hiding real content gaps. Now requires most of a cluster's terms incl. its most distinctive term,
  prefers the most specific page, and never maps how-to topics to shop pages (or vice versa).
- Rounding bug (3 × 0.67 → 3) made 3-word clusters require every word.
- Long URLs overflowed the Keyword Clusters page on phones.

**Decisions**
- Crawl is client-driven to stay within serverless time limits and give live progress.
- Default grouping strictness 0.7: separates e.g. "womens hiking boots" from "hiking boots",
  which most stores give separate pages.

**Next**
- Verify Site Audit against a real site on the deployed app.
- Phase 1: database (Neon via Vercel Storage) + sign-in + Projects & History. Turn on the password
  gate before storing data.

## 2026-11-04 — Session 3: database, sign-in, Projects & History, Team & access

**Plan:** user created the Neon database; asked how to handle users outside the company domain.
Decision: invite-only Google sign-in instead of domain-locked.

**Changes**
- Drizzle schema + first migration (`drizzle/0000_init.sql`): Better Auth tables + invite, project, audit.
  `scripts/migrate.mjs` runs before `next build`, so Vercel deploys migrate automatically.
- `getDb()`: Neon HTTP in production; `pglite://` embedded Postgres for local dev; PGlite in tests.
  Instance stored on globalThis (Next loads modules separately for pages and route handlers).
- Better Auth 1.7.12 (pinned ~2 weeks old) with Google. Access rules in `auth/access.ts` (pure):
  ADMIN_EMAILS → admin; AUTO_APPROVE_DOMAINS → member; invites → invited role; else pending.
  Re-evaluated on every sign-in. Disabled users stay disabled unless env admin.
- Sign-in is optional: without the four env vars the app runs exactly as before (tools open,
  Projects shows a setup notice, data APIs return 503).
- Proxy redirects signed-out users to /sign-in; every API route has a guard.
- Pages: /sign-in, access-requested/disabled screen, /projects, /projects/[id] (health chart with
  hover tooltip, tracked pages with sparkline + change, all audits), saved audit view with
  "what changed" (page: fixed/new/worse checks; site: resolved/new/increased issue types),
  /admin (approve/deny, invite, roles, disable). Save-to-project in Page Analyzer + Site Audit
  (site audits saved without link lists to stay small).
- Moved pages into an `(app)` route group so /sign-in has no sidebar.
- 79 unit tests (incl. DB repo tests on in-memory Postgres) + new signed-in E2E script
  (`scripts/e2e`): 30 checks, all passing, no browser errors.

**Bugs found while testing**
- cacheComponents build failures: usePathname and cookie reads outside <Suspense>. Fixed with
  Suspense boundaries in the (app) layout, sidebar and sign-in page.
- Embedded DB had two instances (pages vs API routes) so saved data didn't show. Fixed via globalThis.
- A non-admin opening /admin gets the 404 page with HTTP 200 (streamed response). Verified no admin
  data reaches the page and the admin API returns 403.

**Next**
- Owner: Google OAuth client + Vercel env vars (README "Sign-in setup"), then redeploy.
- Decide whether outside users are clients (per-project access) or contractors (current model is fine).

## 2026-11-04 — Session 4: GEO, PDF reports, Start over, homepage, rebrand, demo mode

**Plan:** user asked for a fancier homepage with hover previews, a reset button, downloadable
reports, a rebrand to "SEO & GEO Studio" with real GEO analysis, access for two Gmail accounts,
and whether sign-in can be turned off for a live demo.

**Changes**
- Rebrand: `src/lib/brand.ts` + `Wordmark`; titles, sidebar, sign-in, guide, PDF, user agent.
- GEO engine (`src/lib/seo/geo.ts`): 14 AI crawlers (search vs training) evaluated per-bot against
  robots.txt (`rulesForAgent`, RFC 9309 group selection); snippet controls; empty-SPA detection;
  question headings + direct answers + answer-first lead; lists/tables; section/paragraph length;
  author, dates/freshness, citations, concrete numbers; content schema, FAQ, Organization sameAs.
  Extractor collects the needed signals. `/api/analyze` also fetches robots.txt + llms.txt.
- Page Analyzer: SEO + GEO score rings, SEO / GEO tabs, AI crawler table, action bar.
- Site Audit: discovery returns AI crawler access + llms.txt; AI visibility card; avg GEO score;
  GEO column + CSV column.
- PDF reports (@react-pdf/renderer 4.9.0, loaded on click): page and site reports, light print layout.
- Start over / Clear on all five tools (Next 16 keeps visited routes' state alive by design).
- Homepage: hero with animated SEO/GEO/AI-answer preview, stat strip, 7 feature cards with mini
  illustrations and hover "Use it to" panels (always visible on touch), SEO vs GEO, monthly loop.
  Respects prefers-reduced-motion.
- AI Visibility added as a coming-soon tool.
- Demo mode: PUBLIC_TOOLS=true opens tool pages/APIs only; projects/admin stay behind sign-in.
- 86 unit tests; signed-in E2E re-run.

**Bugs found while testing**
- PDF: big score overlapped its subtitle; title overlapped URL (react-pdf line heights). Fixed.
- PDF: Helvetica can't render → / ✓; added a text sanitizer.
- 7 cards left an orphan in a 3-column grid; flagship cards now span two columns.

**Decisions**
- GEO is rule-based (no AI key needed). Real AI-answer tracking is the coming-soon AI Visibility tool.
- llms.txt reported as optional/info only: major engines don't rely on it yet.
- Demo: prefer staying signed in on the demo laptop; PUBLIC_TOOLS only if the audience needs hands-on.

## 2026-11-04 — Sign-in setup deferred

- Owner chose to skip the Google OAuth + Vercel env var setup for now. The app runs in open mode:
  tools public, Projects & History / Team & access show setup notices. Steps are in README
  "Sign-in setup" (plus ADMIN_EMAILS=ashvirguptar@gmail.com,ashvirguptar04@gmail.com).
- Merging PR #2 is still safe; migrations run on Neon at deploy so the DB is ready when sign-in is enabled.

## 2026-11-04 — Session 5: product specs in the Content Optimizer

**Plan:** product pages often have a separate "Specs" tab (weight, color, sizing…); user asked for an
optional field that feeds into the SEO and GEO scores.

**Changes**
- `src/lib/seo/specs.ts`: `parseSpecs` (colon, tab, pipe, " - " separators), `analyzeSpecs` SEO checks
  (attribute count, Label: Value consistency, units incl. prefix sizes like "US 7–13", key shopping
  attributes, keyword terms) and `analyzeCopyGeo` (answer-first opening, concrete facts across body +
  specs, specs as structured facts, reminder that click-to-open tabs must be in the HTML).
- Content Optimizer: Specs field with live spec-table preview + warning for unstructured lines;
  now shows SEO and GEO scores with SEO / GEO tabs (previously SEO only). Start over clears specs.
- Page Analyzer GEO: definition lists (<dl>, common for spec tabs) now count as structured lists.
- Guide: ecommerce tip for specs. 92 unit tests.

**Decisions**
- Specs are scored as their own section (not added to body word count) so thin descriptions are
  still flagged; specs facts do count toward GEO "concrete facts".

## 2026-11-04 — Session 6: niche example content (AR-15 charging handles)

- Replaced all hiking-boot example content (homepage hero + card previews, Content/URL Optimizer
  placeholders and samples, Keyword Clusters sample keywords/pages, Guide examples) with AR-15
  charging-handle examples for a fictional store, "Example Arms" (shop.example-arms.com). Real
  brands the user referenced were deliberately not used to avoid implying affiliation.
- Matching now ignores hyphens/apostrophes inside words (`matchToken`): "ar-15" = "ar15",
  "m-lok" = "mlok", for keyword checks and clustering. Tests added.
- Specs: "compatibility" (fits/platform/caliber) added as a key shopping attribute.
- Content Optimizer card tagged SEO + GEO. 94 unit tests.

## 2026-11-04 — Session 7: example content switched to PC graphics cards

- User preferred a PC example over AR-15 charging handles. All example content (homepage hero +
  card previews, Content/URL Optimizer placeholders and samples, Keyword Clusters sample, Guide)
  now uses a fictional store, "Example PC" (shop.example-pc.com), with generic product names
  ("Aurora 12GB") rather than real GPU brands.
- Specs checks now understand electronics: MHz/GHz, GB, slots, pins, fans, ports, "3×"
  multipliers and versioned standards ("PCIe 4.0", "HDMI 2.1"); "capacity / performance"
  (memory, clock, power, PSU…) added as a key attribute; interface/socket/slot count as compatibility.
- Keyword Clusters: "competing pages" now ignores more specific pages that are the best match for
  a different cluster (e.g. /graphics-cards/low-profile no longer competes with /graphics-cards).
- 96 unit tests.
