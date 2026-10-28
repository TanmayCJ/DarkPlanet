// Smoke test: opens dist/index.html in headless Chromium and checks that the app boots and its main features respond.
// Run `npm run fetch && npm run build:data && npm run build` first. Exits non-zero on failure.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const root = path.resolve(__dirname, '..');
const lib = path.join(root, 'vendor', 'astronomy.browser.min.js');
const failures = [];
const check = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) failures.push(msg); };

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && m.text().includes('[darksite]'))) errors.push(m.text()); });
  if (fs.existsSync(lib)) await page.route('**/astronomy.browser.min.js', (r) => r.fulfill({ body: fs.readFileSync(lib), contentType: 'text/javascript' }));
  await page.route('https://fonts.**', (r) => r.abort());
  await page.goto('file://' + path.join(root, 'dist', 'index.html'), { waitUntil: 'commit' });
  await page.waitForFunction(() => (document.getElementById('clockdate')?.textContent || '').length > 5, null, { timeout: 60000 });

  check(/^\d\d:\d\d$/.test(await page.evaluate(() => document.getElementById('clock').textContent)), 'clock shows the site time');
  check((await page.$$('#planetTable tr')).length === 7, 'planet table lists 7 planets');
  await page.waitForFunction(() => !document.querySelector('#events .empty') || !/Computing/.test(document.querySelector('#events').textContent), null, { timeout: 30000 });
  check((await page.$$('#events li')).length > 0, '7-day events are computed');
  const painted = await page.evaluate(() => {
    const c = document.getElementById('cMain'), x = c.getContext('2d');
    const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0;
    for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 0) n++;
    return n;
  });
  check(painted > 200, `sky canvas has drawn content (${painted} sampled pixels)`);

  await page.fill('#q', 'M31');
  check(/Andromeda/.test(await page.textContent('#results')), 'search finds M31');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#tip:not([hidden])', { timeout: 20000 });
  check(/Andromeda/.test(await page.textContent('#tip')), 'selecting a search result opens its details');

  for (const mode of ['pZenith', 'pHorizon', 'pOptic']) { await page.click('#' + mode); await page.waitForTimeout(300); }
  await page.click('#tDp'); await page.waitForTimeout(500);
  check(errors.length === 0, 'no page errors' + (errors.length ? ':\n  ' + errors.join('\n  ') : ''));

  await browser.close();
  if (failures.length) { console.error(`\n${failures.length} check(s) failed`); process.exit(1); }
  console.log('\nAll checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
