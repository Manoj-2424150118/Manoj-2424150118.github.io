import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.argv[2] || '_site';
const forbidden = new Set(['_headers', '.gitignore', '.github', 'node_modules', 'tools', 'package.json', 'package-lock.json', 'README.md', 'SECURITY.md', 'LICENSE', 'NOTICE.md', 'PRIVACY.md', 'audit']);
const allowDot = new Set(['.well-known', '.nojekyll']);

const problems = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(root, full).replaceAll('\\', '/');
    if (forbidden.has(name) || (name.startsWith('.') && !allowDot.has(name))) {
      problems.push(rel);
    }
    if (statSync(full).isDirectory()) walk(full);
  }
}

walk(root);

if (problems.length) {
  console.error('Forbidden files in deploy artifact:');
  for (const p of problems) console.error(` - ${p}`);
  process.exit(1);
}
console.log('Deploy manifest passed.');
