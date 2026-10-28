// Headless smoke test: node tools/screenshot.js <mode> <width> <height> [site-local datetime] [extra-js]
// Serves the Astronomy Engine bundle from vendor/ so it works offline. Writes shots/<mode>_<w>.png and prints page errors.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const root = path.resolve(__dirname, '..');
  const [mode = 'zenith', w = '1280', h = '800', when = '', extra = ''] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  const lib = path.join(root, 'vendor', 'astronomy.browser.min.js');
  await p.route('**/astronomy.browser.min.js', (r) => fs.existsSync(lib) ? r.fulfill({ body: fs.readFileSync(lib), contentType: 'text/javascript' }) : r.continue());
  await p.route('https://fonts.**', (r) => r.abort());
  await p.addInitScript((m) => { try { localStorage.setItem('darksite.mode', JSON.stringify(m)); } catch (e) {} }, mode);
  await p.goto('file://' + path.join(root, 'dist', 'index.html'), { waitUntil: 'commit' });
  await p.waitForTimeout(3500);
  await p.evaluate(() => { const l = document.getElementById('loading'); if (l) l.remove(); });
  if (when) { await p.fill('#tInput', when); await p.dispatchEvent('#tInput', 'change'); await p.click('#play'); }
  if (extra) await p.evaluate(extra);
  await p.waitForTimeout(2500);
  fs.mkdirSync(path.join(root, 'shots'), { recursive: true });
  const out = path.join(root, 'shots', `${mode}_${w}${process.env.TAG || ''}.png`);
  await p.screenshot({ path: out, timeout: 180000 });
  console.log(out); if (errors.length) console.log(errors.join('\n'));
  await b.close();
})();
