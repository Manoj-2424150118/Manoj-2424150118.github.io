// Browser regression gate (F-03 / T-26): keyboard skip-link focus, accessible
// names free of decorative glyphs, reflow at key widths, internal link
// integrity, and the mobile menu's Escape/focus-return behaviour.
//
// Zero npm dependencies: drives Chrome over CDP with Node's global WebSocket.
// Chrome discovery: $CHROME_PATH, then common install locations. In CI the
// ubuntu runner's google-chrome is used. Fails (exit 1) if no Chrome is found
// or any assertion fails — this is a gate, not a warning.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
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

async function ev(expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sid); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text || 'evaluate failed'); return r.result?.result?.value; }
async function navigate(path) { await send('Page.navigate', { url: base + path }, sid); await sleep(900); }
async function key(keyName, code, vk) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code, windowsVirtualKeyCode: vk }, sid);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, windowsVirtualKeyCode: vk }, sid);
  await sleep(120);
}

let failures = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failures++; };

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
}

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
