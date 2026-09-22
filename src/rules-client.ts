import type { RulesHits, RulesRelease, RuleDetail } from './rules-types.ts';
/** Request identity prevents delayed responses from replacing a newer query/detail. */
export class RulesClient {
  state:'loading'|'ready'|'error'='loading';
  release?:RulesRelease;
  hits?:RulesHits;
  query='';
  request=0;
  detailRequest=0;
  worker:Worker;
  changed:()=>void;
  showDetail:(detail:RuleDetail|null)=>void;
  constructor(worker:Worker, changed:()=>void, showDetail:(detail:RuleDetail|null)=>void, base:string) {
    this.worker=worker;this.changed=changed;this.showDetail=showDetail;
    worker.onmessage=({data})=>{
      if(data.type==='ready'){this.state='ready';this.release=data.release;this.search(this.query);this.changed();}
      if(data.type==='results'&&data.request===this.request&&data.query===this.query){this.hits=data.hits;this.changed();}
      if(data.type==='detail'&&data.request===this.detailRequest)this.showDetail(data.detail);
      if(data.type==='error'){this.state='error';this.changed();}
    };
    worker.onerror=()=>{this.state='error';this.changed();};
    worker.postMessage({type:'init',base});
  }
  search(query:string) {
    this.query=query;this.hits=undefined;this.request++;
    if(this.state==='ready')this.worker.postMessage({type:'search',query,request:this.request});
  }
  detail(id:string) {this.worker.postMessage({type:'detail',id,request:++this.detailRequest});}
  cancelDetail(){this.detailRequest++;}
}
