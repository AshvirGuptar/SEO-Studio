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
If only a database is connected (Vercel → Storage → Neon, which sets `DATABASE_URL`) and
`BETTER_AUTH_SECRET` isn't set, the app runs in **open mode**: no login, and everyone who can reach
the site shares one "Team" account. Projects, Save to project and AI Visibility work; Team & access is
off; the daily AI limit (`AI_DAILY_USER_LIMIT_USD`) is shared by everyone, and the monthly budget still
applies. **Anyone with the link can spend AI credits**, so add `SITE_PASSWORD` (see Deploying) or set up
sign-in when the app should be private. Setting `BETTER_AUTH_SECRET` switches to per-person accounts.

## Sign-in setup (email + password)
Accounts, per-person Projects & History and Team & access turn on once a database and
`BETTER_AUTH_SECRET` are configured. People create an account with their email and a password
(8+ characters).

Who gets in:
- `ADMIN_EMAILS` addresses are admins and get in straight away.
- Emails an admin invited (Team & access → Invite) get in straight away as that role.
- Everyone else sees **Access requested** until an admin approves them on Team & access.

No emails are sent. Forgotten password: an admin clicks **Reset password** on Team & access, which
shows a one-time temporary password and signs that person out everywhere; they then change it on
their **Account** page. Sign-in, sign-up and password changes are rate limited (5 per minute per IP
for sign-in, 5 per 10 minutes for sign-up). Because addresses aren't verified, admins should create
their accounts right after the first deploy so nobody else can register those emails first.

**1. Database.** Add Neon from the Vercel project's **Storage** tab (sets `DATABASE_URL`). Tables are
created automatically on the next deploy (`scripts/migrate.mjs` runs before every build).

**2. Vercel environment variables** (Settings → Environment Variables, **Production**):

| Variable | Value |
| --- | --- |
| `BETTER_AUTH_SECRET` | output of `openssl rand -base64 32` (any long random string) |
| `ADMIN_EMAILS` | your email (comma-separate several). These people are always admins. |
| `PUBLIC_TOOLS` | optional `false`: put the free tools behind sign-in too (default: free tools are public) |

**3. Redeploy** (Deployments → ⋯ → Redeploy), open `/sign-in`, choose **Create account** and use an
`ADMIN_EMAILS` address.

Optional: "Continue with Google" appears too if `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set
(OAuth client with redirect URI `https://<site>/api/auth/callback/google`, published consent screen).
With Google on, `AUTO_APPROVE_DOMAINS` (e.g. `uw.edu`) approves Google sign-ins from those domains.

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

### Free vs. Premium tools
The free analysis tools (Page Analyzer, Content/URL Optimizer, Site Audit, Keyword Clusters, Guide)
work for anyone without an account. **Premium** tools use the Claude API (AI Visibility, and GEO
Optimization when it ships); they show a gold crown and need an approved account. Signed-out visitors
who open one see "only for approved users" with **Sign in** / **Request access**; people waiting for
approval can keep using the free tools. Projects and saved audits also need an account. The APIs
behind premium tools and saved data always check for an approved user. To mark a new tool premium,
set `premium: true` in `src/components/nav.ts`, add its path to `PREMIUM_TOOL_PATHS` in
`src/lib/auth/enabled.ts` and use `premiumPageAccess()` + `<PremiumGate>` on its page.
Set `PUBLIC_TOOLS=false` to put the free tools behind sign-in as well.

## Local development with a database
```bash
echo 'DATABASE_URL=pglite://./.data/dev-db' >> .env.local   # embedded Postgres, no Neon needed
npm run db:migrate
npm run dev
```
After changing `src/lib/db/schema.ts`, run `npm run db:generate` and commit the new file in `/drizzle`.
