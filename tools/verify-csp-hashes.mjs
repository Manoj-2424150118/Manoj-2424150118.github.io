import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync('.').filter((f) => f.endsWith('.html'));

const hash = (s) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;

function metaCsp(html) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    if (!/http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(tag)) continue;
    const m = tag.match(/content\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    if (m) return m[1] ?? m[2] ?? '';
  }
  return null;
}

function directive(csp, name) {
  return csp
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.toLowerCase().startsWith(name.toLowerCase() + ' ')) || '';
}

let failed = false;
let stale = false;
const globalUsed = new Set();

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const csp = metaCsp(html);
  if (!csp) {
    console.error(`FAIL ${file}: no meta Content-Security-Policy`);
    failed = true;
    continue;
  }

  const scriptSrc = directive(csp, 'script-src');
  const styleSrc = directive(csp, 'style-src');
  const checks = [];

  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    if (/\bsrc\s*=/i.test(attrs)) continue;
    if (/\btype\s*=/i.test(attrs) && !/type\s*=\s*["'](?:module|text\/javascript|application\/javascript)["']/i.test(attrs)) {
      continue; // JSON-LD and other non-executable script types
    }
    checks.push({ kind: 'script', hash: hash(m[2]) });
  }

  for (const m of html.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi)) {
    checks.push({ kind: 'style', hash: hash(m[2]) });
  }

  // Hashes pinned for non-executable blocks (JSON-LD) are harmless and
  // intentional here; count them as used so they are not flagged stale.
  const allInline = [];
  for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) allInline.push(hash(m[1]));
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) allInline.push(hash(m[1]));
  const used = new Set([...checks.map((c) => c.hash), ...allInline]);
  for (const h of used) globalUsed.add(h);
  for (const c of checks) {
    const dir = c.kind === 'script' ? scriptSrc : styleSrc;
    const ok = dir.includes(c.hash);
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${file} ${c.kind} ${c.hash}`);
    if (!ok) failed = true;
  }

  // Stale hashes fail closed (F-24): a pinned hash that matches no inline
  // block in the page is drift, and drift in a security control is a defect.
  for (const h of [...scriptSrc.matchAll(/'sha256-[^']+'/g)].map((m) => m[0])) {
    if (!used.has(h)) { console.error(`FAIL ${file}: unused/stale script hash ${h}`); stale = true; }
  }
  for (const h of [...styleSrc.matchAll(/'sha256-[^']+'/g)].map((m) => m[0])) {
    if (!used.has(h)) { console.error(`FAIL ${file}: unused/stale style hash ${h}`); stale = true; }
  }
}

if (existsSync('_headers')) {
  const headers = readFileSync('_headers', 'utf8');
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    const csp = metaCsp(html);
    if (!csp) continue;
    for (const h of csp.matchAll(/'sha256-[^']+'/g)) {
      if (!headers.includes(h[0])) {
        console.error(`FAIL _headers missing ${h[0]} from ${file}`);
        failed = true;
      }
    }
  }
  // A hash pinned in _headers that no page uses is stale too.
  for (const h of headers.matchAll(/'sha256-[^']+'/g)) {
    if (!globalUsed.has(h[0])) {
      console.error(`FAIL _headers: unused/stale hash ${h[0]}`);
      stale = true;
    }
  }
}

if (failed || stale) {
  console.error('CSP hash verification failed.');
  process.exit(1);
}
console.log('CSP hash verification passed.');
