import {useEffect,useRef} from 'react';
import {loadImage} from './image-loader';
import {bridge} from './bridge';
import {PaperPrinter} from './PaperPrinter';
import type {Batch,Print,Snapshot,Spotlight} from './shared';
import {S} from './strings';
import {guideItems,fallbackGiftImage} from './gift-guide';
import {playbackNow} from './playback';
declare global {interface Window {__paperScene?:{progress:(n:number)=>void;spotProgress:(n:number)=>void;metrics:()=>unknown;render:()=>void;pixels:()=>unknown};__paperDemo?:{batch:(b:Batch|null)=>void;finish:()=>void;spotlight:(s:Spotlight|null)=>void;reset:(live?:boolean)=>void};__paperAudio?:{metrics:()=>unknown;duck:(active:boolean)=>void;record:()=>void;stopRecord:()=>Promise<string>}}}
export function PaperScene({batch,history,state,preview}:{batch:Batch|null;history:Print[];state:Snapshot;preview:boolean}){
 const element=useRef<HTMLCanvasElement>(null),engine=useRef<PaperPrinter|null>(null),current=useRef(batch),override=useRef<number|null>(null);current.current=batch;
 useEffect(()=>{
  const model=new PaperPrinter(element.current!);engine.current=model;let raf=0,last=0;
  const draw=(at:number)=>{raf=requestAnimationFrame(draw);if(at-last<(preview?1000/15:1000/30))return;last=at;const b=current.current,p=override.current??(b?Math.min(1,((model.state?playbackNow(model.state):Date.now())-b.started)/b.duration):0);model.render(p);};raf=requestAnimationFrame(draw);
  if(new URLSearchParams(location.search).has('validation')&&!preview)window.__paperScene={render:()=>{const b=current.current;model.render(override.current??(b?Math.min(1,(playbackNow(model.state!)-b.started)/b.duration):0));},progress:p=>{override.current=p;model.render(p);},spotProgress:p=>{model.spotProgress=p;model.render(override.current??0);},metrics:()=>({...model.metrics,meanMs:model.metrics.totalMs/Math.max(1,model.metrics.frames),textures:model.textures.size,guide:guideItems(model.state!.settings,model.state!.demo,model.state!.connection==='connected'?model.state!.gifts:[]).map(e=>({tier:e.tier,name:e.gift.displayName||e.gift.name,coins:e.gift.coins,imageLoaded:model.giftImages.has(e.tier)})),layouts:[...model.textures.values()].map(t=>({id:t.item.id,photoLoaded:!!t.image,tier:t.item.tier,...t.layout}))}),pixels:()=>model.pixels()};
  return()=>{cancelAnimationFrame(raf);model.close();engine.current=null;if(!preview)delete window.__paperScene;};
 },[preview]);
 useEffect(()=>{if(engine.current)engine.current.state=state;},[state]);
 useEffect(()=>{
  const model=engine.current;if(!model)return;let live=true;model.setBatch(batch,history);
  const load=async()=>{await document.fonts.ready;if(!live||model.disposed)return;
   for(const t of model.textures.values())model.texture(t);
   await Promise.all([...model.textures.values()].map(async t=>{if(t.image)return;try{const src=await bridge.image(t.item.avatar);if(!src||!live)return;const img=await loadImage(src);if(live)model.setImage(t.item.id,img);}catch{}}));
  };void load();return()=>{live=false;};
 },[batch?.token,history,state.spotlight?.token,state.honored?.id,state.seals?.join(',')]);
 useEffect(()=>{override.current=null;},[batch?.token]);
 useEffect(()=>{if(engine.current)engine.current.spotProgress=null;},[state.spotlight?.token]);
 useEffect(()=>{
  const model=engine.current;if(!model)return;let live=true;const entries=guideItems(state.settings,state.demo,state.connection==='connected'?state.gifts:[]),ids=new Set(entries.map(e=>e.tier));for(const [id,image] of model.giftImages)if(!ids.has(id as any)){image.src='';model.giftImages.delete(id);}
  void Promise.all(entries.map(async ({tier,gift:g})=>{try{let src=await bridge.image(g.image);const fallback=fallbackGiftImage(g,tier);if(!src&&fallback&&fallback!==g.image)src=await bridge.image(fallback);if(!src&&fallback)src=await bridge.image('gift:'+tier);if(!src||!live)return;const img=await loadImage(src);if(live)model.giftImages.set(tier,img);}catch{}}));return()=>{live=false;};
 },[JSON.stringify(state.settings.mappings),JSON.stringify(state.gifts),state.demo,state.connection]);

 return <canvas ref={element} className="paper-printer-canvas" aria-label={S.roll.canvas}/>;
}
