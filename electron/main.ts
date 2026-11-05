import {app,BrowserWindow,ipcMain,Menu,dialog,screen,nativeImage} from 'electron';
import {join} from 'node:path';
import {appendFileSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Ledger} from './ledger';
import {TikTok} from './tiktok';
import {Images} from './images';
import {MusicFiles} from './music';
import {PRESETS,resolvePresets,verifiedMapping} from '../src/gift-guide';
import {guideCheck} from './guide-check';
import {showCheck} from './show-check';
import {premiumCheck} from './premium-check';
import {demoEvents} from './demo';
import {SpeedPolicy,validSettings,type LiveEvent,type Settings,type Snapshot} from '../src/shared';
import {S} from '../src/strings';
import {PlaybackClock} from '../src/playback';

const smoke=process.argv.includes('--smoke-test'),visual=process.argv.includes('--visual-test'),premium=process.argv.includes('--premium-test'),show=process.argv.includes('--show-test'),guide=process.argv.includes('--guide-test'),testing=smoke||visual||premium||show||guide;
if(testing){const dir=join(process.cwd(),'artifacts',`test-profile-${Date.now()}`);mkdirSync(dir,{recursive:true});app.setPath('userData',dir);}
app.setName('Live Avatar Printer');
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
let control:BrowserWindow|undefined,output:BrowserWindow|undefined,ledger:Ledger,tiktok:TikTok,images=new Images(),musicFiles:MusicFiles;
if(!app.requestSingleInstanceLock())app.exit(0);
app.on('second-instance',()=>{if(control&&!control.isDestroyed()){control.show();control.focus();}});
let ready=false,closing=false,quitReady=false,busy=false,intakeBusy=false,catalogBusy=false,resetting=false;let completions=0;
let clock=new PlaybackClock();let resetToken='';
let intake:LiveEvent[]=[];let interval:ReturnType<typeof setInterval>;
let scope='demo:local';const speed=new SpeedPolicy();
let state:Snapshot={settings:undefined as any,connection:'disconnected',message:'',paused:false,demo:true,queue:0,completed:0,likesRemainder:0,top:[],preview:[],batch:null,spotlight:null,spotlightQueue:0,mode:0,gifts:[],error:'',received:0,duplicates:0,session:'',stopped:false,clock:Date.now(),sentAt:Date.now(),epoch:0,honored:null,seals:[]};
function diagnostic(stage:string,error:unknown){
  // Never persist connector payloads, URLs, raw error messages, cookies or tokens.
  const code=error instanceof Error?error.name:'UnknownError';
  try{appendFileSync(join(app.getPath('userData'),'diagnostics.log'),`${new Date().toISOString()} ${stage} ${code}\n`);}catch{}
}
function fault(error:unknown){diagnostic('storage',error);state.error=S.errors.storage;state.paused=true;tiktok?.disconnect();publish();}
function publish(){state.clock=clock.now();state.sentAt=Date.now();state.stopped=clock.stopped;for(const win of [control,output])if(win&&!win.isDestroyed())win.webContents.send('snapshot',state);}
async function stopPlayback(){clock.stop();state.stopped=true;publish();while(busy||completions)await new Promise(r=>setTimeout(r,5));await ledger.request('runtime',{stopped:true,clock:clock.now(),batch:state.batch,spotlight:state.spotlight,epoch:state.epoch});}
async function resetPlayback(){
  resetting=true;clock.stop();state.stopped=true;state.epoch++;publish();const old=intake.splice(0);
  try{while(busy||intakeBusy||completions)await new Promise(r=>setTimeout(r,5));if(old.length)await ledger.request('ingest',old);state.session=await ledger.request('resetSession');state.batch=null;state.spotlight=null;state.honored=null;state.paperHistory=[];state.seals=[];state.queue=0;state.pendingGifts=0;state.spotlightQueue=0;state.completed=0;state.received=0;state.duplicates=0;state.likesRemainder=0;state.top=[];state.preview=[];state.error='';state.paused=false;clock.reset();state.stopped=false;publish();}
  finally{resetting=false;}await drain();await tick();
}
function windowOptions(){return {webPreferences:{preload:join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false},backgroundColor:'#101416',autoHideMenuBar:true};}
function load(win:BrowserWindow,kind:string){
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.webContents.on('will-attach-webview',e=>e.preventDefault());
  win.webContents.on('did-finish-load',()=>win.setTitle(`Live Avatar Printer — ${kind==='broadcast'?'Broadcast Output':'Control Panel'}`));
  const query:Record<string,string>={window:kind};if((visual||premium||show||guide)&&kind==='broadcast')query.validation='1';
  if(process.env.VITE_DEV_SERVER_URL)void win.loadURL(`${process.env.VITE_DEV_SERVER_URL}/?${new URLSearchParams(query)}`);
  else void win.loadFile(join(__dirname,'../dist/index.html'),{query});
}
function openOutput(){
  if(output&&!output.isDestroyed()){output.show();output.focus();return;}
  const factor=screen.getPrimaryDisplay().scaleFactor;
  ready=false;output=new BrowserWindow({...windowOptions(),title:'Live Avatar Printer — Broadcast Output',width:Math.round(1080/factor),height:Math.round(1920/factor),useContentSize:true,show:!testing});
  output.setAspectRatio(9/16);const source=output;source.webContents.on('did-finish-load',()=>{source.webContents.setZoomFactor(1);source.setContentSize(Math.round(1080/factor),Math.round(1920/factor));});
  const recover=()=>{ready=false;if(!closing)void stopPlayback().catch(fault);};
  output.on('closed',()=>{output=undefined;recover();});output.webContents.on('render-process-gone',recover);
  load(output,'broadcast');
}
function accept(e:LiveEvent){
  if(closing||state.error===S.errors.storage)return;
  intake.push(e);
  // Preserve everything already received, then disconnect at the explicit bound.
  if(intake.length>=2048){state.error=S.errors.overload;tiktok.disconnect();}
  void drain();
}
async function drain(){
  if(intakeBusy||resetting)return;intakeBusy=true;
  try{while(intake.length&&!resetting){const chunk=intake.splice(0,128);try{await ledger.request('ingest',chunk);}catch(e){intake.unshift(...chunk);throw e;}}}
  catch(error){fault(error);}finally{intakeBusy=false;}
}
async function tick(){
  if(busy||closing||resetting||!state.settings)return;busy=true;
  try{
    Object.assign(state,await ledger.request('snapshot',scope));
    const policy=speed.update(state.queue,state.settings);state.mode=policy.mode;
    if(!clock.stopped&&!state.paused&&!state.batch&&ready&&output&&!output.isDestroyed()&&state.error!==S.errors.storage){
      const token=randomUUID();const items=await ledger.request('claim',{size:policy.size,token});
      if(items.length){if(!ready||!output||output.isDestroyed()){await ledger.request('recover');state.batch=null;}else{state.batch={token,items,duration:policy.duration,started:clock.now()};state.queue=Math.max(0,state.queue-items.length);}}
    }
    if(!clock.stopped&&!state.spotlight&&ready&&output&&!output.isDestroyed()&&state.error!==S.errors.storage){const token=randomUUID(),spot=await ledger.request('claimSpotlight',token);if(spot){if(ready&&output&&!output.isDestroyed())state.spotlight={...spot,token,started:clock.now()};else await ledger.request('recover');}}
    publish();
  }catch(error){fault(error);}finally{busy=false;}
}
async function gifts(){
  if(catalogBusy)return;catalogBusy=true;
  try{
    const list=await tiktok.gifts();state.gifts=list;
    state.settings=await ledger.request('save',resolvePresets(state.settings,list));state.catalogScope=scope;await ledger.request('verify',{scope,gifts:list});state.message=S.ui.catalogLoaded;
  }catch(error){diagnostic('gift-catalog',error);state.message=S.errors.catalog;}finally{catalogBusy=false;publish();}
}
async function action(name:string,data:any){
  try{
    switch(name){
      case 'connect':state.error='';state.demo=false;state.gifts=[];state.catalogScope='';await ledger.request('verify',{scope:'',gifts:[]});tiktok.connect(typeof data==='string'?data:'');break;
      case 'disconnect':tiktok.disconnect();break;
      case 'output':openOutput();break;
      case 'pause':state.paused=!state.paused;break;
      case 'stop':await stopPlayback();break;
      case 'resume':if(clock.stopped){await ledger.request('runtime',null);clock.resume();state.stopped=false;publish();}break;
      case 'resetPreview':resetToken=randomUUID();return {ok:true,token:resetToken,message:S.show.resetPrompt};
      case 'resetSession':if(!data?.token||data.token!==resetToken)return {ok:false,message:S.errors.action};resetToken='';await resetPlayback();break;
      case 'clear':{
        const pausedBefore=state.paused;state.paused=true;publish();
        try{
          while(busy)await new Promise(r=>setTimeout(r,10));
          const snap=await ledger.request('snapshot',scope);
          const result=await dialog.showMessageBox(control!,{type:'warning',title:S.clear,message:S.clearPrompt(snap.queue),buttons:[S.ui.close,S.clear],defaultId:0,cancelId:0,noLink:true});
          if(result.response===1)await ledger.request('clear',{through:snap.clearThrough});
        }finally{state.paused=state.error===S.errors.storage?true:pausedBefore;publish();}break;
      }
      case 'session':{
        if(state.connection!=='disconnected')return {ok:false,message:S.ui.demoOnly};
        if(state.queue||state.batch||state.spotlight||state.spotlightQueue)return {ok:false,message:S.ui.newSessionBlocked};
        const result=await dialog.showMessageBox(control!,{type:'question',title:S.ui.newSession,message:S.ui.newSessionPrompt,buttons:[S.ui.close,S.ui.newSession],defaultId:0,cancelId:0,noLink:true});
        if(result.response===1){await drain();await ledger.request('session');state.message=S.ui.newSessionDone;}break;
      }
      case 'settings':{
        let settings:Settings;try{settings=validSettings(data);}catch{return {ok:false,message:S.errors.settings};}
        // Every real mapping must come from a fetched catalog or a saved mapping.
        for(const g of Object.values(settings.mappings))if(g){const real=state.gifts.find(x=>x.id===g.id)??Object.values(state.settings.mappings).find(x=>x?.id===g.id);if(!real||g.coins!==real.coins||g.image!==real.image||g.name!==real.name)return {ok:false,message:S.errors.settings};}
        for(const t of Object.values(settings.tiers))if(t.musicFile&&!await musicFiles.exists(t.musicFile))return {ok:false,message:'Choose the music file again. The saved audio could not be found.'};
        state.settings=await ledger.request('save',settings);if(state.catalogScope===scope)await ledger.request('verify',{scope,gifts:state.gifts});state.message=S.ui.settingsSaved;break;
      }
      case 'gifts':await gifts();break;
      case 'pickMusic':try{return await musicFiles.select(control!);}catch(error){diagnostic('music-import',error);return {ok:false,message:'The audio file could not be imported. Choose a readable audio file smaller than 20 MB.'};}
      case 'demo':{
        if(state.connection!=='disconnected')return {ok:false,message:S.ui.demoOnly};
        await drain();state.demo=true;scope='demo:local';
        const events=demoEvents(String(data),scope);if(!events.length)return {ok:false,message:S.errors.action};
        await ledger.request('scope',scope);for(const e of events)accept(e);await drain();state.message=S.ui.demoAccepted;break;
      }
      case 'testSound':case 'testVoice':if(state.stopped)return {ok:false,message:S.show.stopped};if(!output)openOutput();output?.webContents.send('audio',name);break;
      default:return {ok:false,message:S.errors.action};
    }
    await tick();publish();return {ok:true};
  }catch(error){fault(error);return {ok:false,message:S.errors.storage};}
}
app.whenReady().then(async()=>{
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Live Avatar Printer',submenu:[{label:'Open Broadcast Window',click:openOutput},{type:'separator'},{label:'Exit',role:'quit'}]},{label:'View',submenu:[{label:'Toggle Full Screen',role:'togglefullscreen'}]}]));
  images=new Images(join(app.getPath('userData'),'image-cache'));ledger=new Ledger(app.getPath('userData'));musicFiles=new MusicFiles(join(app.getPath('userData'),'music'));const loaded=await ledger.request('load');state.settings=loaded.settings;state.session=loaded.session;scope=loaded.scope;state.demo=scope.startsWith('demo:');
  if(loaded.runtime?.stopped){clock=new PlaybackClock(Date.now,loaded.runtime.clock,true);state.stopped=true;state.batch=loaded.runtime.batch;state.spotlight=loaded.runtime.spotlight;state.epoch=loaded.runtime.epoch??0;}
  tiktok=new TikTok(accept,(connection,message)=>{state.connection=connection;state.message=message;publish();},room=>{scope=`tiktok:${room}`;state.demo=false;state.gifts=[];state.catalogScope='';void ledger.request('verify',{scope:'',gifts:[]}).catch(fault);void ledger.request('scope',scope).catch(fault);void gifts();});
  control=new BrowserWindow({...windowOptions(),title:'Live Avatar Printer — Control Panel',width:1320,height:920,minWidth:980,minHeight:720,show:!testing});
  control.on('closed',()=>{control=undefined;app.quit();});load(control,'control');openOutput();
  const isControl=(id:number)=>control?.webContents.id===id;
  const isOutput=(id:number)=>output?.webContents.id===id;
  ipcMain.handle('state',e=>(isControl(e.sender.id)||isOutput(e.sender.id))?state:null);
  ipcMain.handle('image',(e,value)=>{if(!(isControl(e.sender.id)||isOutput(e.sender.id))||typeof value!=='string'||value.length>4096)return '';
    if(value.startsWith('gift:')){const tier=value.slice(5) as keyof typeof PRESETS;if(!PRESETS[tier])return '';try{return 'data:image/webp;base64,'+readFileSync(join(app.getAppPath(),'resources','gifts',tier+'.webp')).toString('base64');}catch{return '';}}
    if(value==='demo:portrait')return nativeImage.createFromPath(join(app.getAppPath(),'resources','demo-portrait.jpg')).resize({width:512}).toDataURL();return images.get(value);});
  ipcMain.handle('music',(e,token)=>isOutput(e.sender.id)?musicFiles.data(token):'');
  ipcMain.handle('audioError',e=>{if(isOutput(e.sender.id)){state.message='The selected music could not be played. A built-in theme is playing. Choose another audio file in Settings.';diagnostic('audio-file',Error('Unsupported audio'));publish();}});
  ipcMain.handle('action',(e,name,data)=>isControl(e.sender.id)?action(name,data):{ok:false});
  ipcMain.handle('ready',e=>{if(isOutput(e.sender.id)){ready=true;publish();}});
  ipcMain.handle('complete',async(e,token)=>{
    const batch=state.batch;
    if(closing||resetting||clock.stopped||!isOutput(e.sender.id)||!batch||token!==batch.token||clock.now()-batch.started<batch.duration-80)return false;
    completions++;try{await ledger.request('complete',token);if(state.batch?.token===token)state.batch=null;await tick();return true;}catch(error){fault(error);return false;}finally{completions--;}
  });
  ipcMain.handle('completeSpotlight',async(e,token)=>{const spot=state.spotlight;if(closing||resetting||clock.stopped||!isOutput(e.sender.id)||!spot||spot.token!==token||clock.now()-spot.started<spot.duration-80)return false;completions++;try{await ledger.request('completeSpotlight',token);if(state.spotlight?.token===token)state.spotlight=null;await tick();return true;}catch(error){fault(error);return false;}finally{completions--;}});
  interval=setInterval(()=>void tick(),250);await tick();
  if(smoke)void smokeTest();
  if(visual)void visualTest();
  if(guide)void guideCheck(output!,control!,state,ledger,images,action).then(()=>app.quit()).catch(error=>{diagnostic('guide-check',error);app.exit(1);});
  if(show)void showCheck(output!,control!,state,ledger,action).then(()=>app.quit()).catch(error=>{diagnostic('show-check',error);app.exit(1);});
  if(premium)void premiumCheck(output!,control!,state,ledger,musicFiles,action).then(()=>app.quit()).catch(error=>{diagnostic('premium-check',error);app.exit(1);});
}).catch(error=>{diagnostic('startup',error);dialog.showErrorBox('Live Avatar Printer',S.errors.storage);app.exit(1);});

async function smokeTest(){
  try{
    await new Promise(resolve=>setTimeout(resolve,1800));
    // Synthetic only: exercise the actual worker, both renderers and completion IPC.
    await action('demo','250');await action('demo','royal');
    await new Promise(resolve=>setTimeout(resolve,10500));
    const views=[];
    for(const [kind,win] of [['control',control],['broadcast',output]] as const){
      if(!win)throw Error('Missing window');
      const info=await win.webContents.executeJavaScript(`({title:document.title,text:document.body.innerText,canvas:document.querySelector('.broadcast-stage')?{width:document.querySelector('.broadcast-stage').offsetWidth,height:document.querySelector('.broadcast-stage').offsetHeight}:null})`);
      writeFileSync(join(process.cwd(),'artifacts',`${kind}.png`),(await win.webContents.capturePage()).toPNG());views.push({kind,...info});
    }
    const final=await ledger.request('snapshot',scope);
    if(final.completed!==3||final.queue!==0||final.likesRemainder!==50)throw Error('Unexpected smoke totals');
    writeFileSync(join(process.cwd(),'artifacts','smoke-result.json'),JSON.stringify({passed:true,final,views},null,2));app.quit();
  }catch(error){diagnostic('smoke',error);writeFileSync(join(process.cwd(),'artifacts','smoke-result.json'),JSON.stringify({passed:false,error:String(error)}));app.exit(1);}
}
async function visualTest(){
 try{
  await new Promise(resolve=>setTimeout(resolve,2200));state.paused=true;publish();
  const view=output!.webContents;
  const base={id:'photo-demo',userId:'photo',name:'Demo Portrait',avatar:'demo:portrait',tier:'royal',quantity:1,source:'demo:visual'};
  const batch={token:'visual-photo',started:Date.now(),duration:4000,items:[base]};
  const inject=async(b:unknown)=>{await view.executeJavaScript(`window.__paperDemo.batch(${JSON.stringify(b)})`);await new Promise(r=>setTimeout(r,450));};
  const progress=async(p:number)=>{await view.executeJavaScript(`window.__paperScene.progress(${p});true`);};
  const source=async()=>Buffer.from(await view.executeJavaScript('document.querySelector(".paper-printer-canvas").toDataURL("image/png").split(",")[1]'),'base64');
  const snapshot=async(name:string)=>writeFileSync(join(process.cwd(),'artifacts',`paper-${name}.png`),await source());
  await inject(batch);
  const stages:Record<string,unknown>={};
  for(const [name,p] of [['empty',.03],['half',.33],['name',.69],['feeding',.93],['complete',1]] as const){await progress(p);await snapshot(name);stages[name]=await view.executeJavaScript('window.__paperScene.pixels()');}
  const frames=join(process.cwd(),'artifacts','paper-frames');mkdirSync(frames,{recursive:true});let frame=0;
  const record=async()=>{const png=await view.executeJavaScript('document.querySelector(".paper-printer-canvas").toDataURL("image/png").split(",")[1]');writeFileSync(join(frames,`frame-${String(frame++).padStart(4,'0')}.png`),Buffer.from(png,'base64'));};
  for(let i=0;i<80;i++){await progress(i/79);await record();}
  await view.executeJavaScript('window.__paperDemo.finish()');await new Promise(r=>setTimeout(r,100));for(let i=0;i<20;i++)await record();
  await inject({...batch,token:'visual-next',items:[{...base,id:'second',name:'Jamie Chen',tier:'glow'}]});
  for(let i=0;i<80;i++){await progress(i/79);await record();}
  await view.executeJavaScript('window.__paperDemo.finish()');await new Promise(r=>setTimeout(r,100));for(let i=0;i<20;i++)await record();
  await inject({...batch,token:'visual-group',duration:1500,items:[{...base,id:'third',name:'Alex Rivera'},{...base,id:'fourth',name:'さくら 🌸',tier:'bloom'},{...base,id:'fifth',name:'ليلى أحمد',avatar:'https://invalid.example/avatar.jpg',tier:'legendary'}]});await progress(.78);await snapshot('group');await progress(1);await view.executeJavaScript('window.__paperDemo.finish()');
  await inject({...batch,token:'visual-long',items:[{...base,id:'sixth',name:'Alexandria Isabella Montgomery-Wellington ✨',avatar:'https://invalid.example/avatar.jpg',tier:'rainbow'}]});await progress(.84);await snapshot('long-name');
  await inject({...batch,token:'visual-full',items:[{...base,id:'sixth-photo',name:'Taylor Morgan',tier:'love'}]});await progress(.84);await snapshot('full');
  const phone=nativeImage.createFromBuffer(await source()).resize({width:360,height:640,quality:'best'});writeFileSync(join(process.cwd(),'artifacts','paper-phone.png'),phone.toPNG());
  const metrics=await view.executeJavaScript('window.__paperScene.metrics()');
  const get=(name:string)=>(stages[name] as any[])[0];
  if(get('empty').visiblePixels!==0||get('half').visiblePixels<=0||get('half').mismatchedPixels<=0||get('complete').mismatchedPixels!==0)throw Error('Reveal mask check failed');
  writeFileSync(join(process.cwd(),'artifacts','visual-result.json'),JSON.stringify({passed:true,design:'Front-facing continuous roll paper',stages,metrics,frames:frame,videoFps:20,phone:'360 × 640 downsample of the actual 1080 × 1920 source',photoSource:'NASA s90-38573 (sample portrait, not TikTok)',note:'Canvas draw timings include validation rendering. This is not a sustained LIVE or end-to-end GPU benchmark.'},null,2));app.quit();
 }catch(error){writeFileSync(join(process.cwd(),'artifacts','visual-result.json'),JSON.stringify({passed:false,error:String(error)}));app.exit(1);}
}
app.on('before-quit',event=>{
  if(quitReady)return;event.preventDefault();if(closing)return;
  closing=true;clearInterval(interval);tiktok?.disconnect(false);images.close();
  void (async()=>{
    while(intakeBusy||busy)await new Promise(resolve=>setTimeout(resolve,10));
    await drain();if(ledger&&!ledger.failed)await ledger.close();
  })().catch(error=>diagnostic('shutdown',error)).finally(()=>{quitReady=true;app.quit();});
});
app.on('window-all-closed',()=>app.quit());
