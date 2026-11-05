import {describe,it,expect} from 'vitest';
import {WebcastGiftMessage,Gift,User,CommonMessageData} from 'tiktok-live-proto/v3';
import {normalize,catalog,giftRejection} from '../electron/normalizer';
import {Store} from '../electron/store';
import {resolvePresets,PRESETS} from '../src/gift-guide';
import {TIERS,type GiftEventDiagnostic} from '../src/shared';
const room='789';
const list=TIERS.slice(1).map((t,i)=>({...PRESETS[t]!,id:String(100+i),image:''}));
function payload(index=0,changes:any={}){
 const m=Object.assign(WebcastGiftMessage.decode(new Uint8Array()),{giftId:list[index].id,repeatCount:1,common:Object.assign(CommonMessageData.decode(new Uint8Array()),{msgId:'456',roomId:room}),user:Object.assign(User.decode(new Uint8Array()),{id:'123',nickname:'Viewer'}),gift:Object.assign(Gift.decode(new Uint8Array()),{id:list[index].id,name:list[index].name,diamondCount:list[index].coins,type:0}),...changes});
 return WebcastGiftMessage.decode(WebcastGiftMessage.encode(m).finish());
}
function store(){const diagnostics:GiftEventDiagnostic[]=[];const s=new Store(':memory:',e=>diagnostics.push(e));s.save(resolvePresets(s.settings,list));s.verify('tiktok:'+room,list);return {s,diagnostics};}
describe('installed v3 protobuf gift intake (synthetic transport)',()=>{
 it.each(TIERS.slice(1).map((t,i)=>[t,i] as const))('queues %s using real-shaped ID/name/price metadata, without requiring a catalog image', (tier,i)=>{
  const {s,diagnostics}=store();try{const e=normalize('gift',payload(i),room)!;expect(e).not.toBeNull();s.ingest([e]);expect(s.claim(1,'test')[0]).toMatchObject({tier,quantity:1});expect(diagnostics.at(-1)).toMatchObject({outcome:'queued',tier,giftId:list[i].id,coins:list[i].coins});}finally{s.close();}
 });
 it('catalog retains gifts without images; Rose and Rosa remain separate IDs',()=>{expect(catalog(list.map(g=>({...g,diamond_count:g.coins})))).toHaveLength(7);expect(list[0].id).not.toBe(list[2].id);});
 it('does not consume the final combo when intermediate and final share msgId; deduplicates final and independent sends separately',()=>{
  const {s,diagnostics}=store();try{
   const base=payload(0,{groupId:'99'});base.gift!.type=1;
   for(const [repeatCount,repeatEnd] of [[1,0],[2,0],[3,1],[3,1]])s.ingest([normalize('gift',{...base,repeatCount,repeatEnd},room)!]);
   expect(s.count()).toBe(1);expect(s.claim(1,'a')[0]).toMatchObject({tier:'glow',quantity:3});expect(diagnostics.map(e=>e.outcome)).toEqual(['combo pending','combo pending','queued','duplicate']);
   s.ingest([normalize('gift',{...base,common:{...base.common,msgId:'new-final'},repeatEnd:1,repeatCount:3},room)!]);expect(s.count()).toBe(0);expect(diagnostics.at(-1)?.outcome).toBe('duplicate');
   for(const groupId of ['100','101'])s.ingest([normalize('gift',{...base,common:{...base.common,msgId:groupId},groupId,repeatEnd:1},room)!]);expect(s.count()).toBe(2);
  }finally{s.close();}
 });
 it('accepts numeric/string IDs, resolves unset price from verified catalog, and does not wait for combo-end on ordinary gifts',()=>{
  const {s}=store();try{const raw:any=payload(0);raw.giftId=100;raw.gift.diamondCount=0;const e=normalize('gift',raw,room)!;expect(e.coins).toBeUndefined();s.ingest([e]);expect(s.count()).toBe(1);expect(normalize('gift',{...raw,giftId:'0'},room)?.giftId).toBe('100');}finally{s.close();}
 });
 it('keeps verification gates on reconnect, replays deferred gifts once, and explains missing mappings and prices',()=>{
  const {s,diagnostics}=store();try{const e=normalize('gift',payload(),room)!;
   s.verify('',[]);s.ingest([e]);expect(diagnostics.at(-1)?.outcome).toBe('verification failed');expect(s.count()).toBe(0);
   s.verify('tiktok:other',list);expect(s.count()).toBe(0);s.verify(e.scope,list);expect(s.count()).toBe(1);s.verify(e.scope,list);expect(s.count()).toBe(1);
   s.ingest([{...e,id:'bad-price',coins:999}]);expect(diagnostics.at(-1)?.reason).toContain('price');
   s.save({...s.settings,mappings:{}});s.ingest([{...e,id:'unmapped'}]);expect(diagnostics.at(-1)?.outcome).toBe('unmapped');
  }finally{s.close();}
 });
 it('reports rejected zero counts, missing group IDs and mismatched rooms without guessing quantity or identity',()=>{
  const base:any=payload();base.repeatCount=0;expect(normalize('gift',base,room)).toBeNull();expect(giftRejection(base,room)).toContain('count');
  base.repeatCount=1;base.gift.type=1;expect(normalize('gift',base,room)).toBeNull();expect(giftRejection(base,room)).toContain('group');
  expect(normalize('gift',payload(), 'other')).toBeNull();
 });
 it('preserves configurable like thresholds alongside queued gift work',()=>{
  const {s}=store();try{s.save({...s.settings,likes:123});s.ingest([normalize('gift',payload(),room)!]);s.ingest([normalize('like',{common:{msgId:'like'},user:{id:'123'},count:246},room)!]);expect(s.count()).toBe(3);expect(s.snapshot('tiktok:'+room).likesRemainder).toBe(0);}finally{s.close();}
 });
});
