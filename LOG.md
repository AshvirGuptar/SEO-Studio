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
