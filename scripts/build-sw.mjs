import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : `${dir}/${e.name}`))).flat();
}
const files = (await walk('dist')).filter(f => !f.endsWith('/sw.js')).sort();
const assets=Object.fromEntries(await Promise.all(files.map(async f=>['./'+f.slice(5),createHash('sha256').update(await readFile(f)).digest('hex')])));
const version=createHash('sha256').update(JSON.stringify(assets)).digest('hex').slice(0,16);
await writeFile('dist/sw.js', `
const PREFIX = 'mtg-reference-' + new URL(self.registration.scope).pathname + '-';
const CACHE = PREFIX + '${version}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  try {
    await cache.addAll(Object.keys(ASSETS).map(url => new Request(url, {cache: 'reload'})));
    // A successful HTTP response can still belong to a different deploy. Verify every byte.
    for (const [path, expected] of Object.entries(ASSETS)) {
      const response = await cache.match(new URL(path, self.registration.scope).href);
      if (!response) throw Error('Incomplete offline snapshot');
      const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
      const actual = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
      if (actual !== expected) throw Error('Mixed offline snapshot: ' + path);
    }
  } catch (error) { await caches.delete(CACHE); throw error; }
})()));
self.addEventListener('message', event => { if (event.data === 'ACTIVATE') self.skipWaiting(); });
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
})()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = event.request.mode === 'navigate' ? new URL('./index.html', self.registration.scope).href : event.request;
    // These are immutable, hash-verified static representations, not negotiated content.
    // Module requests may carry Origin while install requests do not (Vary: Origin).
    return (await cache.match(key, {ignoreVary: true})) || fetch(event.request);
  })());
});
`);
console.log(`Offline snapshot ${version}: ${files.length} verified files`);
