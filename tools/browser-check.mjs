// Browser regression gate (F-03 / T-26): keyboard skip-link focus, accessible
// names free of decorative glyphs, reflow at key widths, internal link
// integrity, and the mobile menu's Escape/focus-return behaviour. axe runs
// twice per page — default (dark) scheme and emulated light scheme — plus a
// direct computed-contrast check per scheme, because axe reports
// color-contrast "incomplete" (body gradient background) and missed the
// light-mode accent regression fixed in d5e057e.
//
// Zero npm dependencies: drives Chrome over CDP with Node's global WebSocket.
// Chrome discovery: $CHROME_PATH, then common install locations. In CI the
// ubuntu runner's google-chrome is used. Fails (exit 1) if no Chrome is found
// or any assertion fails — this is a gate, not a warning.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(process.cwd());
const AXE_PATH = join(dirname(fileURLToPath(import.meta.url)), 'node_modules', 'axe-core', 'axe.min.js');
if (!existsSync(AXE_PATH)) {
  console.error('FAIL browser-check: axe-core not installed (run: npm --prefix tools ci)');
  process.exit(1);
}
const AXE_SRC = readFileSync(AXE_PATH, 'utf8');
const GLYPHS = /[✓↗▶←]/;

const chromeCandidates = [
  process.env.CHROME_PATH,
  process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/opt/meta-chromium/chrome',
].filter(Boolean);
const CHROME = chromeCandidates.find((p) => existsSync(p));
if (!CHROME) {
  console.error('FAIL browser-check: no Chrome/Chromium binary found (set CHROME_PATH)');
  process.exit(1);
}

// --- static server for the repo root ---
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.txt': 'text/plain', '.xml': 'application/xml', '.pdf': 'application/pdf', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/') path = '/index.html';
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// --- CDP plumbing ---
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function launchChrome() {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const port = 9400 + Math.floor(Math.random() * 500);
    const proc = spawn(CHROME, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore' });
    let exited = false;
    proc.on('exit', () => { exited = true; });
    // Runner Chrome can be slow to open its debug port; allow ~45 s.
    for (let i = 0; i < 90 && !exited; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json/version`);
        const url = (await r.json()).webSocketDebuggerUrl;
        const sock = new WebSocket(url);
        await new Promise((res, rej) => { sock.addEventListener('open', res, { once: true }); sock.addEventListener('error', rej, { once: true }); });
        return { proc, sock };
      } catch { await sleep(500); }
    }
    try { proc.kill(); } catch {}
    if (attempt === 2) return null;
  }
  return null;
}
const launched = await launchChrome();
if (!launched) { console.error('FAIL browser-check: could not connect to Chrome CDP'); process.exit(1); }
const chrome = launched.proc;
const ws = launched.sock;
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
function send(method, params = {}, sessionId) { return new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); }); }
const t = await send('Target.createTarget', { url: 'about:blank' });
const a = await send('Target.attachToTarget', { targetId: t.result.targetId, flatten: true });
const sid = a.result.sessionId;
await send('Page.enable', {}, sid);
await send('Runtime.enable', {}, sid);
await send('Accessibility.enable', {}, sid);
// Pin the starting scheme explicitly: headless Chrome's default
// prefers-color-scheme varies by binary/environment (light in this shell,
// dark on the CI runner), so the "dark" pass below must not rely on it.
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] }, sid);

async function ev(expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sid); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text || 'evaluate failed'); return r.result?.result?.value; }
async function navigate(path) { await send('Page.navigate', { url: base + path }, sid); await sleep(900); }
async function key(keyName, code, vk) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code, windowsVirtualKeyCode: vk }, sid);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, windowsVirtualKeyCode: vk }, sid);
  await sleep(120);
}

let failures = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failures++; };

// Direct computed-contrast check for the accent-coloured text axe cannot see:
// axe reports color-contrast as "incomplete" here because the body's
// radial-gradient background-image hides the effective background, so a
// 2.95:1 regression passes axe silently. This composites each element's
// ancestor background-colors (the gradient is a subtle overlay on an opaque
// base) and asserts WCAG AA: 4.5:1 normal text, 3:1 large text (h1 em).
const CONTRAST_JS = `(() => {
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) });
  const effBg = (el) => { const layers = []; let n = el; while (n) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) layers.push(c); if (n === document.body) break; n = n.parentElement; } let bg = { r: 255, g: 255, b: 255 }; for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg); return bg; };
  const out = [];
  for (const [sel, min] of [['.eyebrow', 4.5], ['.sub', 4.5], ['.card .role', 4.5], ['.kicker', 4.5], ['h1 em', 3.0]]) {
    const els = [...document.querySelectorAll(sel)];
    if (!els.length) continue;
    let worst = 99;
    for (const el of els) { const fg = parse(getComputedStyle(el).color); const bg = effBg(el); const l1 = lum(fg), l2 = lum(bg); const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); if (ratio < worst) worst = ratio; }
    out.push({ sel, min, n: els.length, worst: Math.round(worst * 100) / 100 });
  }
  return out;
})()`;

async function contrastPass(label) {
  for (const page of ['/', '/aegis.html', '/deceptive-net.html', '/resume.html', '/404.html']) {
    await navigate(page);
    const rows = await ev(CONTRAST_JS);
    for (const r of rows) check(`contrast ${label} ${r.sel} ${page}`, r.worst >= r.min, `${r.worst}:1 (min ${r.min}:1, ${r.n} node${r.n > 1 ? 's' : ''})`);
  }
}

// --- 1+2. Skip-link focus and accessible names on content pages ---
for (const page of ['/', '/aegis.html', '/deceptive-net.html', '/resume.html']) {
  await navigate(page);
  await key('Tab', 'Tab', 9);
  const first = await ev(`document.activeElement ? document.activeElement.textContent.trim() : ''`);
  check(`skip-link first tab stop ${page}`, /Skip to content/i.test(first || ''), JSON.stringify(first));
  await key('Enter', 'Enter', 13);
  await sleep(300);
  const st = await ev(`({tag: document.activeElement.tagName, id: document.activeElement.id, hash: location.hash})`);
  check(`skip-link moves focus to main ${page}`, st.tag === 'MAIN' && st.id === 'main' && st.hash === '#main', JSON.stringify(st));

  const tree = await send('Accessibility.getFullAXTree', {}, sid);
  const bad = (tree.result?.nodes || []).filter((n) => ['link', 'button'].includes(n.role?.value) && n.name?.value && GLYPHS.test(n.name.value)).map((n) => n.name.value);
  check(`accessible names glyph-free ${page}`, bad.length === 0, bad.slice(0, 3).join(' | '));

  await ev(AXE_SRC);
  const axe = await ev(`axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}).then(r => r.violations.map(v => v.id + ' x' + v.nodes.length))`);
  check(`axe zero violations ${page}`, Array.isArray(axe) && axe.length === 0, (axe || []).join(', '));
}

// axe on the 404 page too (no skip link there, so it sits outside the loop)
await navigate('/404.html');
await ev(AXE_SRC);
const axe404 = await ev(`axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}).then(r => r.violations.map(v => v.id + ' x' + v.nodes.length))`);
check('axe zero violations /404.html', Array.isArray(axe404) && axe404.length === 0, (axe404 || []).join(', '));

// --- 2a. Direct contrast of accent text (dark scheme) ---
await contrastPass('dark');

// --- 2b. axe under emulated light colour scheme ---
// The default-scheme pass above runs dark, so it missed the light-mode
// accent regression fixed in d5e057e. Emulate prefers-color-scheme: light,
// prove the light palette actually applied (guard on --accent), then run
// axe on every page again. Restore dark afterwards so the reflow/menu
// checks below run in the default scheme.
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] }, sid);
await navigate('/');
const lightAccent = await ev(`getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()`);
check('light scheme applied (--accent)', lightAccent === '#a92e14', lightAccent);
for (const page of ['/', '/aegis.html', '/deceptive-net.html', '/resume.html', '/404.html']) {
  await navigate(page);
  await ev(AXE_SRC);
  const axeLight = await ev(`axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}).then(r => r.violations.map(v => v.id + ' x' + v.nodes.length))`);
  check(`axe zero violations (light) ${page}`, Array.isArray(axeLight) && axeLight.length === 0, (axeLight || []).join(', '));
}
await contrastPass('light');
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] }, sid);
await navigate('/');
const darkAccent = await ev(`getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()`);
check('dark scheme restored (--accent)', darkAccent === '#f2462e', darkAccent);

// --- 3. Reflow at key widths (index) ---
await navigate('/');
for (const w of [320, 375, 768, 1024, 1280]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 768 }, sid);
  await sleep(200);
  const m = await ev(`({sw: document.documentElement.scrollWidth, iw: window.innerWidth})`);
  check(`reflow ${w}px`, m.sw <= m.iw, `scrollWidth=${m.sw} innerWidth=${m.iw}`);
}
await send('Emulation.clearDeviceMetricsOverride', {}, sid);

// --- 4. Mobile menu: open, Escape closes, focus returns (index @768) ---
await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 900, deviceScaleFactor: 1, mobile: true }, sid);
await navigate('/');
await ev(`document.getElementById('menuToggle').click()`);
await sleep(150);
const opened = await ev(`({open: document.getElementById('navlinks').classList.contains('open'), exp: document.getElementById('menuToggle').getAttribute('aria-expanded')})`);
check('menu opens at 768px', opened.open && opened.exp === 'true', JSON.stringify(opened));
await key('Escape', 'Escape', 27);
await sleep(150);
const closed = await ev(`({open: document.getElementById('navlinks').classList.contains('open'), focus: document.activeElement.id})`);
check('menu Escape closes + focus returns', !closed.open && closed.focus === 'menuToggle', JSON.stringify(closed));
await send('Emulation.clearDeviceMetricsOverride', {}, sid);

// --- 5. Internal link integrity (static) ---
const htmlFiles = readdirSync(ROOT).filter((f) => f.endsWith('.html'));
let linkCount = 0; const broken = [];
for (const f of htmlFiles) {
  const html = readFileSync(join(ROOT, f), 'utf8');
  for (const m of html.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/gi)) {
    const u = m[1];
    if (/^(https?:|mailto:|tel:|#|data:)/i.test(u)) continue;
    const clean = u.split('#')[0].split('?')[0];
    if (!clean) continue;
    linkCount++;
    const target = clean === '/' ? 'index.html' : clean.replace(/^\//, '');
    if (!existsSync(join(ROOT, decodeURIComponent(target)))) broken.push(`${f} -> ${u}`);
  }
}
check(`internal links resolve (${linkCount} checked)`, broken.length === 0, broken.slice(0, 5).join(' | '));

ws.close(); chrome.kill(); server.close();
if (failures) { console.error(`Browser checks failed: ${failures}`); process.exit(1); }
console.log('Browser checks passed.');
