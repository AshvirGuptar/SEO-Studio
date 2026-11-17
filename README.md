# SEO & GEO Studio

An internal toolkit for **SEO** (ranking in search engines) and **GEO** (generative engine optimization:
being found and cited by AI answer engines like ChatGPT search, Perplexity, Google AI Overviews and Claude).
Built as a TCSS 490 Artifact 5 moonshot.

**Live:** https://seo-studio-weld.vercel.app/

## Tools
| Tool | What it does | Status |
| --- | --- | --- |
| **Page Analyzer** | Audit a live URL or pasted HTML: SEO score + GEO score, AI crawler access, SERP preview, prioritized fixes, PDF report | Live |
| **Content Optimizer** | Score titles, meta descriptions, URLs and product/blog copy against a keyword as you type | Live |
| **URL Optimizer** | Bulk-check URLs, generate clean slugs, export a redirect map | Live |
| **Site Audit** | Crawl up to 500 pages: broken pages/links, redirects, duplicates, thin content, orphans, sitemap gaps, AI visibility, avg GEO score, PDF report | Live |
| **Keyword Clusters** | Group keywords by topic and intent, map them to pages, find content gaps and cannibalization | Live |
| **Guide** | Step-by-step playbook for site and store owners | Live |
| GEO Optimization | Fix GEO issues: answer-first rewrites, FAQ + schema markup, llms.txt and AI-crawler rules, re-scored before publishing | Coming soon (Week 3, needs Claude API key) |
| **AI Visibility** | Ask Claude (with web search) the questions customers ask; track brand mentions, citations, share of voice vs competitors and the trend, weekly on a schedule | Live (needs a database + `ANTHROPIC_API_KEY`; sign-in optional) |
| **Projects & History** | Save audits per site or client, chart scores over time, see what changed between runs | Live (needs sign-in) |
| **Team & access** | Google sign-in, invite-only access, admin/member roles, approve requests | Live (needs sign-in) |
| AI Rewrite | Generate optimized titles, metas and descriptions | Planned (needs API key) |

Roadmap: [`PLAN.md`](PLAN.md) · Agent guide and development log: [`CLAUDE.md`](CLAUDE.md)

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

## Open mode (no sign-in yet)
If only a database is connected (Vercel → Storage → Neon, which sets `DATABASE_URL`) and the Google
sign-in variables below aren't set, the app runs in **open mode**: no login, and everyone who can reach
the site shares one "Team" account. Projects, Save to project and AI Visibility work; Team & access is
off; the daily AI limit (`AI_DAILY_USER_LIMIT_USD`) is shared by everyone, and the monthly budget still
applies. **Anyone with the link can spend AI credits**, so add `SITE_PASSWORD` (see Deploying) or set up
sign-in when the app should be private. Setting the sign-in variables switches to per-person accounts.

## Sign-in setup (Google)
Sign-in, Projects & History and Team & access turn on once these are configured. Until then the
tools work without an account and saving is unavailable.

**1. Database.** Add Neon from the Vercel project's **Storage** tab (sets `DATABASE_URL`). Tables are
created automatically on the next deploy (`scripts/migrate.mjs` runs before every build).

**2. Google OAuth client.** In [Google Cloud Console](https://console.cloud.google.com/):
1. Create (or pick) a project.
2. **APIs & Services → OAuth consent screen**: choose **External**, enter the app name
   (SEO Studio) and a support email. Under **Audience**, click **Publish app** so any Google account
   can sign in. Only basic profile/email scopes are used, so no Google review is needed.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized JavaScript origin: `https://seo-studio-weld.vercel.app`
   - Authorized redirect URI: `https://seo-studio-weld.vercel.app/api/auth/callback/google`
   - (For local development also add `http://localhost:3000` and `http://localhost:3000/api/auth/callback/google`.)
4. Copy the **Client ID** and **Client secret**.

**3. Vercel environment variables** (Settings → Environment Variables, **Production**):

| Variable | Value |
| --- | --- |
| `BETTER_AUTH_SECRET` | output of `openssl rand -base64 32` (any long random string) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from step 2 |
| `ADMIN_EMAILS` | your email (comma-separate several). These people are always admins. |
| `AUTO_APPROVE_DOMAINS` | optional, e.g. `company.com`: teammates get in without approval |

**4. Redeploy** (Deployments → ⋯ → Redeploy) and sign in with an `ADMIN_EMAILS` address.

## AI features (Claude API)
AI Visibility uses Claude with web search. Set these in Vercel (Production) and redeploy:

| Variable | Value |
| --- | --- |
| `ANTHROPIC_API_KEY` | from console.anthropic.com. Without it, AI buttons stay visible but disabled. |
| `AI_DAILY_USER_LIMIT_USD` | optional, default `5`: what one person can spend per day (UTC) |
| `AI_MONTHLY_BUDGET_USD` | optional, default `50`: app-wide monthly cap; runs stop when it's reached |
| `CRON_SECRET` | any long random string. Vercel sends it to `/api/cron/visibility` (see `vercel.json`) for weekly scheduled runs. |

A run costs roughly $0.05–$0.10 per prompt (the page shows an estimate first). Every request is logged
in the `ai_usage` table with its tokens and cost.

## Access model
- Everyone signs in with Google (any email address can be a Google account, not just Gmail).
- `ADMIN_EMAILS` → admin. `AUTO_APPROVE_DOMAINS` → member. Invited emails → the invited role.
- Anyone else lands on "Access requested"; admins approve or deny them under **Team & access**.
- **Admins**: manage people, invites and roles; delete any project or audit.
  **Members**: use every tool, create projects, save audits, delete their own.
- Preview deployments have no Google redirect registered, so sign-in only works on production;
  previews still run the tools.
- Optional extra lock: `SITE_PASSWORD` puts HTTP Basic Auth in front of everything (`src/proxy.ts`).

### Giving specific people access
Put their emails in `ADMIN_EMAILS` (comma-separated) to make them admins, e.g.
`ADMIN_EMAILS=you@gmail.com,colleague@gmail.com`. For members, an admin uses **Team & access → Invite**
(works for any email address, Gmail included). Changes to env vars need a redeploy.

### Demo mode (`PUBLIC_TOOLS=true`)
For an in-person demo where people use the tools from their own phones: set `PUBLIC_TOOLS=true` in
Vercel and redeploy. The analysis tools (Page Analyzer, Content/URL Optimizer, Site Audit, Keyword
Clusters, Guide) work without signing in; **Projects, saved audits and Team & access still require an
approved account**, so saved data stays private. Delete the variable and redeploy afterwards.

## Local development with a database
```bash
echo 'DATABASE_URL=pglite://./.data/dev-db' >> .env.local   # embedded Postgres, no Neon needed
npm run db:migrate
npm run dev
```
After changing `src/lib/db/schema.ts`, run `npm run db:generate` and commit the new file in `/drizzle`.
