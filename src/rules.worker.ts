import { hydrateRules } from './rules-runtime.ts';
import type { RulesRelease } from './rules-types.ts';
let engine:Awaited<ReturnType<typeof hydrateRules>>;
self.onmessage=async({data})=>{
  try {
    if(data.type==='init') {
      const start=performance.now();
      const base=data.base;
      const fetchOK=async(path:string)=>{const r=await fetch(new URL(path,base));if(!r.ok)throw Error('Rules download failed');return r;};
      const release:RulesRelease=await (await fetchOK('./data/rules-release.json')).json();
      const [corpus,index]=await Promise.all([release.corpus.url,release.index.url].map(async p=>(await fetchOK(p)).arrayBuffer()));
      engine=await hydrateRules(release,corpus,index);
      self.postMessage({type:'ready',release,initMs:performance.now()-start});
    } else if(data.type==='search') {
      const start=performance.now();
      self.postMessage({type:'results',request:data.request,query:data.query,hits:engine.search(data.query),searchMs:performance.now()-start});
    } else if(data.type==='detail')self.postMessage({type:'detail',request:data.request,detail:engine.detail(data.id)});
  } catch(e) {self.postMessage({type:'error',request:data.request,error:String(e)});}
};
