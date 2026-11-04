# SEO Studio

An internal SEO toolkit for auditing pages, optimizing copy and building SEO-friendly URLs.
Built as a TCSS 490 Artifact 5 moonshot.

## Tools
| Tool | What it does | Status |
| --- | --- | --- |
| **Page Analyzer** | Audit a live URL or pasted HTML: 35+ on-page checks, score, SERP preview, prioritized fixes | Live |
| **Content Optimizer** | Score titles, meta descriptions, URLs and product/blog copy against a keyword as you type | Live |
| **URL Optimizer** | Bulk-check URLs, generate clean slugs, export a redirect map | Live |
| Keyword Clusters | Group keywords by intent and map them to pages | Planned |
| Site Audit | Crawl a site for broken links, duplicates and missing tags | Planned |
| Projects & History | Save audits and track scores over time | Planned |
| AI Rewrite | Generate optimized titles, metas and descriptions | Planned (needs API key) |

Roadmap: [`docs/PLAN.md`](docs/PLAN.md) · Development log: [`LOG.md`](LOG.md)

## Getting started
```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests
npm run build    # production build
```

## Deploying (Vercel)
1. Import the GitHub repo at vercel.com/new (framework is auto-detected; keep the defaults).
2. In **Settings → Environment Variables**, set `SITE_PASSWORD` (and optionally `SITE_USERNAME`,
   default `team`) to turn on the site-wide password gate. Redeploy after changing variables.
3. Pushes to the production branch deploy to the main URL; other branches get preview URLs.

## Access
Until team sign-in lands (Phase 1), the whole site — pages and API — is behind HTTP Basic Auth
when `SITE_PASSWORD` is set (`src/proxy.ts`). With it unset (local dev) the site is open.
