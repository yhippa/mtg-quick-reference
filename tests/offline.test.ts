import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';

test('offline snapshot installs atomically, preserves previous cache on failure and waits for approval', async () => {
  const temp = mkdtempSync(`${tmpdir()}/mtg-sw-`);
  try {
    mkdirSync(`${temp}/dist`);
    writeFileSync(`${temp}/dist/index.html`, '<h1>reference</h1>');
    execFileSync(process.execPath, [resolve('scripts/build-sw.mjs')], {cwd: temp});
    const handlers: Record<string, Function> = {};
    const deleted: string[] = [];
    let fail = false;
    let activated = false;
    let fetched = false;
    let matched: unknown;
    const cache = { addAll: async () => { if (fail) throw Error('interrupted'); }, match: async (key: unknown) => { matched = key; return 'cached'; } };
    runInNewContext(readFileSync(`${temp}/dist/sw.js`, 'utf8'), {
      URL,
      Request: class { constructor(url: string) { void url; } },
      self: { registration: {scope:'https://example.com/cards/'}, addEventListener:(type:string, fn:Function)=>handlers[type]=fn, skipWaiting:()=>{activated=true;} },
      caches: { open:async()=>cache, delete:async(key:string)=>{deleted.push(key);}, keys:async()=>['mtg-reference-/cards/-old','unrelated-cache'] },
      fetch:async()=>{fetched=true;return 'network';}
    });
    let pending: Promise<unknown> = Promise.resolve();
    const waitUntil = (p:Promise<unknown>)=>{pending=p;};
    handlers.install({waitUntil}); await pending;
    assert.equal(activated, false);
    fail=true;
    handlers.install({waitUntil}); await assert.rejects(pending,/interrupted/);
    assert.equal(deleted.length,1);
    assert.notEqual(deleted[0],'mtg-reference-/cards/-old');
    handlers.message({data:'ACTIVATE'}); assert.equal(activated,true);
    handlers.activate({waitUntil}); await pending;
    assert.ok(deleted.includes('mtg-reference-/cards/-old'));
    assert.ok(!deleted.includes('unrelated-cache'));
    handlers.fetch({request:{method:'GET',url:'https://example.com/cards/',mode:'navigate'},respondWith:waitUntil});
    assert.equal(await pending,'cached');
    assert.equal(matched,'https://example.com/cards/index.html');
    assert.equal(fetched,false);
  } finally { rmSync(temp,{recursive:true,force:true}); }
});

test('fresh worker serves shell, data, font and rulings without any network', async () => {
  const temp = mkdtempSync(`${tmpdir()}/mtg-cold-`);
  try {
    mkdirSync(`${temp}/dist/data`, {recursive:true});
    mkdirSync(`${temp}/dist/fonts`, {recursive:true});
    const source = JSON.parse(readFileSync('tests/fixtures/representative-atomic.json','utf8'));
    writeFileSync(`${temp}/dist/index.html`, '<main>Reference</main>');
    writeFileSync(`${temp}/dist/data/cards.json`, JSON.stringify(source));
    writeFileSync(`${temp}/dist/fonts/mana.woff2`, 'font');
    execFileSync(process.execPath, [resolve('scripts/build-sw.mjs')], {cwd:temp});
    const script = readFileSync(`${temp}/dist/sw.js`, 'utf8');
    const saved = new Map<string, string>();
    let online = true;
    const scope = 'https://example.com/mtg/';
    const cache = {
      addAll: async (requests: {url:string}[]) => {
        if (!online) throw Error('offline');
        for (const request of requests) saved.set(request.url, readFileSync(`${temp}/dist/${request.url.slice(scope.length)}`, 'utf8'));
      },
      match: async (request: string | {url:string}) => saved.get(typeof request === 'string' ? request : request.url),
    };
    const boot = () => {
      const handlers: Record<string, Function> = {};
      runInNewContext(script, {
        URL, Request: class { url:string; constructor(url:string) {this.url = new URL(url,scope).href;} },
        self:{registration:{scope},addEventListener:(type:string,fn:Function)=>handlers[type]=fn},
        caches:{open:async()=>cache}, fetch:()=>{throw Error('network must not be needed');},
      });
      return handlers;
    };
    let pending: Promise<unknown> = Promise.resolve();
    boot().install({waitUntil:(p:Promise<unknown>)=>pending=p}); await pending;
    online = false;
    const cold = boot(); // No state from the original worker survives except persistent cache storage.
    const fetchCached = async (path:string, mode='same-origin') => {
      cold.fetch({request:{url:scope+path,method:'GET',mode},respondWith:(p:Promise<unknown>)=>pending=p});
      return await pending;
    };
    assert.equal(await fetchCached('', 'navigate'), '<main>Reference</main>');
    const cards = JSON.parse(await fetchCached('data/cards.json') as string);
    assert.ok(cards.data.Necropotence[0].text.includes('Skip your draw step.'));
    assert.ok(cards.data.Necropotence[0].rulings.length >= 3);
    assert.equal(await fetchCached('fonts/mana.woff2'), 'font');
  } finally {rmSync(temp,{recursive:true,force:true});}
});
