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
