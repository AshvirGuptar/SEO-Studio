# SEO & GEO Studio — agent guide

@AGENTS.md

Internal SEO + GEO toolkit (think "Semrush for our team"): page audits with SEO and GEO (AI answer
engine) scores, site crawls, content/copy and URL tools, keyword clustering, projects/history, PDF reports.
Product name lives in `src/lib/brand.ts` (UI) — repo/domain still say seo-studio.
Live: https://seo-studio-weld.vercel.app/ (Vercel; deploys from `main`, PR branches get preview URLs).
Also the TCSS 490 Artifact 5 moonshot — see `PLAN.md` for the roadmap and the **Development log** at the
bottom of this file for history.

## Start of every session
1. Read the latest rows of the **Development log** (bottom of this file) and find the current week in
   `PLAN.md` (the calendar table maps dates to Weeks 1–5). Work on that week's unchecked deliverables
   unless asked otherwise.
2. Start from the latest `main` (a teammate may have merged since), then run `npm test` to confirm a
   green baseline.
3. At the end of the session, add a row to the **Development log** table (local PST timestamp, tool /
   AI model, focus, technical summary of what changed) and tick off items in `PLAN.md`. Don't edit
   past rows.

## Working as a team
- Two people (and their agents) work in parallel. Each session uses its own branch and merges into
  `main` through a PR; CI (tests, lint, build) must pass. Never push directly to `main`.
- Keep PRs focused on one deliverable from the plan; mention the plan item in the PR description.
- On a merge conflict, update the branch from `main` and resolve it; don't discard a teammate's work.
- Week ownership suggestion is in PLAN.md ("Team split"); check the Development log for what the
  other person did.

## Commands
- `npm run dev` — dev server (http://localhost:3000)
- `npm test` — Vitest unit tests (`src/**/*.test.ts`)
- `npm run lint` / `npm run typecheck` / `npm run build`
- Before committing: `npm test && npm run lint && npm run build` must all pass.

## Stack
Next.js 16 (App Router, `src/` dir, `cacheComponents` on) · React 19 · TypeScript (strict) · Tailwind v4
· cheerio (HTML parsing) · zod (request validation) · Drizzle ORM + Neon Postgres · Better Auth (Google)
· Vitest (+ PGlite in-memory Postgres for DB tests). Next 16 differs from older versions — check
`node_modules/next/dist/docs/` before using unfamiliar Next APIs.

## Architecture
```
src/lib/seo/        Pure SEO engine — NO React, NO Next, NO network. Runs in browser and server.
  types.ts          Check / Severity / ScoreSummary — the contract every analyzer returns
  score.ts          Weighted scoring (pass=1, warn=0.5, fail=0, info=excluded)
  text.ts           Tokenizing, keyword density, Flesch readability, SERP pixel width
  copy.ts           Title / meta description / body-copy analyzers
  slug.ts           URL analysis, slugify, URL suggestions
  extract.ts        HTML -> PageFacts (cheerio)
  analyze-page.ts   Full page audit = extract + all checks
  keywords.ts       Intent classification, keyword clustering, cluster→page mapping
  robots.ts         robots.txt + sitemap.xml parsing
  site-audit.ts     Per-page crawl summaries + site-wide issue detection
  crawler.ts        BFS crawl orchestrator (runs in the browser; fetch function injected)
  specs.ts          Product specs ("Label: Value" lines): parse + SEO checks; analyzeCopyGeo() = GEO
                    checks for raw copy (Content Optimizer's GEO score)
  geo.ts            GEO analyzer: AI crawler access (per-bot robots.txt), snippet controls, JS-only
                    shells, answer-first structure, trust signals, entity schema. AI_CRAWLERS list.
src/lib/report/pdf.tsx  PDF reports (@react-pdf/renderer), dynamically imported on click only
src/lib/net/        Server-only networking. fetch-page.ts has SSRF protection — ALWAYS use it
                    to fetch user-supplied URLs; never call fetch() on user input directly.
src/app/api/*       Route handlers (validate input with zod, return JSON)
                    audit/discover (robots + sitemap), audit/page (one page per request)
src/lib/csv.ts      Browser CSV export helper
src/lib/db/         schema.ts (Drizzle tables; Better Auth's user/session/account/verification + invite,
                    project, audit), index.ts (getDb: Neon, or pglite:// for local), repo.ts (all queries)
drizzle/            Generated SQL migrations. Applied by scripts/migrate.mjs before every build.
src/lib/auth/       access.ts (who gets in: pure), server.ts (Better Auth config, getCurrentUser),
                    guard.ts (route-handler guards), page-guard.ts, enabled.ts (env check for proxy)
src/proxy.ts        Optional Basic Auth + redirect signed-out users to /sign-in (optimistic cookie check)
src/app/(app)/      All pages with the sidebar. sign-in/ lives outside the group (no sidebar).
src/lib/seo/compare.ts  "What changed" between two saved audits
src/app/<tool>/     One folder per tool: page.tsx (server, metadata) + <Tool>Client.tsx (client UI)
src/components/     Shared UI (CheckList, ScoreRing, SerpPreview, Sidebar). nav.ts lists tools.
```

## Conventions
- Every analyzer returns `Check[]`. Each check needs a stable `id`, a `weight` (1–10), and a `fix`
  whenever severity is `warn`/`fail`. The UI renders any `Check[]` with `<CheckList>`.
- New engine logic gets a co-located `*.test.ts`. Tests look checks up by `id`.
- Thresholds live in constants (e.g. `LIMITS` in copy.ts), not inline magic numbers.
- Adding a tool: create `src/app/<tool>/`, add it to `src/components/nav.ts` (status "live").
- Keep `src/lib/seo` free of Node-only APIs except `extract.ts` (Buffer) so the Content and URL
  tools can run fully client-side with live scoring.
- Theme: dark-only, built around brand orange `#F15A29`. Tokens live in `globals.css`
  (`bg-surface`, `bg-surface-2`, `text-muted`, `text-subtle`, `text-accent`, `text-pass`…) — use them,
  never raw Tailwind colors. Reusable classes: `.card .input .btn .btn-ghost .label .pill .chip .score-badge`.
  - Orange = brand, primary actions, focus and selection ONLY. Never use it for status.
  - Status: pass = emerald, warn = yellow, fail = rose, info = blue (kept distinct from orange).
  - Text on orange is near-black (`text-accent-fg`); white on #F15A29 fails contrast (~3.4:1).
- Secrets go in `.env.local` (git-ignored). Document new variables in `.env.example`.
- AI features must degrade gracefully when no API key is configured (feature visible but disabled).

- Site Audit design: the browser drives the crawl and calls /api/audit/page once per page, so no
  request runs long (serverless timeouts) and progress is live. Keep it that way.
- Keyword rules: informational (how-to) keywords never cluster or map with product/category ones.
  Page mapping needs the cluster's most distinctive term, not just shared generic words.

- Auth: sign-in is ON only when DATABASE_URL, BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID and
  GOOGLE_CLIENT_SECRET are all set; otherwise tools are open and saving is disabled (keep both modes
  working). Every API route calls a guard (`requireToolAccess` for tools, `requireActiveUser` /
  `requireAdmin` for data). The proxy check is optimistic, so never rely on it alone.
- cacheComponents: anything reading cookies/headers/searchParams (incl. getCurrentUser) must render
  inside <Suspense>. The (app) layout already wraps the sidebar and page content.
- Schema changes: edit schema.ts → `npm run db:generate` → commit the migration. Never edit applied
  migrations.
- Signed-in E2E test: scripts/e2e (local PGlite DB + seeded sessions; see its README).

- GEO checks use categories ai-access / answer-ready / trust / entity and are scored separately
  (report.geo). Saved reports from before GEO lack it, so keep `geo` optional in the UI.
- Every tool needs a Start over control (`StartOverButton`); Next keeps hidden routes' state alive
  (cacheComponents + Activity), so results persist across tabs until cleared.
- PDF text: built-in Helvetica can't render symbols like → ✓; pass strings through `t()` in pdf.tsx.
- Demo mode: PUBLIC_TOOLS=true opens only PUBLIC_TOOL_PATHS (enabled.ts). Never add data/admin routes.

- Responsive: sidebar only from `lg` (1024px); below that a top bar + Menu panel (Sidebar.tsx).
  Multi-column tool layouts switch at `xl` because lg leaves ~700px beside the sidebar.
  `main` has `min-w-0` and single-column `.grid`s default to `minmax(0,1fr)` (globals.css) so wide
  content scrolls inside its card instead of the page. Interactive controls ≥32px tall (`.btn`,
  `.btn-ghost` min-h-10, `.pill` min-h-8); no text under 11px except decorative mockups.
  Device sweep: `node scripts/e2e/mobile.cjs <outDir> <baseUrl>` (iPhone SE/14, Pixel 7, iPad).

- Planned tools (see PLAN.md): GEO Optimization (`/geo-optimization`, Week 3) and AI Visibility
  (`/ai-visibility`, Week 4) exist only as "soon" entries in `nav.ts` today. When building one, add
  `src/app/(app)/<tool>/` and flip its status to "live"; Week 2 turns nav.ts into a tool registry.
- AI features (Claude API, from Week 2): server-only code in `src/lib/ai/`, Anthropic TypeScript
  SDK, key from `ANTHROPIC_API_KEY` (Vercel only, never client-side). Default model
  `claude-opus-5-5`. Log token usage per user/project and enforce the daily cap. Every AI output is
  re-scored by the deterministic engine and must pass the fact-preservation check (no invented
  specs, prices or claims) before it's shown as acceptable. Prompt changes are measured against the
  evaluation set in `docs/eval/` before merging.

## Known limitations
- The Claude Code cloud sandbox can't resolve DNS directly, so live-URL analysis returns
  "Could not resolve" there. Test with "Paste HTML" mode or run locally/deployed.

## Development log

Add a row at the end of every session (newest at the bottom). Timestamps are local PST.

| Timestamp (LOCAL PST) | Tool / AI Model | Development Focus / Goal | Technical Intent & Summary |
| :--- | :--- | :--- | :--- |
| **2026-11-08 12:00PM** | Claude Code | Scaffolding | Set up the project foundation in Next.js 16, TypeScript and Tailwind, with GitHub Actions CI and deployment to Vercel. Wrote the first CLAUDE.md, PLAN.md and LOG.md so every session could pick up where the last ended. Defined the core architecture: a framework-free analysis engine where every check uses the same scoring format. |
| **2026-11-10 10:00PM** | Claude Code | Building | Built the Page Analyzer, Content Optimizer (with product specs), URL Optimizer, Site Audit crawler and Keyword Clusters. Added GEO scoring for AI search engines, PDF reports, Start over buttons, a redesigned homepage, and code-complete Google sign-in with saved project history. Tested everything with unit tests, browser tests and a phone/tablet sweep.|
| **2026-11-11 12:00AM** | Claude Code | Building/Documentation  | Rewrote PLAN.md as a justified Weeks 2–5 roadmap with deliverables, effort estimates, dependencies and risks. Updated CLAUDE.md with team workflow rules, the current-week process and guidelines for upcoming AI features. Added GEO Optimization alongside AI Visibility as coming-soon tools, and fixed a missing sidebar logo along the way.|
