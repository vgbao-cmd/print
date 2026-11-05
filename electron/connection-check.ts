import {clipboard,type BrowserWindow} from 'electron';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
export let connectionCheckStep='startup';
// Real renderer + preload + main + installed connector. No simulated LIVE success.
export async function connectionCheck(control:BrowserWindow){
  const web=control.webContents;
  if(web.isLoadingMainFrame())await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Renderer load timeout')),15000);web.once('did-finish-load',()=>{clearTimeout(timer);resolve();});});
  const js=(code:string)=>web.executeJavaScript(`(async()=>(${code}))()`);
  const wait=async(test:()=>Promise<boolean>,ms=5000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await test())return;await new Promise(r=>setTimeout(r,50));}throw Error('Connection UI check timed out');};
  await wait(async()=>await js("!!document.querySelector('.input-wrap input')"),15000);
  const type=async(value:string)=>{await js(`(()=>{const input=document.querySelector('input[aria-label="@username"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);await new Promise(r=>setTimeout(r,100));};
  const click=async(text:string)=>{
    await wait(async()=>await js(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});return !!b&&!b.disabled;})()`));
    await js(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b||b.disabled)throw Error('Button unavailable');b.click();})()`);
  };
  connectionCheckStep='Demo and LIVE separation';
  await js(`window.printer.action('stop')`);await js(`window.printer.action('demo','250')`);
  const blocked=await js(`window.printer.action('connect','pinus.si')`);
  if(blocked.ok||!await js(`(await window.printer.state()).demo`))throw Error('Demo queue mixed into LIVE');
  await js(`(async()=>{const p=await window.printer.action('resetPreview');return window.printer.action('resetSession',{token:p.token});})()`);
  connectionCheckStep='invalid username button';
  await type('invalid name');await click('CONNECT LIVE');
  await wait(async()=>await js(`document.querySelector('.connection-badge').textContent==='ERROR'&&document.body.innerText.includes('Enter a TikTok username')`));
  connectionCheckStep='real username button';
  await type(' @pinus.si ');await click('CONNECT LIVE');
  await wait(async()=>await js(`['connecting','reconnecting','connected','error'].includes((await window.printer.state()).connection)`));
  await wait(async()=>await js(`(await window.printer.state()).connectionDiagnostic?.includes('START')`));
  connectionCheckStep='duplicate connect';
  const initial=await js('window.printer.state()');
  if(initial.demo)throw Error('Connect did not switch to LIVE mode');
  // Backend must reject duplicate IPC Connect even if a renderer invokes it directly.
  const repeated=await js(`window.printer.action('connect','other.account')`);if(repeated.ok)throw Error('Duplicate connection accepted');
  const demo=await js(`window.printer.action('demo','100')`);if(demo.ok)throw Error('Demo accepted during LIVE connection');
  // Keep transport active while presentation is stopped.
  connectionCheckStep='stop';
  await js(`window.printer.action('stop')`);
  const stopped=await js('window.printer.state()');if(stopped.connection==='disconnected')throw Error('STOP disconnected TikTok');
  connectionCheckStep='real attempt result';
  await wait(async()=>await js(`['connected','reconnecting','error'].includes((await window.printer.state()).connection)`),28000);
  const observed=await js('window.printer.state()');
  if(observed.connection==='connected'&&!observed.roomId)throw Error('Connected without a room');
  connectionCheckStep='copy diagnostics';
  await js(`window.printer.action('copyDiagnostics')`);
  const diagnostics=JSON.parse(clipboard.readText());if(!diagnostics.history.some((e:any)=>e.code==='START'))throw Error('No diagnostics copied');
  await js(`window.printer.action('disconnect')`);
  await wait(async()=>await js(`document.querySelector('.connection-badge').textContent==='DISCONNECTED'`));
  connectionCheckStep='cancel pending connection';
  await type('pinus.si');await click('CONNECT LIVE');
  await wait(async()=>await js(`(await window.printer.state()).connection==='connecting'`));
  await click('DISCONNECT');
  await wait(async()=>await js(`(await window.printer.state()).connection==='disconnected'`));
  await new Promise(r=>setTimeout(r,300));
  const final=await js('window.printer.state()');if(final.connection!=='disconnected'||final.roomId)throw Error('Cancelled attempt changed the UI');
  writeFileSync(join(process.cwd(),'artifacts','connection-result.json'),JSON.stringify({passed:true,time:new Date().toISOString(),checks:['Connect button → IPC → backend → ERROR UI','LIVE mode selection','Demo/LIVE queue separation','duplicate IPC Connect rejected','STOP retains transport','Copy Diagnostics','Disconnect','reconnect and cancel during CONNECTING'],realAttempt:{state:observed.connection,message:observed.connectionMessage,roomId:observed.roomId},diagnostics,liveEventsVerified:false},null,2));
}
