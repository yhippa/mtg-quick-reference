import {makeIndex,search} from './card-search.mjs';
const status=document.querySelector('#status'),out=document.querySelector('#out');
const pct=xs=>{xs.sort((a,b)=>a-b);return {n:xs.length,p50:xs[Math.floor(xs.length*.5)],p95:xs[Math.floor(xs.length*.95)],max:xs.at(-1)};};
document.querySelector('button').onclick=async()=>{
 try {
  status.textContent='Measuring production assets…';
  const t=performance.now(),cardData=await(await fetch('/data/cards.json')).json(),parsed=performance.now();
  const index=makeIndex(cardData.cards),cardReady=performance.now();
  const {workerPath,cases}=await(await fetch('/__bench/config')).json();
  const worker=new Worker(workerPath,{type:'module'});let next=0;const waiting=new Map();
  worker.onmessage=({data})=>{if(data.type==='error')throw Error(data.error);const resolve=waiting.get(data.type==='ready'?'ready':data.request);resolve?.(data);};
  const readyPromise=new Promise(resolve=>waiting.set('ready',resolve));
  const started=performance.now();worker.postMessage({type:'init',base:location.origin+'/'});const ready=await readyPromise;
  const readyAt=performance.now();
  const cards=[],rules=[],roundtrips=[];
  for(let round=0;round<4;round++)for(const c of cases){
   await new Promise(resolve=>setTimeout(resolve,0));
   const before=performance.now();search(index,c.query);const cardMs=performance.now()-before;
   const request=++next,pending=new Promise(resolve=>waiting.set(request,resolve)),sent=performance.now();
   worker.postMessage({type:'search',request,query:c.query});const result=await pending;waiting.delete(request);
   if(round){cards.push(cardMs);rules.push(result.searchMs);roundtrips.push(performance.now()-sent);}
  }
  worker.terminate();
  const result={measuredAt:new Date().toISOString(),userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,
   note:'Actual production worker/corpus/index and unchanged card index; local server, warm cache not controlled. Query timings exclude rendering. No CPU throttling.',
   startup:{cardsFetchParseMs:parsed-t,cardIndexMs:cardReady-parsed,cardReadyMs:cardReady-t,rulesStartedAfterCardsMs:started-cardReady,rulesInitInternalMs:ready.initMs,rulesRoundtripInitMs:readyAt-started},
   warm:{cards:pct(cards),rulesWorker:pct(rules),rulesRoundtrip:pct(roundtrips)}};
  out.textContent=JSON.stringify(result,null,2);await fetch('/__bench/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(result)});status.textContent='Complete';
 }catch(e){status.textContent=String(e);}
};
