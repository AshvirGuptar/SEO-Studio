# End-to-end test (signed-in flows)

Runs the real app with sign-in enabled against a local embedded database, seeds an admin, a
member and a pending user with valid session cookies, and drives a browser through: sign-in
redirects, the pending-access screen, saving page and site audits to a project, history/charts,
"what changed" diffs, the admin page (invite + approve), member restrictions and phone layouts.
Google itself is never contacted. Sessions are created directly in the database.

```bash
export DATABASE_URL=pglite://./.data/e2e-db BETTER_AUTH_SECRET=e2e-test-secret-0123456789abcdefghijklmnop \
  GOOGLE_CLIENT_ID=test GOOGLE_CLIENT_SECRET=test BETTER_AUTH_URL=http://localhost:3123 \
  ADMIN_EMAILS=admin@acme.com AUTO_APPROVE_DOMAINS=acme.com
rm -rf .data/e2e-db && npm run build && node scripts/e2e/seed.mjs
npx next start -p 3123 &
mkdir -p scripts/e2e/screenshots && node scripts/e2e/run.cjs
```

Requires Playwright with Chromium (`npm i -D playwright && npx playwright install chromium`).
Screenshots land in `scripts/e2e/screenshots/` (git-ignored).
