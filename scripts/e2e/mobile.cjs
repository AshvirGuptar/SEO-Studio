const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || 'scripts/e2e/screenshots/mobile';
const B = process.argv[3] || 'http://localhost:3124';
const GOOD = fs.readFileSync('/home/user/SEO-Studio/src/lib/seo/geo.test.ts', 'utf8').match(/const GOOD = `([\s\S]*?)`;/)[1];
const S = 'https://shop.example-pc.com';
const P = (url, o = {}) => ({ url, depth: 1, status: 200, redirects: 0, elapsedMs: 300, title: 'Graphics cards ' + url, metaDescription: 'Meta ' + url, h1Count: 1, wordCount: 520, canonical: url, noindex: false, score: 84, geoScore: 61, imagesMissingAlt: 0, internalLinks: [], ...o });
const SITE = { [S + '/']: P(S + '/', { depth: 0, internalLinks: [S + '/graphics-cards', S + '/b', S + '/gone'] }), [S + '/graphics-cards']: P(S + '/graphics-cards', { wordCount: 80 }), [S + '/b']: P(S + '/b'), [S + '/gone']: P(S + '/gone', { status: 404, score: undefined, geoScore: undefined }) };

const DEVICES = {
  'iphone-se': devices['iPhone SE'],
  'iphone-14': devices['iPhone 14'],
  'pixel-7': devices['Pixel 7'],
  'ipad-mini': devices['iPad Mini'],
  'ipad-landscape': devices['iPad Pro 11 landscape'] || { ...devices['iPad Mini landscape'] },
};

async function prepare(p, path) {
  await p.goto(B + path, { waitUntil: 'networkidle' });
  if (path === '/analyzer') {
    await p.click('text=Paste HTML'); await p.fill('#url', 'https://shop.example-pc.com/guides/gpu'); await p.fill('#kw', 'graphics card'); await p.fill('#html', GOOD);
    await p.click('button:has-text("Analyze page")'); await p.waitForSelector('text=Recommendations');
  }
  if (path === '/content') {
    await p.fill('#kw', '1440p graphics card');
    await p.fill('input[placeholder^="Aurora"]', 'Aurora 12GB Graphics Card for 1440p Gaming | Example PC');
    await p.fill('textarea[placeholder^="Shop the Aurora"]', 'Shop the Aurora 12GB graphics card for smooth 1440p gaming. PCIe 4.0, quiet triple-fan cooling, 3-year warranty.');
    await p.fill('textarea[placeholder^="Describe the card"]', 'The Aurora 12GB is a graphics card for 1440p gaming at high settings. '.repeat(8));
    await p.fill('textarea[placeholder^="One per line"]', 'Memory: 12 GB GDDR6X\nBoost clock: 2,610 MHz\nInterface: PCIe 4.0 x16\nOutputs: 3× DisplayPort 1.4a, 1× HDMI 2.1\nLength: 285 mm (2.5 slots)\nRecommended PSU: 650 W\nWarranty: 3 years');
  }
  if (path === '/audit') {
    await p.route('**/api/audit/discover', r => r.fulfill({ json: { startUrl: S + '/', origin: S, robotsFound: true, robots: { allow: [], disallow: [], sitemaps: [] }, sitemapFiles: [], sitemapUrls: [],
      aiCrawlers: [['OAI-SearchBot','OpenAI','search','ChatGPT search',true],['PerplexityBot','Perplexity','search','Perplexity answers',false],['GPTBot','OpenAI','training','OpenAI model training',false]].map(([token,owner,kind,product,allowed])=>({token,owner,kind,product,allowed})), llmsTxt: false } }));
    await p.route('**/api/audit/page', r => { const { url, depth } = JSON.parse(r.request().postData()); r.fulfill({ json: { ...(SITE[url] || P(url, { status: 404 })), depth } }); });
    await p.fill('#site', S); await p.click('text=Start audit'); await p.waitForSelector('text=Finished:');
    await p.click('text=Internal links to broken pages');
  }
  await p.waitForTimeout(400);
}

const PAGES = (process.argv[4] || '/,/analyzer,/content,/urls,/audit,/keywords,/guide,/projects').split(',');

(async () => {
  const b = await chromium.launch();
  const report = [];
  for (const [dname, dev] of Object.entries(DEVICES)) {
    const ctx = await b.newContext({ ...dev, deviceScaleFactor: 1 });
    if (process.env.COOKIE) await ctx.addCookies([JSON.parse(process.env.COOKIE)]);
    for (const path of PAGES) {
      const p = await ctx.newPage();
      const errors = [];
      p.on('pageerror', e => errors.push(e.message));
      try { await prepare(p, path); } catch (e) { errors.push('prepare: ' + e.message.split('\n')[0]); }
      const r = await p.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const overflow = document.documentElement.scrollWidth - vw;
        const offenders = [];
        const isClipped = (el) => { for (let a = el.parentElement; a; a = a.parentElement) { const s = getComputedStyle(a); if (/(auto|scroll|hidden)/.test(s.overflowX)) return true; } return false; };
        for (const el of document.querySelectorAll('body *')) {
          const rc = el.getBoundingClientRect();
          if (rc.width === 0 || rc.height === 0) continue;
          if ((rc.right > vw + 1 || rc.left < -1) && !isClipped(el)) offenders.push(`${el.tagName.toLowerCase()}.${(el.className?.baseVal ?? el.className ?? '').toString().split(' ').slice(0, 3).join('.')} r=${Math.round(rc.right)}`);
        }
        const small = [];
        for (const el of document.querySelectorAll('button, a, input, select, textarea, summary')) {
          const rc = el.getBoundingClientRect();
          if (rc.width === 0 || rc.height === 0 || getComputedStyle(el).visibility === 'hidden') continue;
          const inText = el.tagName === 'A' && el.closest('p, li, td, dd') && rc.height < 24; // inline links in text are exempt
          if (!inText && (rc.height < 32 || rc.width < 32)) small.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || el.placeholder || '').trim().slice(0, 24)}" ${Math.round(rc.width)}x${Math.round(rc.height)}`);
        }
        const tiny = new Set();
        for (const el of document.querySelectorAll('body *')) {
          if (!el.childNodes.length || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
          if (el.closest('svg')) continue;
          const fs = parseFloat(getComputedStyle(el).fontSize);
          if (fs < 11) tiny.add(`${fs}px "${el.textContent.trim().slice(0, 20)}"`);
        }
        return { overflow, offenders: offenders.slice(0, 6), small: small.slice(0, 12), smallCount: small.length, tiny: [...tiny].slice(0, 6), tinyCount: tiny.size };
      });
      const file = `${OUT}/${dname}${path.replace(/\//g, '_') || '_home'}.png`;
      await p.screenshot({ path: file, fullPage: true });
      report.push({ device: dname, path, ...r, errors });
      await p.close();
    }
    await ctx.close();
  }
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  for (const x of report) console.log(`${x.device.padEnd(15)} ${x.path.padEnd(10)} overflow=${x.overflow} offenders=${x.offenders.length} smallTargets=${x.smallCount} tinyText=${x.tinyCount} errors=${x.errors.length}`);
  await b.close();
})();
