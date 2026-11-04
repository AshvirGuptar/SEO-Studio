# SEO Studio — agent guide

@AGENTS.md

Internal SEO toolkit (think "Semrush for our team"): page audits, content/copy optimization,
URL/slug tools, and later site crawls, keyword clustering, history and AI rewriting.
Also the TCSS 490 Artifact 5 moonshot — see `docs/PLAN.md` for the roadmap and `LOG.md` for history.

## Start of every session
1. Read the latest entries in `LOG.md` and the current phase in `docs/PLAN.md`.
2. Run `npm test` to confirm a green baseline.
3. At the end of the session, append a dated entry to `LOG.md` (what changed, decisions, next steps)
   and tick off items in `docs/PLAN.md`.

## Commands
- `npm run dev` — dev server (http://localhost:3000)
- `npm test` — Vitest unit tests (`src/**/*.test.ts`)
- `npm run lint` / `npm run typecheck` / `npm run build`
- Before committing: `npm test && npm run lint && npm run build` must all pass.

## Stack
Next.js 16 (App Router, `src/` dir) · React 19 · TypeScript (strict) · Tailwind v4 · cheerio (HTML parsing)
· zod (request validation) · Vitest. Next 16 differs from older versions — check
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
src/lib/net/        Server-only networking. fetch-page.ts has SSRF protection — ALWAYS use it
                    to fetch user-supplied URLs; never call fetch() on user input directly.
src/app/api/*       Route handlers (validate input with zod, return JSON)
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

## Known limitations
- The Claude Code cloud sandbox can't resolve DNS directly, so live-URL analysis returns
  "Could not resolve" there. Test with "Paste HTML" mode or run locally/deployed.
