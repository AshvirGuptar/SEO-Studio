# SEO Studio

An internal SEO toolkit for auditing pages, optimizing copy and building SEO-friendly URLs.
Built as a TCSS 490 Artifact 5 moonshot.

**Live:** https://seo-studio-weld.vercel.app/

## Tools
| Tool | What it does | Status |
| --- | --- | --- |
| **Page Analyzer** | Audit a live URL or pasted HTML: 35+ on-page checks, score, SERP preview, prioritized fixes | Live |
| **Content Optimizer** | Score titles, meta descriptions, URLs and product/blog copy against a keyword as you type | Live |
| **URL Optimizer** | Bulk-check URLs, generate clean slugs, export a redirect map | Live |
| **Site Audit** | Crawl up to 500 pages: broken pages/links, redirects, duplicates, thin content, orphans, sitemap gaps | Live |
| **Keyword Clusters** | Group keywords by topic and intent, map them to pages, find content gaps and cannibalization | Live |
| **Guide** | Step-by-step playbook for site and store owners | Live |
| **Projects & History** | Save audits per site or client, chart scores over time, see what changed between runs | Live (needs sign-in) |
| **Team & access** | Google sign-in, invite-only access, admin/member roles, approve requests | Live (needs sign-in) |
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

## Access model
- Everyone signs in with Google (any email address can be a Google account, not just Gmail).
- `ADMIN_EMAILS` → admin. `AUTO_APPROVE_DOMAINS` → member. Invited emails → the invited role.
- Anyone else lands on "Access requested"; admins approve or deny them under **Team & access**.
- **Admins**: manage people, invites and roles; delete any project or audit.
  **Members**: use every tool, create projects, save audits, delete their own.
- Preview deployments have no Google redirect registered, so sign-in only works on production;
  previews still run the tools.
- Optional extra lock: `SITE_PASSWORD` puts HTTP Basic Auth in front of everything (`src/proxy.ts`).

## Local development with a database
```bash
echo 'DATABASE_URL=pglite://./.data/dev-db' >> .env.local   # embedded Postgres, no Neon needed
npm run db:migrate
npm run dev
```
After changing `src/lib/db/schema.ts`, run `npm run db:generate` and commit the new file in `/drizzle`.
