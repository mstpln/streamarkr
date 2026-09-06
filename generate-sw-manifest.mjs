// Correction 12: initial install-time caching must include every compiled JS module, not just the
// static shell + whatever the runtime cache-on-fetch strategy happens to pick up later. Since this
// project deliberately has no bundler, we generate a small manifest of every compiled asset under
// dist/ at build time; sw.js fetches it during `install` and caches everything listed so the app is
// reliably usable offline after just one successful load.
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.js')) out.push('./' + relative(ROOT, full).split('\\').join('/'));
  }
  return out;
}

const files = walk(DIST).sort();
writeFileSync(join(ROOT, 'sw-manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), files }, null, 2));
console.log(`sw-manifest.json written with ${files.length} compiled module(s).`);
