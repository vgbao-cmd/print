import {writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import type {BrowserWindow} from 'electron';
import type {Ledger} from './ledger';
import type {Snapshot} from '../src/shared';
import {demoEvents} from './demo';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export async function showCheck(output:BrowserWindow,control:BrowserWindow,state:Snapshot,ledger:Ledger,action:(name:string,data?:any)=>Promise<any>){
 const dir=join(process.cwd(),'artifacts','shows');mkdirSync(dir,{recursive:true});for(const sub of ['source','control'])mkdirSync(join(dir,sub),{recursive:true});
 const run=(code:string)=>output.webContents.executeJavaScript(code),ui=(code:string)=>control.webContents.executeJavaScript(code);
 const events:any[]=[],musicTimeline:any[]=[],printTimeline:any[]=[],checks:any={},frames:{name:string;time:number}[]=[];let memoryMax=0,textureMax=0,sourceMax=0;
 const note=(name:string)=>events.push({name,time:Date.now()-start,clock:state.clock,completed:state.completed,queue:state.queue,spotlight:state.spotlight?.item.tier,stopped:state.stopped});
 const click=async(selector:string)=>{await ui(`document.querySelector(${JSON.stringify(selector)}).click();true`);await sleep(90);};
 const snap=async(name:string)=>{await sleep(100);const data=await run('window.__paperScene.render();document.querySelector(".paper-printer-canvas").toDataURL("image/png").split(",")[1]');writeFileSync(join(dir,name+'.png'),Buffer.from(data,'base64'));};
 await sleep(2400);await action('settings',{...state.settings,tts:true});await run('window.__paperAudio.record();true');
 const start=Date.now();let frame=0,launched=false,printStopped=false,printResumed=false,spotStopped=false,spotResumed=false,voiceTried=false,burst=false,modal=false,reset=false,newWork=false;
 let printClock=0,spotClock=0,printToken='',spotToken='',honoredAt=0,modalAt=0,resetAt=0;const captured=new Set<string>();
 let previousSpot='',previousBatch='';const oldEvents=demoEvents('combo','demo:local');
 try{
  while(Date.now()-start<65000){
   const began=Date.now(),t=began-start;if(state.queue<0)throw Error('Negative queue counter');if(state.spotlight?.token!==previousSpot){previousSpot=state.spotlight?.token??'';if(state.spotlight)musicTimeline.push({time:t/1000,tier:state.spotlight.item.tier,duration:state.spotlight.duration/1000});}if(state.batch?.token!==previousBatch){previousBatch=state.batch?.token??'';if(state.batch)printTimeline.push(t/1000);}
   if(!launched&&t>500){await action('demo','shows');launched=true;note('Four individual premium shows queued');}
   if(!printStopped&&state.batch&&t>1500){await click('.playback-toggle');printStopped=true;printClock=state.clock;printToken=state.batch!.token;note('STOP during printing');}
   if(printStopped&&!printResumed&&t>3000){if(state.clock!==printClock||state.batch?.token!==printToken)throw Error('Print moved while stopped');await action('demo','100');await click('.playback-toggle');printResumed=true;note('RESUME retains the same print; new events accepted while stopped');checks.printStop=true;}
   if(!voiceTried&&state.spotlight?.item.tier==='royal'&&t>6500){await action('testVoice');voiceTried=true;checks.voiceBeforeStop=await run('window.__paperAudio.metrics()');}
   if(!spotStopped&&voiceTried&&state.spotlight?.item.tier==='royal'&&t>6900){await click('.playback-toggle');spotStopped=true;spotClock=state.clock;spotToken=state.spotlight.token;note('STOP during spotlight and speech');}
   if(spotStopped&&!spotResumed&&t>8400){if(state.clock!==spotClock||state.spotlight?.token!==spotToken)throw Error('Spotlight moved while stopped');checks.stoppedAudio=await run('window.__paperAudio.metrics()');if(checks.stoppedAudio.musicTracks||checks.stoppedAudio.scheduledSources||checks.stoppedAudio.speaking||!checks.stoppedAudio.stopped)throw Error('Audio did not stop');await click('.playback-toggle');spotResumed=true;note('RESUME continues the same spotlight');checks.spotStop=true;}
   const spot=state.spotlight;if(spot&&!state.stopped){const p=(state.clock-spot.started)/spot.duration;if(p>.65&&p<.85&&!captured.has(spot.item.tier)){captured.add(spot.item.tier);await snap(spot.item.tier);note('Show: '+spot.item.tier);}}
   if(state.honored&&!honoredAt){honoredAt=t;await snap('honored-guest');checks.honored=state.honored;note('HALL OF FAME returns to the single HONORED GUEST slot');}
   if(honoredAt&&!burst&&t>honoredAt+1200){await ledger.request('ingest',oldEvents);await action('demo','burst');burst=true;note('1,000-event burst and combo');}
   if(burst&&!modal&&state.batch){await click('.reset-session');modal=true;modalAt=t;checks.confirmation=await ui('document.querySelector(".reset-dialog").innerText');note('RESET SESSION confirmation');}
   if(modal&&!reset&&t>modalAt+1500){await click('.reset-confirm');reset=true;resetAt=t;note('RESET SESSION confirmed');}
   if(reset&&!newWork&&t>resetAt+800){if(state.batch||state.spotlight||state.queue||state.spotlightQueue||state.completed||state.honored||state.likesRemainder||state.paperHistory?.length||state.top.length)throw Error('Reset left session data behind');checks.afterReset={completed:state.completed,queue:state.queue,spotlightQueue:state.spotlightQueue,honored:state.honored};await ledger.request('ingest',oldEvents);const replay=await ledger.request('snapshot','demo:local');if(replay.queue)throw Error('Old combo replayed after reset');await action('demo','photo');newWork=true;note('Old combo replay rejected; new likes accepted');}
   if(newWork&&state.completed===1&&!state.batch&&t>resetAt+4500){await snap('fresh-session');checks.newSession=await ledger.request('snapshot','demo:local');note('New session prints exactly once');break;}
   const name=`frame-${String(frame++).padStart(4,'0')}`;frames.push({name,time:Date.now()-start});const jpg=await run('window.__paperScene.render();document.querySelector(".paper-printer-canvas").toDataURL("image/jpeg",.85).split(",")[1]');writeFileSync(join(dir,'source',name+'.jpg'),Buffer.from(jpg,'base64'));
   writeFileSync(join(dir,'control',name+'.png'),(await control.webContents.capturePage(undefined,{stayHidden:true})).toPNG());
   const audio=await run('window.__paperAudio.metrics()');sourceMax=Math.max(sourceMax,audio.scheduledSources);if(audio.musicTracks>1)throw Error('Overlapping music tracks');const metrics=await run('window.__paperScene.metrics()');textureMax=Math.max(textureMax,metrics.textures);memoryMax=Math.max(memoryMax,process.memoryUsage().rss);
   if(Date.now()-began<125)await sleep(125-(Date.now()-began));
  }
  if(!newWork||checks.newSession?.completed!==1||captured.size!==4||!checks.printStop||!checks.spotStop)throw Error('Show sequence did not complete');
  writeFileSync(join(dir,'audio.webm'),Buffer.from(await run('window.__paperAudio.stopRecord()'),'base64'));
  for(const [sub,ext] of [['source','jpg'],['control','png']])writeFileSync(join(dir,sub+'.txt'),frames.map((f,i)=>`file '${sub}/${f.name}.${ext}'\nduration ${((frames[i+1]?.time??(Date.now()-start))-f.time)/1000}\n`).join('')+`file '${sub}/${frames.at(-1)!.name}.${ext}'\n`);
  const metrics=await run('window.__paperScene.metrics()');writeFileSync(join(dir,'result.json'),JSON.stringify({passed:true,seconds:(Date.now()-start)/1000,frames:frame,events,musicTimeline,printTimeline,checks,textureMax,scheduledSourcesMax:sourceMax,mainRSSMax:memoryMax,render:metrics,note:'Actual Electron queue, controls and audio. No live TikTok or long-duration soak. Recorded audio includes WebAudio music and print sounds; native TTS is excluded from recording.'},null,2));
 }catch(error){writeFileSync(join(dir,'result.json'),JSON.stringify({passed:false,error:String(error),events,checks},null,2));throw error;}
}
