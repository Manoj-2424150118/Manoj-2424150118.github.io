// Live header + security.txt checker.
// HOST_KIND=pages (default): asserts only what GitHub Pages can deliver
// (HSTS, HTTPS redirect, security.txt hygiene, public files) and warns
// about the headers Pages cannot send. HOST_KIND=headers: full matrix
// for a headers-capable host (Cloudflare Pages / Netlify / proxy).
const url = process.env.SITE_URL || 'https://manoj-2424150118.github.io/';
const mode = process.env.HOST_KIND || 'pages';
let failures = 0;
const fail = (m) => { failures++; console.error(`FAIL ${m}`); };
const warn = (m) => console.warn(`WARN ${m}`);

const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
const h = (name) => res.headers.get(name) || '';

console.log(`HEAD ${url} -> ${res.status}`);

if (!h('strict-transport-security')) fail('missing Strict-Transport-Security');
if (!/text\/html/.test(h('content-type'))) fail(`unexpected content-type ${h('content-type')}`);

if (mode === 'pages') {
  if (res.status !== 200) fail(`expected 200, got ${res.status}`);
  warn('GitHub Pages mode: XFO/nosniff/referrer/permissions/CSP headers are expected to be absent');
} else {
  if (h('x-frame-options').toUpperCase() !== 'DENY') fail('X-Frame-Options must be DENY');
  if (h('x-content-type-options').toLowerCase() !== 'nosniff') fail('X-Content-Type-Options must be nosniff');
  if (!h('referrer-policy')) fail('missing Referrer-Policy');
  if (!h('permissions-policy')) fail('missing Permissions-Policy');
  if (!h('cross-origin-opener-policy')) fail('missing Cross-Origin-Opener-Policy');
  if (!h('cross-origin-resource-policy')) fail('missing Cross-Origin-Resource-Policy');
  const csp = h('content-security-policy');
  if (!csp) fail('missing CSP header');
  if (csp && !/frame-ancestors\s+'none'/.test(csp)) fail("CSP header missing frame-ancestors 'none'");
  if (csp && !/script-src-attr\s+'none'/.test(csp)) fail("CSP header missing script-src-attr 'none'");
  if (csp && !/style-src-attr\s+'none'/.test(csp)) fail("CSP header missing style-src-attr 'none'");
  if (h('access-control-allow-origin') === '*') warn('ACAO * is unnecessary; remove it unless documented');
}

const http = new URL(url);
http.protocol = 'http:';
const redirect = await fetch(http, { method: 'HEAD', redirect: 'manual' });
if (![301, 308].includes(redirect.status)) fail(`HTTP should redirect to HTTPS, got ${redirect.status}`);
else if (!(redirect.headers.get('location') || '').startsWith('https://')) fail('HTTP redirect location is not HTTPS');

const txt = await (await fetch(new URL('/.well-known/security.txt', url))).text();
const expires = txt.match(/^Expires:\s*(.+)$/mi)?.[1]?.trim();
const canonical = txt.match(/^Canonical:\s*(.+)$/mi)?.[1]?.trim();
if (!expires) fail('security.txt missing Expires');
else if (Date.parse(expires) < Date.now() + 30 * 864e5) fail(`security.txt expires too soon: ${expires}`);
if (!canonical?.includes('/.well-known/security.txt')) fail('security.txt Canonical must be the well-known URL');

for (const path of ['/robots.txt', '/sitemap.xml']) {
  const r = await fetch(new URL(path, url), { method: 'HEAD' });
  if (r.status !== 200) fail(`${path} -> ${r.status}`);
}

for (const path of ['/_headers', '/.gitignore']) {
  const r = await fetch(new URL(path, url), { method: 'HEAD' });
  if (mode !== 'pages' && r.status !== 404) fail(`${path} should not be public, got ${r.status}`);
  if (mode === 'pages' && r.status !== 404) warn(`${path} is public on GitHub Pages (known F-08; fixed by the deploy allowlist / host move)`);
}

if (failures) process.exit(1);
console.log('Header checks passed.');
