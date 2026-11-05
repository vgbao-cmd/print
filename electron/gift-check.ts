import {EventEmitter} from 'node:events';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {BrowserWindow} from 'electron';
import type {Factory} from './tiktok';
import type {Ledger} from './ledger';
import {PRESETS} from '../src/gift-guide';
import {TIERS,type Snapshot} from '../src/shared';
const room='90000000001';
const catalog=TIERS.slice(1).map((t,i)=>({...PRESETS[t]!,id:String(900000001+i),image:''}));
class FixtureClient extends EventEmitter {
 async connect(){return {isConnected:true,roomId:room};}
 async disconnect(){}
 async fetchAvailableGifts(){return catalog.map(g=>({...g,diamond_count:g.coins}));}
}
let client:FixtureClient;
export const giftCheckFactory:Factory=async()=>client=new FixtureClient();
export async function giftCheck(control:BrowserWindow,output:BrowserWindow,state:Snapshot,ledger:Ledger,action:(name:string,data?:any)=>Promise<any>){
 const sleep=(n:number)=>new Promise(r=>setTimeout(r,n));
 const wait=async(fn:()=>boolean,ms=15000)=>{const end=Date.now()+ms;while(Date.now()<end){if(fn())return;await sleep(50);}throw Error('Gift pipeline check timed out');};
 await sleep(1500);await action('stop');await action('connect','fixture.account');
 await wait(()=>state.gifts.length===7&&state.catalogScope===`tiktok:${room}`);
 await action('settings',{...state.settings,likes:123,durations:[500,500,500,500]});
 const event=(index:number,id:string,more:any={})=>({common:{msgId:id,roomId:room},user:{id:'9001',nickname:'Fixture Viewer'},giftId:catalog[index].id,gift:{id:catalog[index].id,name:catalog[index].name,diamondCount:catalog[index].coins,type:0},repeatCount:1,repeatEnd:0,groupId:'0',...more});
 for(let i=0;i<7;i++)client.emit('gift',event(i,String(9100+i)));
 const combo=event(0,'9200',{gift:{...event(0,'0').gift,type:1},groupId:'9300'});
 for(const [repeatCount,repeatEnd] of [[1,0],[2,0],[3,1],[3,1]])client.emit('gift',{...combo,repeatCount,repeatEnd});
 for(const id of ['9400','9401'])client.emit('gift',event(0,id));
 client.emit('like',{common:{msgId:'9500',roomId:room},user:{id:'9001',nickname:'Fixture Viewer'},count:246});
 await wait(()=>state.queue===12);
 const snap=await ledger.request('snapshot',`tiktok:${room}`);
 if(snap.completed!==0||!state.stopped||snap.preview[7]?.quantity!==3)throw Error('STOP/combo queue mismatch');
 if(!state.recentGiftEvents?.some(e=>e.outcome==='duplicate')||!state.recentGiftEvents.some(e=>e.outcome==='combo pending')||TIERS.slice(1).some(t=>!state.recentGiftEvents!.some(e=>e.tier===t&&e.outcome==='queued')))throw Error('Gift diagnostic stages missing');
 const ui=await control.webContents.executeJavaScript('document.body.innerText');if(!ui.includes('Recent Gift Events')||!ui.includes('QUEUED'))throw Error('Gift diagnostics not displayed in Control Panel');
 if(await output.webContents.executeJavaScript('!!document.querySelector(".recent-gift-events")'))throw Error('Technical diagnostics leaked to Broadcast Output');
 await action('resume');await wait(()=>state.completed===12,25000);
 writeFileSync(join(process.cwd(),'artifacts','gift-intake-result.json'),JSON.stringify({passed:true,time:new Date().toISOString(),liveVerified:false,transport:'Synthetic connector factory and native-shaped payloads; actual Electron/IPC/worker/SQLite/scheduler/output',fixtureMappings:catalog.map((g,i)=>({...g,tier:TIERS[i+1]})),queuedWhileStopped:snap.queue,completed:state.completed,likesThreshold:state.settings.likes,diagnostics:state.recentGiftEvents},null,2));
}
