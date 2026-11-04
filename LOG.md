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
