import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// Build the deploy artifact (_site) from an explicit allowlist.
// Used when Pages is switched to GitHub Actions (owner action) or when
// mirroring to a headers-capable host. On legacy branch-based Pages this
// script is not in the deploy path; it exists so the switch is one step.
const out = '_site';
const host = process.env.HOST || 'pages';
const includeHeaders = host === 'cloudflare' || host === 'netlify' || process.argv.includes('--headers');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const common = [
  'index.html',
  'aegis.html',
  'deceptive-net.html',
  'resume.html',
  '404.html',
  'styles.css',
  'anti-clickjack.js',
  'js',
  'fonts',
  'Logo.png',
  'Logo-3D.png',
  'MKS Dark Gray.jpg',
  'portrait-3d.webp',
  'og-cover.jpg',
  'og-aegis.jpg',
  'og-deceptive-net.jpg',
  'robots.txt',
  'sitemap.xml',
  'security.txt',
  '.well-known',
  '.nojekyll',
  // Sanitized 2026-11-11 (no phone). The PII scanner gates this in CI;
  // never ship a PDF the scanner has not passed.
  'Manoj_Kumar_Sharma_Resume.pdf',
];

const files = includeHeaders ? [...common, '_headers'] : common;

for (const file of files) {
  if (!existsSync(file)) continue;
  cpSync(file, join(out, file), { recursive: true });
}

// Include the IndexNow key file if present (32 hex chars + .txt).
for (const file of readdirSync('.')) {
  if (/^[a-f0-9]{32}\.txt$/i.test(file)) cpSync(file, join(out, file));
}

if (!includeHeaders && existsSync(join(out, '_headers'))) {
  throw new Error('_headers must not be deployed to GitHub Pages');
}

console.log(`Built ${out} for host=${host}`);
