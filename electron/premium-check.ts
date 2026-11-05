import {writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import type {BrowserWindow} from 'electron';
import type {Ledger} from './ledger';
import type {MusicFiles} from './music';
import {TIERS,DEFAULT_TIERS,type Tier,type Print,type Snapshot} from '../src/shared';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
function toneFile(){const rate=22050,n=rate,buffer=Buffer.alloc(44+n*2);buffer.write('RIFF');buffer.writeUInt32LE(36+n*2,4);buffer.write('WAVE',8);buffer.write('fmt ',12);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)buffer.writeInt16LE(Math.round(Math.sin(i/rate*Math.PI*2*440)*3000*Math.sin(Math.PI*i/n)),44+i*2);return buffer;}
export async function premiumCheck(output:BrowserWindow,control:BrowserWindow,state:Snapshot,ledger:Ledger,music:MusicFiles,action:(name:string,data?:unknown)=>Promise<any>){
 const dir=join(process.cwd(),'artifacts');mkdirSync(dir,{recursive:true});const view=output.webContents;
 const fixture=(tier:Tier,id:string=tier):Print=>({id,name:'Demo Portrait',userId:'comparison',avatar:'demo:portrait',tier,quantity:1,source:'demo:comparison',style:{...DEFAULT_TIERS[tier]}});
 const run=(s:string)=>view.executeJavaScript(s);
 const source=async()=>Buffer.from(await run('document.querySelector(".paper-printer-canvas").toDataURL("image/png").split(",")[1]'),'base64');
 const snap=async(name:string)=>writeFileSync(join(dir,name+'.png'),await source());
 const waitPhotos=async(items:Print[])=>{const photos=items.filter(p=>p.avatar==='demo:portrait'),end=Date.now()+5000;while(photos.length&&Date.now()<end){const m=await run('window.__paperScene.metrics()');if(photos.every(p=>m.layouts.some((l:any)=>l.id===p.id&&l.photoLoaded)))return;await sleep(60);}if(photos.length)throw Error('Photographic demo image did not load');};
 const inject=async(items:Print[],duration=3000)=>{await run(`window.__paperDemo.batch(${JSON.stringify({items,duration,started:Date.now(),token:'validation-'+items.map(p=>p.id).join('-')})});true`);await sleep(100);await waitPhotos(items);};
 const progress=async(p:number)=>{await run(`window.__paperScene.progress(${p});true`);};
 const finish=async()=>{await progress(1);await run('window.__paperDemo.finish();true');await sleep(30);};
 try{
  await sleep(2200);state.paused=true;await run('window.__paperDemo.reset();true');await sleep(100);
  const sizes=[];
  for(const tier of TIERS){await inject([fixture(tier)]);await progress(.87);await snap('tier-'+tier);const m=await run('window.__paperScene.metrics()');sizes.push(m.layouts.find((l:any)=>l.tier===tier));}
  await progress(0);const empty=await run('window.__paperScene.pixels()');await progress(.33);const partial=await run('window.__paperScene.pixels()');await progress(1);const complete=await run('window.__paperScene.pixels()');
  if(empty[0].visiblePixels!==0||partial[0].visiblePixels<=0||complete[0].mismatchedPixels!==0)throw Error('Variable-sized reveal validation failed');
  await inject([fixture('classic','mixed-c'),fixture('royal','mixed-r'),fixture('fame','mixed-f')],1500);await progress(.8);await snap('tiers-mixed');
  await inject([{...fixture('fame','long'),name:'Alexandria Isabella Montgomery-Wellington ✨',avatar:'https://invalid.example/avatar.jpg'}]);await progress(.84);await snap('tiers-long-name');
  for(const tier of TIERS.slice(2)){await run('window.__paperDemo.reset();true');const p=fixture(tier,'effect-'+tier);await inject([p]);await finish();await run(`window.__paperDemo.spotlight(${JSON.stringify({token:'effect-'+tier,item:p,started:Date.now(),duration:p.style!.spotlightDuration})});true`);await sleep(90);await waitPhotos([p]);await run('window.__paperScene.spotProgress(.4);true');await snap('spotlight-'+tier);}
  await run('window.__paperDemo.reset();true');await sleep(80);
  const frames=join(dir,'tier-frames');mkdirSync(frames,{recursive:true});let frame=0;
  const record=async()=>{const jpg=await run('document.querySelector(".paper-printer-canvas").toDataURL("image/jpeg",.88).split(",")[1]');writeFileSync(join(frames,`frame-${String(frame++).padStart(4,'0')}.jpg`),Buffer.from(jpg,'base64'));};
  const classic=fixture('classic','video-classic'),royal=fixture('royal','video-royal'),fame=fixture('fame','video-fame'),next=fixture('classic','video-next');
  let stage=-1,spotStage=-1;
  for(let i=0;i<375;i++){
   const time=i/15,newStage=time<3?0:time<3.5?1:time<6.5?2:time<7?3:time<10?4:time<12?5:time<15?6:7;
   if(newStage!==stage){if([1,3,5,7].includes(newStage))await finish();else if(newStage===0)await inject([classic]);else if(newStage===2)await inject([royal]);else if(newStage===4)await inject([fame]);else if(newStage===6)await inject([next]);stage=newStage;}
   const newSpot=time<6.5?0:time<11.5?1:time<23.5?2:3;
   if(newSpot!==spotStage){const p=newSpot===1?royal:newSpot===2?fame:null;await run(`window.__paperDemo.spotlight(${p?JSON.stringify({token:'video-spot-'+newSpot,item:p,started:Date.now(),duration:p.style!.spotlightDuration}):'null'});true`);await sleep(40);if(p)await waitPhotos([p]);spotStage=newSpot;}
   if(stage===0)await progress(time/3);else if(stage===2)await progress((time-3.5)/3);else if(stage===4)await progress((time-7)/3);else if(stage===6)await progress((time-12)/3);
   if(newSpot===1)await run(`window.__paperScene.spotProgress(${(time-6.5)/5});true`);else if(newSpot===2)await run(`window.__paperScene.spotProgress(${(time-11.5)/12});true`);
   await record();
  }
  // Actual timers and IPC: print through a live spotlight, and decode a copied WAV.
  await run('window.__paperDemo.reset(true);true');await sleep(100);
  const local=join(dir,'local-music-test.wav');writeFileSync(local,toneFile());const imported=await music.importFile(local);if(!imported.ok||!imported.musicFile)throw Error('Local music import failed');
  const settings=structuredClone(state.settings);settings.tiers.royal.musicFile=imported.musicFile;settings.tiers.royal.musicName='Local music test.wav';settings.tiers.royal.voiceEnabled=false;settings.tts=true;state.settings=await ledger.request('save',settings);state.paused=false;await action('demo','compare');
  const deadline=Date.now()+18000;while(Date.now()<deadline&&!(state.spotlight?.item.tier==='royal'&&state.batch?.items.some(p=>p.tier==='fame')))await sleep(100);
  if(!(state.spotlight?.item.tier==='royal'&&state.batch?.items.some(p=>p.tier==='fame')))throw Error('Spotlight blocked print scheduling');
  await sleep(1000);const localAudio=await run('window.__paperAudio.metrics()');if(localAudio.musicKind!=='local file'||localAudio.mediaReady<2)throw Error('Local audio did not decode');await snap('tiers-concurrent');
  await run('window.__paperAudio.duck(true);true');await sleep(180);const ducked=await run('window.__paperAudio.metrics()');await run('window.__paperAudio.duck(false);true');await sleep(250);const restored=await run('window.__paperAudio.metrics()');
  if(!(ducked.musicGain<restored.musicGain*.75))throw Error('Music ducking did not change the actual audio gain');
  while(Date.now()<deadline&&state.completed<3)await sleep(100);
  if(state.completed!==3||!state.spotlight||state.spotlight.item.tier!=='royal'||state.spotlightQueue<1)throw Error('Printing did not finish independently of spotlight backlog');
  const measured=await run('window.__paperScene.metrics()'),concurrent={completed:state.completed,activeSpotlight:state.spotlight.item.tier,waitingSpotlights:state.spotlightQueue};
  await control.webContents.executeJavaScript('document.querySelectorAll(".nav-item")[1].click();true');await sleep(300);
  const ui=await control.webContents.executeJavaScript('({tierControls:document.querySelectorAll(".tier-settings-block").length,text:document.body.innerText})');if(ui.tierControls!==8||!ui.text.includes('Print Sounds Volume')||!ui.text.includes('Voice Volume'))throw Error('Settings UI is incomplete');
  await control.webContents.executeJavaScript('document.querySelector(".tier-settings-block").scrollIntoView({block:"start"});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');writeFileSync(join(dir,'tier-settings.png'),(await control.webContents.capturePage(undefined,{stayHidden:true})).toPNG());
  writeFileSync(join(dir,'premium-result.json'),JSON.stringify({passed:true,sizes,mask:{empty,partial,complete},frames:frame,fps:15,seconds:25,concurrent,audio:{localAudio,ducked,restored},ui,render:measured,memory:process.memoryUsage(),note:'Deterministic video export; CPU draw timings exclude compositor and encoder. No real TikTok LIVE or long-duration soak tested.'},null,2));
 }catch(error){writeFileSync(join(dir,'premium-result.json'),JSON.stringify({passed:false,error:String(error)},null,2));throw error;}
}
