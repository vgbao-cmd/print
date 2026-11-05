export const TIERS = ['classic','glow','bloom','love','royal','rainbow','legendary','fame'] as const;
export type Tier = typeof TIERS[number];
export const TARGETS = [0,1,5,10,20,30,88,100];
export interface Gift {id:string; name:string; image:string; coins:number; displayName?:string}
export interface TierStyle {scale:number;spotlightEnabled:boolean;spotlightDuration:number;musicFile:string;musicName:string;musicVolume:number;voiceEnabled:boolean}
export const SCALES=[1,1.25,1.5,2,2.5,3,3.5,4];
export const SPOT_DURATIONS=[0,0,2000,3000,5000,7000,9000,12000];
export const DEFAULT_TIERS=Object.fromEntries(TIERS.map((t,i)=>[t,{scale:SCALES[i],spotlightEnabled:i>=2,spotlightDuration:SPOT_DURATIONS[i],musicFile:'',musicName:'',musicVolume:.65,voiceEnabled:true}])) as Record<Tier,TierStyle>;
export interface Settings {
  likes:number; thresholds:number[]; durations:number[]; volume:number; sound:boolean; tts:boolean; voice:string;
  mappings:Partial<Record<Tier,Gift>>;
  tiers:Record<Tier,TierStyle>;printVolume:number;musicVolume:number;voiceVolume:number;
}
export const DEFAULTS:Settings={likes:100,thresholds:[10,30,80],durations:[3000,2000,1000,1500],volume:0.35,printVolume:.35,musicVolume:.35,voiceVolume:.65,sound:true,tts:false,voice:'',mappings:{},tiers:DEFAULT_TIERS};
export interface LiveEvent {
  id:string; scope:string; type:'like'|'gift'; userId:string; name:string; avatar:string;
  count:number; giftId?:string; coins?:number; streak?:string; streakable?:boolean; end?:boolean; demoTier?:Tier;
}
export interface Print {id:string; name:string; userId:string; avatar:string; tier:Tier; quantity:number; source:string;style?:TierStyle;paperGap?:number;sealed?:boolean}
export interface Batch {token:string; items:Print[]; duration:number; started:number}
export interface Spotlight {token:string;item:Print;duration:number;started:number}
export interface Snapshot {
  guideCatalog?:Gift[];guideRoom?:string;guideAccount?:string;
  connectionMessage?:string;roomId?:string;connectionDiagnostic?:string;
  settings:Settings; connection:string; message:string; paused:boolean; demo:boolean; queue:number; completed:number;
  likesRemainder:number; top:{name:string;coins:number}[]; preview:Print[]; batch:Batch|null; mode:number;
  gifts:Gift[]; error:string; received:number; duplicates:number; session:string;
  spotlight:Spotlight|null;spotlightQueue:number;
  pendingGifts?:number;catalogScope?:string;paperHistory?:Print[];stopped:boolean;clock:number;sentAt:number;epoch:number;honored:Print|null;seals:string[];
}
export function validSettings(raw:Settings):Settings {
  const n=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
  if(!raw||!n(raw.likes,1,100000)||!Number.isInteger(raw.likes)||raw.thresholds?.length!==3||raw.durations?.length!==4||!raw.thresholds.every((v,i)=>n(v,1,100000)&&(i===0||v>raw.thresholds[i-1]))||!raw.durations.every(v=>n(v,500,30000))||!n(raw.volume,0,1)) throw Error('Invalid settings');
  const mappings:Settings['mappings']={}; const used=new Set<string>();
  for(const tier of TIERS.slice(1)) {const g=raw.mappings?.[tier]; if(!g)continue;
    if(typeof g.id!=='string'||!g.id||used.has(g.id)||!n(g.coins,1,1000000)||!Number.isInteger(g.coins)||typeof g.name!=='string'||typeof g.image!=='string')throw Error('Invalid gift mapping');
    if(tier==='legendary'&&(g.coins!==88||g.name.toLowerCase().replace(/\s/g,'')!=='takoyaki'))continue;
    used.add(g.id);mappings[tier]={id:g.id.slice(0,100),name:g.name.slice(0,200),image:g.image.slice(0,4096),coins:g.coins,displayName:String(g.displayName||'').slice(0,160)};
  }
  const tiers={} as Record<Tier,TierStyle>;
  for(const t of TIERS){const v={...DEFAULT_TIERS[t],...raw.tiers?.[t]};
    if(!n(v.scale,.5,4)||!n(v.spotlightDuration,0,30000)||!n(v.musicVolume,0,1)||typeof v.musicFile!=='string'||(v.musicFile&&!/^[a-f0-9]{64}\.(mp3|wav|ogg|m4a|flac)$/.test(v.musicFile)))throw Error('Invalid tier settings');
    tiers[t]={scale:v.scale,spotlightDuration:Math.round(v.spotlightDuration),spotlightEnabled:!!v.spotlightEnabled,musicVolume:v.musicVolume,musicFile:v.musicFile,musicName:String(v.musicName||'').slice(0,200),voiceEnabled:!!v.voiceEnabled};}
  const printVolume=raw.printVolume??raw.volume,musicVolume=raw.musicVolume??.35,voiceVolume=raw.voiceVolume??.65;
  if(![printVolume,musicVolume,voiceVolume].every(v=>n(v,0,1)))throw Error('Invalid audio volume');
  return {likes:raw.likes,thresholds:[...raw.thresholds],durations:[...raw.durations],volume:raw.volume,printVolume,musicVolume,voiceVolume,tiers,sound:!!raw.sound,tts:!!raw.tts,voice:String(raw.voice||'').slice(0,200),mappings};
}
export function styleFor(item:Print,settings?:Settings):TierStyle{return item.style??settings?.tiers[item.tier]??DEFAULT_TIERS[item.tier];}
export class SpeedPolicy {
  mode=0;
  update(count:number,s:Settings){
    let desired=s.thresholds.filter(t=>count>t).length;
    // Enter immediately. Leave only below a 20% low-water mark.
    if(desired>this.mode)this.mode=desired;
    else if(desired<this.mode&&count<=Math.floor(s.thresholds[this.mode-1]*0.8))this.mode=desired;
    return {mode:this.mode,duration:s.durations[this.mode],size:this.mode===3?3:1};
  }
}
