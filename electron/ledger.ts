import type {GiftEventDiagnostic} from '../src/shared';
import {Worker} from 'node:worker_threads';
import {join} from 'node:path';
export class Ledger {
  worker:Worker;serial=0;pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void}>();failed=false;
  constructor(directory:string,onGift:(entry:GiftEventDiagnostic)=>void=()=>{}){
    this.worker=new Worker(join(__dirname,'persistence-worker.cjs'),{workerData:{directory}});
    this.worker.on('message',m=>{if(m.giftDiagnostic){onGift(m.giftDiagnostic);return;}const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);m.error?p.reject(Error(m.error)):p.resolve(m.result);});
    this.worker.on('error',()=>this.fail());this.worker.on('exit',code=>{if(code)this.fail();});
  }
  fail(){this.failed=true;for(const p of this.pending.values())p.reject(Error('Storage worker stopped'));this.pending.clear();}
  request<T=any>(type:string,data?:unknown):Promise<T>{if(this.failed)return Promise.reject(Error('Storage unavailable'));const id=++this.serial;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.worker.postMessage({id,type,data});});}
  async close(){await this.request('close');await this.worker.terminate();}
}
