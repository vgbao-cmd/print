import {memo,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {loadImage} from './image-loader';
import {bridge} from './bridge';
import {Audio} from './audio';
import {PaperScene} from './PaperScene';
import {styleFor,type Batch,type Print,type Snapshot,type Spotlight} from './shared';
import {finishHistory} from './print-layout';
import {S} from './strings';
import {playbackNow} from './playback';
export function RemoteImage({url,className='',alt=''}:{url:string;className?:string;alt?:string}){
 const [src,setSrc]=useState('');useEffect(()=>{let live=true;setSrc('');if(url)void bridge.image(url).then(async value=>{if(live&&value){const img=await loadImage(value);if(live)setSrc(img.src);}}).catch(()=>{});return()=>{live=false};},[url]);
 return src?<img src={src} className={className} alt={alt}/>:<span className={`${className} image-fallback`} aria-label={alt||S.roll.avatar}>âœ¦</span>;
}
export const Broadcast=memo(function Broadcast({state,active=false}:{state:Snapshot;active?:boolean}){
 const host=useRef<HTMLDivElement>(null),[scale,setScale]=useState(1),[last,setLast]=useState<Batch|null>(null),[history,setHistory]=useState<Print[]>([]),[testBatch,setTestBatch]=useState<Batch|null|undefined>(undefined),[testSpot,setTestSpot]=useState<Spotlight|null|undefined>(undefined);
 const effective=testBatch===undefined?state.batch:testBatch,testing=useRef(testBatch);testing.current=testBatch;
 const audio=useRef<Audio|null>(null),settings=useRef(state.settings);settings.current=state.settings;
 const latest=useRef(state);latest.current=state;const batchSound=useRef(''),spotVoice=useRef('');
 useEffect(()=>{if(!host.current)return;const obs=new ResizeObserver(entries=>{const r=entries[0].contentRect;setScale(Math.min(r.width/1080,r.height/1920));});obs.observe(host.current);return()=>obs.disconnect();},[]);
 useEffect(()=>{if(!active)return;audio.current=new Audio(()=>void bridge.audioError());audio.current.configure(settings.current);if(latest.current.stopped)audio.current.stopAll(true);void bridge.ready();const off=bridge.audio(kind=>{if(latest.current.stopped)return;if(kind==='testSound')audio.current?.sound(settings.current,'royal');else audio.current?.test(settings.current);});
  if(new URLSearchParams(location.search).has('validation')){window.__paperDemo={batch:b=>{setTestBatch(b);setLast(null);},finish:()=>{const b=testing.current;if(b)setHistory(r=>finishHistory(r,b.items,settings.current));setLast(null);setTestBatch(null);},spotlight:s=>setTestSpot(s),reset:live=>{setLast(null);setHistory([]);setTestBatch(live?undefined:null);setTestSpot(live?undefined:null);}};window.__paperAudio={metrics:()=>audio.current?.diagnostics(),duck:v=>audio.current?.duck(v),record:()=>audio.current?.record(),stopRecord:()=>audio.current?.stopRecord()??Promise.resolve('')};}
  return()=>{off();audio.current?.close();audio.current=null;delete window.__paperDemo;delete window.__paperAudio;};},[active]);
 useEffect(()=>audio.current?.configure(state.settings),[state.settings]);
 useLayoutEffect(()=>{if(state.stopped)audio.current?.stopAll(true);else audio.current?.resume();},[state.stopped]);
 useLayoutEffect(()=>{audio.current?.stopAll(false);setLast(null);setHistory([]);batchSound.current='';spotVoice.current='';if(!state.stopped)audio.current?.resume();},[state.epoch]);
 useEffect(()=>{
  const batch=effective;if(!batch||state.stopped)return;setLast(batch);const epoch=state.epoch;
  if(active&&testBatch===undefined&&batchSound.current!==batch.token){batchSound.current=batch.token;audio.current?.sound(settings.current,batch.items.some(p=>p.tier==='glow')?'glow':'classic');audio.current?.say(batch.items.filter(p=>!styleFor(p,settings.current).spotlightEnabled||!styleFor(p,settings.current).spotlightDuration),settings.current,state.queue);}
  if(testBatch!==undefined)return;
  const delay=Math.max(0,batch.duration-(playbackNow(state)-batch.started));
  const timer=setTimeout(async()=>{if(latest.current.stopped||latest.current.epoch!==epoch)return;const ok=active?await bridge.complete(batch.token):true;if(!ok||latest.current.epoch!==epoch)return;setHistory(r=>finishHistory(r,batch.items,settings.current));if(active&&!latest.current.stopped)for(const p of batch.items)if(!styleFor(p,settings.current).spotlightEnabled||!styleFor(p,settings.current).spotlightDuration)audio.current?.cue(p,settings.current);},delay);
  return()=>clearTimeout(timer);
 },[effective?.token,active,state.stopped,state.epoch]);
 useEffect(()=>{if(effective||!last||state.stopped)return;const timer=setTimeout(()=>setLast(null),1000);return()=>clearTimeout(timer);},[effective,last,state.stopped]);
 useEffect(()=>{const spot=state.spotlight;if(!spot||!active||testSpot!==undefined||state.stopped)return;const epoch=state.epoch,elapsed=playbackNow(state)-spot.started;void audio.current?.spotlight(spot,settings.current,elapsed);if(spotVoice.current!==spot.token){spotVoice.current=spot.token;audio.current?.say([spot.item],settings.current,state.spotlightQueue);}const timer=setTimeout(()=>{if(!latest.current.stopped&&latest.current.epoch===epoch)void bridge.completeSpotlight(spot.token);},Math.max(0,spot.duration-elapsed));return()=>clearTimeout(timer);},[state.spotlight?.token,active,state.stopped,state.epoch]);
 return <div className="broadcast-host" ref={host}><div className="broadcast-stage roll-studio" style={{transform:`translate(-50%, -50%) scale(${scale})`}}><PaperScene batch={effective??last} history={testBatch===undefined?(state.paperHistory??history):history} state={testSpot===undefined?state:{...state,spotlight:testSpot}} preview={!active}/></div></div>;
});
