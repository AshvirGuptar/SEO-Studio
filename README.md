# SEO & GEO Studio

An internal toolkit for **SEO** (ranking in search engines) and **GEO** (generative engine optimization:
being found and cited by AI answer engines like ChatGPT search, Perplexity, Google AI Overviews and Claude).
Built as a TCSS 490 Artifact 5 moonshot.

**Live:** https://seo-studio-weld.vercel.app/

## Tools
| Tool | What it does | Status |
| --- | --- | --- |
| **Page Analyzer** | Audit a live URL or pasted HTML: SEO score + GEO score, AI crawler access, SERP preview, prioritized fixes, PDF report | Live |
| **Content Optimizer** | Score titles, meta descriptions, URLs and product/blog copy against a keyword as you type; Premium **AI rewrite** suggests titles, metas and descriptions, each re-scored and fact-checked | Live (AI rewrite needs an account + `ANTHROPIC_API_KEY`) |
| **URL Optimizer** | Bulk-check URLs, generate clean slugs, export a redirect map | Live |
| **Site Audit** | Crawl up to 500 pages: broken pages/links, redirects, duplicates, thin content, orphans, sitemap gaps, AI visibility, avg GEO score, PDF report | Live |
| **Keyword Clusters** | Group keywords by topic and intent, map them to pages, find content gaps and cannibalization | Live |
| **Guide** | Step-by-step playbook for site and store owners | Live |
| GEO Optimization | Fix GEO issues: answer-first rewrites, FAQ + schema markup, llms.txt and AI-crawler rules, re-scored before publishing | Coming soon (Week 3, needs Claude API key) |
| **AI Visibility** | Ask Claude (with web search) the questions customers ask; track brand mentions, citations, share of voice vs competitors and the trend, weekly on a schedule | Live (needs a database + `ANTHROPIC_API_KEY`; sign-in optional) |
| **Projects & History** | Save audits per site or client, chart scores over time, see what changed between runs | Live (needs sign-in) |
| **Team & access** | UW email accounts, invites, admin/member/client roles, password resets, AI budget, admin activity log | Live (needs sign-in) |

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
- **Only `@uw.edu` addresses can create accounts**, and they get in straight away (knowing a UW
  address is the "key"; emails aren't verified). Change with `SIGNUP_DOMAINS` (comma-separated, or
  `*` for anyone, who then wait for approval).
- `ADMIN_EMAILS` addresses are admins and get in straight away.
- `APPROVED_EMAILS` addresses get in straight away as members (handy for testers).
- Emails an admin invited (Team & access → Invite) get in straight away as that role.
- Everyone else sees **Access requested** until an admin approves them on Team & access.

**Forgot password?** on the sign-in page emails a one-time reset link (valid 60 minutes) when email
is configured (see below); other signed-in devices are signed out after the reset. Without email
settings it falls back to admin approval: the person enters their email and gets a 4-character code; the request appears on Team & access with the same code. The admin checks
the code with them (text/chat) and clicks **Approve**; the person's page then asks for a new password
(only on the device that made the request, within 24 hours) and signs them in. Admins can't approve
their own reset, and each account can request 3 per day. Signed-in users change their password on
the **Account** page. Sign-in, sign-up and password changes are rate limited (10 per minute per IP
for sign-in, 10 per 10 minutes for sign-up). Because addresses aren't verified, admins should create
their accounts right after the first deploy so nobody else can register those emails first.

**1. Database.** Add Neon from the Vercel project's **Storage** tab (sets `DATABASE_URL`). Tables are
created automatically on the next deploy (`scripts/migrate.mjs` runs before every build).

**2. Vercel environment variables** (Settings → Environment Variables, **Production**):

| Variable | Value |
| --- | --- |
| `BETTER_AUTH_SECRET` | output of `openssl rand -base64 32` (any long random string) |
| `ADMIN_EMAILS` | your email (comma-separate several). These people are always admins. |
| `APPROVED_EMAILS` | optional: emails approved as members on sign-up (comma-separated) |
| `PUBLIC_TOOLS` | optional `false`: put the free tools behind sign-in too (default: free tools are public) |

**3. Redeploy** (Deployments → ⋯ → Redeploy), open `/sign-in`, choose **Create account** and use an
`ADMIN_EMAILS` address.

Optional: "Continue with Google" appears too if `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set
(OAuth client with redirect URI `https://<site>/api/auth/callback/google`, published consent screen).
With Google on, `AUTO_APPROVE_DOMAINS` (e.g. `uw.edu`) approves Google sign-ins from those domains.

### Email (password-reset links)
The app sends email through any SMTP account; a Gmail account with an App password is the simplest:
1. In the Gmail account's Google Account → **Security**, turn on **2-Step Verification**.
2. Search the Google Account settings for **App passwords**, create one (name it "SEO Studio") and copy
   the 16-character password.
3. In Vercel add `SMTP_USER` = the Gmail address and `SMTP_PASSWORD` = the app password (no spaces),
   then redeploy.

To check it, open **Team & access**: the "Password-reset emails" card says whether email is on and has a
**Send test email** button that sends to you and explains any failure (for example a rejected app
password). A failed reset email is otherwise invisible to the person, who still sees "check your
email" so the form can't reveal which addresses have accounts; it's logged as `[email] …` in Vercel.

Optional: `SMTP_HOST` (default `smtp.gmail.com`), `SMTP_PORT` (default `465`), `EMAIL_FROM`
(default `"SEO & GEO Studio" <SMTP_USER>`). Gmail allows about 500 emails a day. Reset requests are
rate limited (3 per 10 minutes per IP). Proton addresses on `@proton.me` can't send via SMTP.

## AI features (Claude API)
AI Visibility (Claude with web search) and AI rewrite in the Content Optimizer use the Claude API. Set
these in Vercel (Production) and redeploy:

| Variable | Value |
| --- | --- |
| `ANTHROPIC_API_KEY` | from console.anthropic.com. Without it, AI buttons stay visible but disabled. |
| `AI_DAILY_USER_LIMIT_USD` | optional, default `2`: what one person can spend per day (UTC) |
| `AI_MONTHLY_BUDGET_USD` | optional, default `10`: app-wide monthly cap; AI pauses when it's reached. Admins are emailed at 50%, 80% and 100% (needs the email settings) |
| `CRON_SECRET` | any long random string. Vercel sends it to `/api/cron/visibility` (see `vercel.json`) for weekly scheduled runs. |

An AI Visibility run costs roughly $0.05–$0.10 per question (the page shows an estimate first); an AI
rewrite about $0.02–$0.05. Every request is logged in the `ai_usage` table with its tokens and cost, and
Team & access shows this month's spending. AI rewrite never invents facts on purpose, and the app
checks: every suggestion is re-scored by our engine and fact-checked (no new numbers, prices or claims
such as "free shipping") before it's shown as acceptable. Prompt changes are measured against the
evaluation set in [`docs/eval/`](docs/eval/README.md).

The public tool APIs are rate limited per IP (Page Analyzer 20/min, Site Audit start 10/min and pages
300/min; AI rewrite 10/min per person), and request sizes are capped.

## Access model
- People create accounts with their UW email (see Sign-in setup); `ADMIN_EMAILS` → admin,
  `APPROVED_EMAILS` → member, invited emails → the invited role.
- **Admins**: manage people, invites, roles and client projects; delete any project or audit; see the
  AI budget and the admin activity log on **Team & access**.
  **Members**: use every tool, create projects, save audits, run AI features, delete their own.
  **Clients (read-only)**: see only the projects an admin assigned them (audits, history, AI Visibility
  results); they can't create, save, edit, delete or run AI. Invite them with the **Client** role and a
  project, or switch an existing person to Client and tick their projects.
- Every admin change (invites, roles, client projects, password resets, test emails) is logged.
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

### Adding a tool
1. Create `src/app/(app)/<tool>/` with `page.tsx` (server, metadata) and `<Tool>Client.tsx`.
2. Add one entry to `TOOLS` in `src/components/nav.ts`: name, blurb, status, tags, use cases, and
   `premium` (uses the Claude API) or `needsAuth` (saved data) as needed. The sidebar and homepage
   read from it.
3. Free tools: add the page and API paths to `PUBLIC_TOOL_PATHS` in `src/lib/auth/enabled.ts`.
   Premium tools: add the page to `PREMIUM_TOOL_PATHS` and gate it with `premiumPageAccess()` +
   `<PremiumGate>`. Tests fail if `nav.ts` and these lists disagree.
4. Optional: a homepage preview and icon in `src/app/(app)/home/ToolPreview.tsx`.

## Local development with a database
```bash
echo 'DATABASE_URL=pglite://./.data/dev-db' >> .env.local   # embedded Postgres, no Neon needed
npm run db:migrate
npm run dev
```
After changing `src/lib/db/schema.ts`, run `npm run db:generate` and commit the new file in `/drizzle`.
