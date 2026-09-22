import {createEngine} from './engine.mjs';
const pct = values => { const a=[...values].sort((a,b)=>a-b); return {n:a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a.at(-1),over16_7ms:a.filter(v=>v>16.7).length,over50ms:a.filter(v=>v>50).length}; };
export async function run(mode, rounds=3) {
  const start=performance.now();
  const paths=['data/lean-rules.json','data/cards.json','evaluation.json'];
  if(mode.endsWith('-prebuilt'))paths.push('data/rules-index.json');
  const texts=await Promise.all(paths.map(async p=>{const r=await fetch(p,{cache:'no-store'});if(!r.ok)throw Error(p);return r.text();}));
  const fetched=performance.now();
  const [rules,cards,evaluation,stored]=texts.map(t=>JSON.parse(t));
  const parsed=performance.now();
  const engine=createEngine(mode.replace('-prebuilt',''),rules,cards,stored);
  const built=performance.now();
  const first=[],warm=[],frames=[];
  for(let round=0;round<=rounds;round++) for(const c of evaluation.cases){
    // Each query is a separate task, resembling typing rather than one uninterrupted loop.
    await new Promise(r=>setTimeout(r,0));
    const t=performance.now();engine.search(c.query);const elapsed=performance.now()-t;
    (round===0?first:warm).push(elapsed);
    if(typeof requestAnimationFrame==='function'&&round===0){await new Promise(requestAnimationFrame);frames.push(performance.now()-t);}
  }
  return {mode,userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemoryGB:navigator.deviceMemory??null,
    environment:typeof document==='undefined'?'dedicated-worker':'main-thread-frame',
    load:{fetchTextMs:fetched-start,jsonParseMs:parsed-fetched,indexBuildMs:built-parsed,readyMs:built-start,transportTextBytes:texts.reduce((n,t)=>n+new TextEncoder().encode(t).length,0)},
    firstPass:pct(first),warm:pct(warm),queryToNextFrame:frames.length?pct(frames):null,
    heapBytes:performance.memory?.usedJSHeapSize??null};
}
