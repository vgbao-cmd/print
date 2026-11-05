import {parentPort,workerData} from 'node:worker_threads';
import {Store} from './store';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
mkdirSync(workerData.directory,{recursive:true});
const store=new Store(join(workerData.directory,'printer.sqlite'),giftDiagnostic=>parentPort!.postMessage({giftDiagnostic}));
parentPort!.on('message',({id,type,data})=>{
  try{
    let result:unknown;
    switch(type){
      case 'load':result={settings:store.settings,session:store.session,scope:store.get('scope','demo:local'),runtime:store.get('runtime',null)};break;
      case 'verify':result=store.verify(data.scope,data.gifts);break;
      case 'runtime':result=store.runtime(data);break;
      case 'resetSession':result=store.resetSession();break;
      case 'scope':store.set('scope',data);break;
      case 'ingest':result=store.ingest(data);break;
      case 'snapshot':result=store.snapshot(data);break;
      case 'claim':result=store.claim(data.size,data.token);break;
      case 'complete':result=store.complete(data);break;
      case 'claimSpotlight':result=store.claimSpotlight(data);break;
      case 'completeSpotlight':result=store.completeSpotlight(data);break;
      case 'clear':result=store.clear(data?.through);break;
      case 'recover':result=store.recover();break;
      case 'save':result=store.save(data);break;
      case 'session':result=store.newSession();break;
      case 'close':store.close();break;
      default:throw Error('Unsupported persistence operation');
    }
    parentPort!.postMessage({id,result});if(type==='close')parentPort!.close();
  }catch(error){parentPort!.postMessage({id,error:error instanceof Error?error.message:'Persistence failure'});}
});
