import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {hydrateRules} from '../src/rules-runtime.ts';
import {makeIndex,search} from '../src/search.ts';
import {renderCard} from '../src/detail.ts';
import {renderRule} from '../src/rules-detail.ts';

test('verified atomic snapshots survive interrupted/mixed updates and cold offline rules navigation',async()=>{
 const temp=mkdtempSync(`${tmpdir()}/mtg-offline-`),scope='https://example.com/mtg/';
 try {
  mkdirSync(`${temp}/dist/data`,{recursive:true});
  const paths=['cards.json','rules.json','rules-index.json','rules-release.json'];
  for(const p of paths)writeFileSync(`${temp}/dist/data/${p}`,readFileSync(`public/data/${p}`));
  writeFileSync(`${temp}/dist/index.html`,'<main>Reference</main>');
  writeFileSync(`${temp}/dist/test-font.woff2`,new Uint8Array([1,2,3]));
  const build=()=>{execFileSync(process.execPath,[resolve('scripts/build-sw.mjs')],{cwd:temp});return readFileSync(`${temp}/dist/sw.js`,'utf8');};
  const oldScript=build();
  const stores=new Map<string,Map<string,Uint8Array>>();let online=true,interrupt=false,mix=false,activated=false;
  const caches={open:async(name:string)=>{
    if(!stores.has(name))stores.set(name,new Map());const saved=stores.get(name)!;
    return {addAll:async(requests:{url:string}[])=>{
      if(!online)throw Error('offline');
      for(const request of requests){const path=request.url.slice(scope.length);if(interrupt&&path.endsWith('rules-index.json'))throw Error('interrupted');
       saved.set(request.url,mix&&path.endsWith('rules-index.json')?new TextEncoder().encode('{}'):new Uint8Array(readFileSync(`${temp}/dist/${path}`)));}
    },match:async(request:string|{url:string;headers?:Record<string,string>},options?:{ignoreVary?:boolean})=>{
      // Simulate Vary: Origin: module fetches differ from the precache request.
      if(typeof request!=='string' && request.headers?.Origin && !options?.ignoreVary)return undefined;
      const bytes=saved.get(typeof request==='string'?request:request.url);return bytes?new Response(bytes):undefined;}};
  },delete:async(key:string)=>stores.delete(key),keys:async()=>[...stores.keys()]};
  const boot=(script:string)=>{
    const handlers:Record<string,Function>={};
    runInNewContext(script,{URL,Uint8Array,crypto,Request:class{url:string;constructor(url:string){this.url=new URL(url,scope).href;}},
      self:{registration:{scope},addEventListener:(type:string,fn:Function)=>handlers[type]=fn,skipWaiting:()=>{activated=true;}},caches,fetch:()=>{throw Error('network must not be needed');}});
    return handlers;
  };
  const dispatch=async(handlers:Record<string,Function>,type:string,data={})=>{let pending=Promise.resolve<any>(undefined);handlers[type]({...data,waitUntil:(p:Promise<any>)=>pending=p,respondWith:(p:Promise<any>)=>pending=p});return pending;};
  await dispatch(boot(oldScript),'install');const oldKey=[...stores.keys()][0];assert.equal(activated,false);
  writeFileSync(`${temp}/dist/index.html`,'<main>Updated</main>');const nextScript=build();
  interrupt=true;await assert.rejects(dispatch(boot(nextScript),'install'),/interrupted/);assert.deepEqual([...stores.keys()],[oldKey]);
  interrupt=false;mix=true;await assert.rejects(dispatch(boot(nextScript),'install'),/Mixed offline snapshot/);assert.deepEqual([...stores.keys()],[oldKey]);mix=false;
  online=false;const cold=boot(oldScript);
  const get=async(path:string,mode='same-origin'):Promise<Response>=>dispatch(cold,'fetch',{request:{url:scope+path,method:'GET',mode,headers:{Origin:'https://example.com'}}});
  assert.equal(await (await get('','navigate')).text(),'<main>Reference</main>');
  assert.deepEqual([...new Uint8Array(await (await get('test-font.woff2')).arrayBuffer())],[1,2,3]);
  const data=await (await get('data/cards.json')).json();const names=makeIndex(data.cards);
  const sol=data.cards[search(names,'sol ring')[0]];assert.equal(sol.name,'Sol Ring');assert.ok(renderCard(sol).includes('card-title'));
  const necro=data.cards[search(names,'necropotence')[0]];assert.ok(necro.rulings.length);assert.ok(renderCard(necro).includes('Official rulings'));
  const release=await (await get('data/rules-release.json')).json();
  const runtime=await hydrateRules(release,await (await get('data/rules.json')).arrayBuffer(),await (await get('data/rules-index.json')).arrayBuffer());
  assert.equal(runtime.search('ward').exact[0].id,'glossary:ward');assert.equal(runtime.search('702.19').direct[0].id,'cr:702.19');
  const glossary=runtime.detail('glossary:trample')!;assert.ok(renderRule(glossary,release).includes('glossary'));
  const ref=glossary.document.references[0];assert.ok(runtime.detail(ref));assert.ok(renderRule(runtime.detail(ref)!,release).includes('rule-title'));
  const banding=runtime.detail('cr:702.22a')!;assert.equal(banding.document.id,'cr:702.22a');assert.equal(banding.family!.members.length,12);assert.ok(renderRule(banding,release).includes('focused-rule'));
  online=true;const next=boot(nextScript);await dispatch(next,'install');assert.ok(stores.has(oldKey));assert.equal(activated,false);
  next.message({data:'ACTIVATE'});assert.equal(activated,true);await dispatch(next,'activate');assert.ok(!stores.has(oldKey));
 }finally{rmSync(temp,{recursive:true,force:true});}
});
