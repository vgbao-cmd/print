import {randomUUID} from 'node:crypto';
import {PRESETS} from '../src/gift-guide';
import {TIERS,type LiveEvent,type Tier} from '../src/shared';
export function demoEvents(kind:string,scope:string):LiveEvent[]{
  const tag=randomUUID();let sequence=0;const like=(id:string,count:number,name='Alex Rivera'):LiveEvent=>({id:`${tag}:${++sequence}`,scope,type:'like',userId:id,name,avatar:'',count});
  const gift=(id:string,tier:Tier,count=1):LiveEvent=>({...like(id,count,'Demo Portrait'),avatar:'demo:portrait',type:'gift',demoTier:tier,coins:PRESETS[tier]?.coins??0,giftId:`synthetic-${tier}`});
  if(kind==='100')return [like('demo-alex',100)];
  if(kind==='250')return [like('demo-jamie',250,'Jamie Chen')];
  if(kind==='photo')return [{...like('demo-photo',100,'Demo Portrait'),avatar:'demo:portrait'}];
  if(kind==='many')return Array.from({length:12},(_,i)=>like(`viewer-${i}`,100,`Viewer ${i+1}`));
  if(kind==='duplicate'){const e=like('demo-duplicate',100,'Taylor');return [e,{...e}];}
  if(kind==='names')return ['Nguyễn Minh Anh 🌸','小林さくら','김민준','ليلى أحمد','Alexandria Isabella Montgomery-Wellington ✨'].map((name,i)=>({...like(`unicode-${i}`,100,name),avatar:'https://invalid.example/avatar.jpg'}));
  if(kind==='combo')return [1,2,3,5,5].map((count,i)=>({...gift('demo-combo','royal',count),id:`${tag}:combo:${i}`,streak:'synthetic-'+tag,streakable:true,end:i>=3}));
  if(kind==='burst')return Array.from({length:1000},(_,i)=>i%4===0?gift(`burst-${i%37}`,TIERS[1+i%7]):like(`burst-${i%37}`,30,`Guest ${i%37+1}`));
  if(kind==='speed')return Array.from({length:90},(_,i)=>like(`speed-${i}`,100,`Guest ${i+1}`));
  if(kind==='shows')return ['royal','rainbow','legendary','fame'].map((tier,i)=>gift(`show-${i}`,tier as Tier));
  if(kind==='compare')return ['classic','royal','fame'].map((tier,i)=>gift(`comparison-${i}`,tier as Tier));
  if(kind==='guide')return TIERS.slice(1).map((tier,i)=>gift(`guide-${i}`,tier));
  if(kind==='mixed')return TIERS.map((tier,i)=>gift(`mixed-${i}`,tier));
  if(TIERS.includes(kind as Tier))return [gift('demo-style',kind as Tier)];
  return [];
}
