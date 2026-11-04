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

## Deploying
The app is a standard Next.js project. To deploy on [Vercel](https://vercel.com): import the GitHub
repo, accept the defaults, and deploy. Add environment variables from `.env.example` as features
need them.
