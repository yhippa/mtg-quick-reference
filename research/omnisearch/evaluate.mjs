import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=new URL('./',import.meta.url);
const raw=readFileSync(new URL('evaluation.json',root));
const expected=readFileSync(new URL('results/evaluation-sha256.txt',root),'utf8').trim();
if(createHash('sha256').update(raw).digest('hex')!==expected)throw Error('Judgments changed after freeze');
const modes=['linear','unified','unified-routed','split','split-prebuilt'];
function metrics(cases){
 let hit1=0,hit5=0,mrr=0,ndcg=0,recall=0;
 for(const c of cases){
  const ids=c.results.map(h=>h.id), grades=c.relevance;
  const primary=Object.keys(grades).filter(k=>grades[k]===3);
  const rank=ids.findIndex(id=>grades[id]===3);
  hit1+=rank===0;hit5+=rank>=0&&rank<5;mrr+=rank>=0?1/(rank+1):0;
  recall+=primary.filter(id=>ids.slice(0,5).includes(id)).length/primary.length;
  const dcg=ids.slice(0,5).reduce((s,id,i)=>s+(2**(grades[id]??0)-1)/Math.log2(i+2),0);
  const ideal=Object.values(grades).sort((a,b)=>b-a).slice(0,5).reduce((s,g,i)=>s+(2**g-1)/Math.log2(i+2),0);
  ndcg+=dcg/ideal;
 }
 const n=cases.length;return {n,hit1:hit1/n,hit5:hit5/n,mrr10:mrr/n,ndcg5:ndcg/n,primaryRecall5:recall/n};
}
const report={evaluationSha256:expected,inputs:Object.fromEntries(['engine.mjs','data/lean-rules.json','data/cards.json','data/rules-index.json','data/unified-index.json','data/card-search.mjs'].map(p=>[p,createHash('sha256').update(readFileSync(new URL(p,root))).digest('hex')])),runs:{},metrics:{}};
for(const mode of modes){
 const runs=[];
 for(let i=0;i<3;i++)runs.push(JSON.parse(execFileSync(process.execPath,['--expose-gc',fileURLToPath(new URL('bench_one.mjs',root)),mode],{maxBuffer:20e6,encoding:'utf8'})));
 const ranked=runs[0].ranked;
 writeFileSync(new URL(`results/ranking-${mode}.json`,root),JSON.stringify(ranked,null,2));
 report.runs[mode]=runs.map(({ranked,...r})=>r);
 report.metrics[mode]={all:metrics(ranked),development:metrics(ranked.filter(c=>c.split==='development')),evaluation:metrics(ranked.filter(c=>c.split==='evaluation')),categories:Object.fromEntries([...new Set(ranked.map(c=>c.category))].map(cat=>[cat,metrics(ranked.filter(c=>c.category===cat))])),misses:ranked.filter(c=>!c.results.slice(0,5).some(h=>c.relevance[h.id]===3)).map(c=>({id:c.id,query:c.query,expected:c.relevance,top5:c.results.slice(0,5)}))};
 console.log(mode,JSON.stringify(report.metrics[mode].all));
}
writeFileSync(new URL('results/experiments.json',root),JSON.stringify(report,null,2));
