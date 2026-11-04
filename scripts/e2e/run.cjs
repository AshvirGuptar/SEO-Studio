const { chromium } = require('playwright');
const crypto = require('crypto');
const BASE = 'http://localhost:3123';
const SECRET = 'e2e-test-secret-0123456789abcdefghijklmnop';
const cookieFor = (token) => {
  const sig = crypto.createHmac('sha256', SECRET).update(token).digest('base64');
  return { name: 'better-auth.session_token', value: encodeURIComponent(`${token}.${sig}`), domain: 'localhost', path: '/' };
};
const S = 'https://shop.trailco.com';
const BAD = `<html><head><title>boots</title></head><body><h1>Boots</h1><p>Some boots.</p><img src="a.jpg"></body></html>`;
const GOOD = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>Hiking Boots for Every Trail | TrailCo</title>
<meta name="description" content="Shop waterproof hiking boots built for wet, rocky trails. Free shipping and 60-day returns on every pair from TrailCo.">
<link rel="canonical" href="${S}/hiking-boots"></head><body><h1>Hiking Boots</h1><h2>Fit</h2><p>${'Hiking boots that keep you comfortable on every trail. '.repeat(30)}</p>
<img src="a.jpg" alt="hiking boots"><a href="/a">Trail shoes</a><a href="/b">Socks</a><a href="/c">Sizing</a></body></html>`;
const page = (url, o = {}) => ({ url, depth: 1, status: 200, redirects: 0, elapsedMs: 250, title: 'T ' + url, metaDescription: 'M ' + url, h1Count: 1, wordCount: 600, canonical: url, noindex: false, score: 85, imagesMissingAlt: 0, internalLinks: [], ...o });
function mockCrawl(p, broken) {
  return Promise.all([
    p.route('**/api/audit/discover', r => r.fulfill({ json: { startUrl: S + '/', origin: S, robotsFound: true, robots: { allow: [], disallow: [], sitemaps: [] }, sitemapFiles: [], sitemapUrls: [] } })),
    p.route('**/api/audit/page', r => {
      const { url, depth } = JSON.parse(r.request().postData());
      const site = {
        [S + '/']: page(S + '/', { depth: 0, internalLinks: [S + '/a', S + '/b', ...(broken ? [S + '/gone'] : [])] }),
        [S + '/a']: page(S + '/a', { wordCount: broken ? 50 : 600 }),
        [S + '/b']: page(S + '/b'),
        [S + '/gone']: page(S + '/gone', { status: 404 }),
      };
      r.fulfill({ json: { ...(site[url] || page(url, { status: 404 })), depth } });
    }),
  ]);
}
const log = (...a) => console.log('•', ...a);
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('  ✗ FAIL:', msg); } else console.log('  ✓', msg); };

(async () => {
  const b = await chromium.launch();
  const errors = [];

  // 1. Signed out
  log('signed out');
  const anon = await b.newPage();
  anon.on('pageerror', e => errors.push('anon: ' + e.message));
  await anon.goto(BASE + '/projects');
  check(anon.url().includes('/sign-in?next=%2Fprojects'), 'redirected to /sign-in with next param');
  check(await anon.locator('text=Continue with Google').count() === 1, 'Google button shown');
  const api = await anon.request.post(BASE + '/api/analyze', { data: { html: '<p>x</p>' } });
  check(api.status() === 401, `tool API requires sign-in (got ${api.status()})`);

  // 2. Pending user
  log('pending user');
  const pctx = await b.newContext(); await pctx.addCookies([cookieFor('tok-u-pending')]);
  const pend = await pctx.newPage();
  await pend.goto(BASE + '/');
  await pend.waitForSelector('text=Access requested');
  check(true, 'pending user sees Access requested');
  const papi = await pend.request.get(BASE + '/api/projects');
  check(papi.status() === 403, `pending user blocked from API (got ${papi.status()})`);

  // 3. Admin flow
  log('admin');
  const actx = await b.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2 });
  await actx.addCookies([cookieFor('tok-u-admin')]);
  const a = await actx.newPage();
  a.on('pageerror', e => errors.push('admin: ' + e.message));
  a.on('console', m => m.type() === 'error' && errors.push('admin console: ' + m.text()));
  await a.goto(BASE + '/', { waitUntil: 'networkidle' });
  check(await a.locator('nav >> text=Team & access').count() === 1, 'admin sees Team & access');
  check(await a.locator('nav a:has-text("Projects & History")').count() === 1, 'Projects is a live link');
  check(await a.locator('nav >> text=Ada Admin').count() === 1, 'user shown in sidebar');

  async function analyzeAndSave(html, projectChoice) {
    await a.goto(BASE + '/analyzer', { waitUntil: 'networkidle' });
    await a.click('text=Paste HTML');
    await a.fill('#url', S + '/hiking-boots');
    await a.fill('#kw', 'hiking boots');
    await a.fill('#html', html);
    await a.click('button:has-text("Analyze page")');
    await a.waitForSelector('text=Recommendations');
    await a.click('button:has-text("Save to project")');
    await a.waitForSelector('#save-project');
    if (projectChoice === 'new') {
      await a.selectOption('#save-project', 'new');
      await a.fill('#save-new', 'TrailCo');
    }
    await a.click('button:has-text("Save"):not(:has-text("to project"))');
    await a.waitForSelector('text=✓ Saved');
  }
  await analyzeAndSave(BAD, 'new');
  check(true, 'saved first page audit to new project');
  await analyzeAndSave(GOOD, 'existing');
  check(true, 'saved second page audit (project auto-selected by domain)');

  // site audits
  for (const broken of [true, false]) {
    await a.unrouteAll();
    await mockCrawl(a, broken);
    await a.goto(BASE + '/audit', { waitUntil: 'networkidle' });
    await a.fill('#site', S);
    await a.click('text=Start audit');
    await a.waitForSelector('text=Finished:');
    await a.click('button:has-text("Save to project")');
    await a.waitForSelector('#save-project');
    await a.click('button:has-text("Save"):not(:has-text("to project"))');
    await a.waitForSelector('text=✓ Saved');
  }
  await a.unrouteAll();
  check(true, 'saved two site audits');

  await a.goto(BASE + '/projects', { waitUntil: 'networkidle' });
  check(await a.locator('text=4 saved audits').count() === 1, 'project card shows 4 saved audits');
  await a.screenshot({ path: 'scripts/e2e/screenshots/projects.png' });
  await a.click('text=TrailCo');
  await a.waitForSelector('text=Site health over time');
  check(await a.locator('text=Tracked pages').count() === 1, 'tracked pages table');
  check(await a.locator('td >> text=▲').count() === 1, 'score improvement shown');
  await a.hover('figure svg', { position: { x: 600, y: 80 } });
  check(await a.locator('figure >> text=/Score \\d+/').count() >= 1, 'chart tooltip on hover');
  await a.screenshot({ path: 'scripts/e2e/screenshots/project.png', fullPage: true });

  await a.click('table >> nth=0 >> a >> nth=0');
  await a.waitForSelector('text=What changed since the last check');
  check(await a.locator('text=✓ Fixed').count() === 1, 'page diff shows fixed issues');
  await a.screenshot({ path: 'scripts/e2e/screenshots/saved-page.png', fullPage: false });
  await a.goBack();
  await a.waitForSelector('text=All saved audits');
  await a.locator('tr:has(td:text-is("Site audit")) a').first().click();
  await a.waitForSelector('text=What changed since the last audit');
  check(await a.locator('text=Internal links to broken pages').count() >= 1, 'site diff lists resolved broken links');
  await a.screenshot({ path: 'scripts/e2e/screenshots/saved-site.png', fullPage: false });

  // admin page
  await a.goto(BASE + '/admin', { waitUntil: 'networkidle' });
  check(await a.locator('text=Waiting for approval (1)').count() === 1, 'pending request listed');
  await a.screenshot({ path: 'scripts/e2e/screenshots/admin.png', fullPage: true });
  await a.fill('#inv-email', 'Freelancer@Gmail.com');
  await a.click('button:has-text("Invite")');
  await a.waitForSelector('text=freelancer@gmail.com');
  check(true, 'invite created (lowercased)');
  await a.click('button:has-text("Approve")');
  await a.waitForSelector('text=Waiting for approval', { state: 'detached' });
  check(true, 'approved pending user');
  await pend.goto(BASE + '/');
  check(await pend.locator('text=Access requested').count() === 0, 'approved user now gets in');

  // 4. Member
  log('member');
  const mctx = await b.newContext(); await mctx.addCookies([cookieFor('tok-u-member')]);
  const m = await mctx.newPage();
  await m.goto(BASE + '/', { waitUntil: 'networkidle' });
  check(await m.locator('nav >> text=Team & access').count() === 0, 'member has no admin link');
  await m.goto(BASE + '/admin', { waitUntil: 'networkidle' });
  const adminHtml = await m.content();
  check(adminHtml.includes('could not be found') && !adminHtml.includes('Invite by email'), 'member sees 404 page on /admin, no admin data');
  const mapi = await m.request.get(BASE + '/api/admin/users');
  check(mapi.status() === 403, `member blocked from admin API (got ${mapi.status()})`);
  await m.goto(BASE + '/projects', { waitUntil: 'networkidle' });
  await m.click('text=TrailCo');
  await m.waitForSelector('text=Tracked pages');
  check(await m.locator('button:has-text("Delete")').count() === 0, 'member cannot delete admin-created project or audits');
  const mobile = await b.newContext({ viewport: { width: 390, height: 844 } });
  await mobile.addCookies([cookieFor('tok-u-admin')]);
  const mp = await mobile.newPage();
  for (const path of ['/projects', '/admin']) {
    await mp.goto(BASE + path, { waitUntil: 'networkidle' });
    const o = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(o <= 0, `no horizontal overflow on ${path} at phone width (${o}px)`);
  }

  console.log('\nbrowser errors:', errors);
  console.log(failures ? `${failures} FAILURE(S)` : 'ALL CHECKS PASSED');
  await b.close();
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
