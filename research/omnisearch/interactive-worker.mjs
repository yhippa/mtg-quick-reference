import {createEngine} from './engine.mjs';
let engine;
self.onmessage=async({data})=>{
 try {
  if(data.type==='init'){
   const start=performance.now();
   const texts=await Promise.all(['data/lean-rules.json','data/cards.json','data/rules-index.json'].map(async p=>(await fetch(p,{cache:'no-store'})).text()));
   const fetched=performance.now();const [rules,cards,index]=texts.map(t=>JSON.parse(t));const parsed=performance.now();
   engine=createEngine('split',rules,cards,index);const built=performance.now();
   postMessage({type:'ready',load:{fetchTextMs:fetched-start,jsonParseMs:parsed-fetched,indexBuildMs:built-parsed,readyMs:built-start}});
  }else postMessage({hits:engine.search(data.query).map(({id,title,kind})=>({id,title,kind}))});
 }catch(e){postMessage({error:String(e)});}
};
