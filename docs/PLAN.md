# SEO Studio — Plan

**Goal:** an internal, deployed SEO platform our team actually uses for page audits, copy
optimization, URL hygiene, site crawls and keyword planning.
**Course:** TCSS 490 Artifact 5 (moonshot). Final show & tell: **Monday, Dec 7, 2026**.
Weekly check-ins at Monday office hours (Weeks 6–9).

Status keys: `[x]` done · `[~]` in progress · `[ ]` not started

---

## Phase 0 — Scaffold & core engine (Week 5: Nov 2–8)
- [x] Next.js 16 + TypeScript + Tailwind project, CLAUDE.md, PLAN.md, LOG.md
- [x] SEO engine: shared `Check` contract + weighted scoring
- [x] Page Analyzer: URL or pasted HTML → 35+ checks (meta, headings, content, keywords, images,
      links, technical, social, URL), SERP preview, heading outline, top terms
- [x] SSRF-safe page fetcher (private IP blocking, redirect re-validation, size/time limits)
- [x] Content Optimizer: live scoring for title / meta / URL / body with content-type presets
- [x] URL Optimizer: bulk URL checks, slug suggestions, CSV redirect-map export
- [x] Unit tests for the engine (Vitest)
- [ ] Deploy to Vercel; share link with the team; collect first feedback
- [x] GitHub Actions CI: test + lint + build on every push

## Phase 1 — Accounts, projects & history (Week 6: Nov 9–15)
- [ ] Database: Postgres (Neon / Vercel Postgres) + Drizzle ORM; migrations in repo
- [ ] Auth: restrict to our team (Auth.js with Google sign-in limited to company domain)
- [ ] Projects: group URLs per site/client
- [ ] Save every analysis; history view with score-over-time chart and diff of checks
- [ ] Shareable report links + export report as PDF/CSV

## Phase 2 — AI copywriting (Week 7: Nov 16–22) — needs an API key
- [ ] `src/lib/ai/` provider interface (Claude by default), server-only, key from env
- [ ] "Rewrite with AI" in Content Optimizer: 3–5 title + meta variants, each auto-scored by the engine
- [ ] Product description generator (from bullet specs + keyword + tone)
- [ ] Brand voice / style guide settings per project
- [ ] Bulk mode: CSV of products in → optimized titles/metas/descriptions out
- [ ] Graceful fallback: template-based suggestions when no key is set

## Phase 3 — Site Audit crawler (Week 8: Nov 23–29, Thanksgiving week — lighter)
- [ ] robots.txt + sitemap.xml parsing and validation
- [ ] Crawl up to N pages (queue, concurrency limit, politeness delay)
- [ ] Site-wide issues: broken links (4xx/5xx), redirect chains, duplicate titles/metas, orphan
      pages, missing canonicals, noindex pages, thin content
- [ ] Background job + progress UI (long crawls exceed request timeouts)
- [ ] Core Web Vitals via Google PageSpeed Insights API (free key)

## Phase 4 — Keywords & polish (Week 9: Nov 30–Dec 6)
- [ ] Keyword clustering (lexical first, embeddings if AI key available) + map clusters to pages
- [ ] Keyword cannibalization detection across a project's pages
- [ ] Competitor compare: analyze two URLs side by side
- [ ] Polish, onboarding, empty states, docs; prepare the Dec 7 demo

## Stretch / backlog
- [ ] Google Search Console + GA4 integration (real clicks, impressions, rankings)
- [ ] Schema.org JSON-LD generator (Product, FAQ, Article, Breadcrumb)
- [ ] Internal-link suggestions
- [ ] hreflang validator
- [ ] Rank tracking (needs a paid SERP API, e.g. DataForSEO)
- [ ] Shopify / CMS import of product catalog
- [ ] Chrome extension: "analyze this page"

## Open decisions
- Hosting: Vercel (recommended; free tier, Next-native). Crawler may need a worker (Vercel cron / queue).
- AI provider: Claude via Anthropic API once a key is available.
- Search volume / rank data: requires a paid data API; out of scope unless the team funds it.
