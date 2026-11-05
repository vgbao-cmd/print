import {describe,it,expect} from 'vitest';
import {Store} from '../electron/store';
import {DEFAULTS,DEFAULT_TIERS,SCALES,TIERS,SPOT_DURATIONS,validSettings,type Print} from '../src/shared';
import {BASE_DIAMETER,finishHistory,paperPositions,printLayout} from '../src/print-layout';
import {demoEvents} from '../electron/demo';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {wrapName} from '../src/text-layout';
const item=(tier:Print['tier'],id:string=tier):Print=>({id,name:'Demo Portrait',userId:'demo',avatar:'demo:portrait',tier,quantity:1,source:'demo:test',style:{...DEFAULT_TIERS[tier]}});
describe('gift sizes and continuous paper',()=>{
 it('wraps names at word boundaries and preserves complete Unicode emoji',()=>{expect(wrapName('Demo Portrait',s=>s.length,12)).toEqual(['Demo','Portrait']);const family='👨‍👩‍👧‍👦';expect(wrapName(family+family,s=>Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(s)).length,1)).toEqual([family,family]);});
 it('uses exact requested diameter ratios and keeps every size inside the paper',()=>{
  TIERS.forEach((tier,i)=>{const l=printLayout(item(tier));expect(l.diameter/BASE_DIAMETER).toBe(SCALES[i]);expect(l.left).toBeGreaterThanOrEqual(0);expect(l.left+l.width).toBeLessThanOrEqual(650);expect(72+l.feed+l.height).toBeLessThanOrEqual(1460.0001);});
 });
 it('preserves geometry when Settings changes after a print was awarded',()=>{
  const p=item('royal'),before=printLayout(p);const changed=structuredClone(DEFAULTS);changed.tiers.royal.scale=1;expect(printLayout(p,changed)).toEqual(before);
 });
 it('never overlaps mixed sizes during grouped scanning or feeding',()=>{
  const batch=[item('classic'),item('fame'),item('glow')],history=finishHistory([],[item('royal','old-r'),item('classic','old-c')]);
  for(let i=0;i<batch.length;i++)for(const feed of [0,.25,.75,1]){const pos=paperPositions(batch,history,i,feed,DEFAULTS,1).sort((a,b)=>a.y-b.y);for(let j=1;j<pos.length;j++)expect(pos[j].y).toBeGreaterThanOrEqual(pos[j-1].y+pos[j-1].layout.height);}
 });
 it('keeps previous prints at the same coordinates across group and history handoff',()=>{
  const batch=[item('classic'),item('fame'),item('royal')],history:Print[]=[];
  for(let i=0;i<2;i++){const end=paperPositions(batch,history,i,1,DEFAULTS,1),next=paperPositions(batch,history,i+1,0,DEFAULTS,0);for(const p of end)expect(next.find(x=>x.item.id===p.item.id)!.y).toBeCloseTo(p.y);}
  const end=paperPositions(batch,history,2,1,DEFAULTS,1),done=paperPositions([],finishHistory(history,batch),0,0,DEFAULTS);for(const p of end)expect(done.find(x=>x.item.id===p.item.id)!.y).toBeCloseTo(p.y);
 });
 it('migrates old saved Settings without changing gift mappings or likes',()=>{
  const {tiers,printVolume,musicVolume,voiceVolume,...legacy}=DEFAULTS;const migrated=validSettings(legacy as typeof DEFAULTS);expect(migrated.tiers.fame.scale).toBe(4);expect(migrated.tiers.royal.spotlightDuration).toBe(5000);expect(migrated.likes).toBe(100);
 });
});
describe('durable independent spotlights',()=>{
 it('enqueues once on completion and leaves printing available while spotlight is active',()=>{
  const s=new Store(':memory:');try{s.ingest(demoEvents('compare','demo:test'));const prints=s.claim(3,'print');expect(s.complete('print')).toBe(3);expect(s.complete('print')).toBe(0);expect(s.snapshot('demo:test').spotlightQueue).toBe(2);const spot=s.claimSpotlight('spot');expect(spot!.duration).toBe(5000);s.ingest(demoEvents('100','demo:test'));expect(s.claim(1,'other').length).toBe(1);expect(s.snapshot('demo:test').spotlightQueue).toBe(1);expect(s.completeSpotlight('spot')).toBe(1);expect(s.completeSpotlight('spot')).toBe(0);}finally{s.close();}
 });
 it('creates only one fixed-duration spotlight for a five-gift combo',()=>{
  const s=new Store(':memory:');try{s.ingest(demoEvents('combo','demo:test'));s.claim(1,'p');s.complete('p');const spot=s.claimSpotlight('s');expect(spot).toMatchObject({duration:5000,item:{quantity:5}});expect(s.snapshot('demo:test').spotlightQueue).toBe(0);}finally{s.close();}
 });
 it('recovers an active spotlight and queued print without replaying completed prints',()=>{
  const s=new Store(':memory:');try{s.ingest(demoEvents('royal','demo:test'));s.claim(1,'p');s.complete('p');s.claimSpotlight('s');s.ingest(demoEvents('100','demo:test'));s.claim(1,'unfinished');s.recover();expect(s.count()).toBe(1);expect(s.snapshot('demo:test').completed).toBe(1);expect(s.claimSpotlight('new')!.duration).toBe(5000);}finally{s.close();}
 });
 it('restores pending and active spotlight rewards after closing the database',()=>{
  const dir=mkdtempSync(join(tmpdir(),'premium-recovery-')),file=join(dir,'printer.sqlite');let s=new Store(file);try{s.ingest(demoEvents('compare','demo:test'));s.claim(3,'p');s.complete('p');s.claimSpotlight('active');s.close();s=new Store(file);expect(s.snapshot('demo:test').completed).toBe(3);expect(s.count()).toBe(0);expect(s.snapshot('demo:test').spotlightQueue).toBe(2);const spot=s.claimSpotlight('recovered')!;expect(spot.item.tier).toBe('royal');s.completeSpotlight('recovered');expect(s.claimSpotlight('next')!.item.tier).toBe('fame');}finally{s.close();rmSync(dir,{recursive:true,force:true});}
 });
 it('rejects invalid scales, durations and untrusted music file paths',()=>{
  const settings=structuredClone(DEFAULTS);settings.tiers.fame.scale=5;expect(()=>validSettings(settings)).toThrow();settings.tiers.fame.scale=4;settings.tiers.fame.spotlightDuration=31000;expect(()=>validSettings(settings)).toThrow();settings.tiers.fame.spotlightDuration=12000;settings.tiers.fame.musicFile='C:/private/file.mp3';expect(()=>validSettings(settings)).toThrow();
 });
 it('uses requested default spotlight durations with Classic and Glow disabled',()=>{
  TIERS.forEach((t,i)=>{expect(DEFAULT_TIERS[t].spotlightDuration).toBe(SPOT_DURATIONS[i]);expect(DEFAULT_TIERS[t].spotlightEnabled).toBe(i>=2);});
 });
 it('holds a large spotlight backlog on disk with a bounded preview',()=>{
  const s=new Store(':memory:');try{s.ingest(demoEvents('burst','demo:test'));let i=0;while(s.count()){s.claim(3,'p'+i);s.complete('p'+i++);}expect(s.snapshot('demo:test').spotlightQueue).toBeGreaterThan(100);expect(s.snapshot('demo:test').preview.length).toBe(0);expect(s.claimSpotlight('one')!.item).toBeTruthy();}finally{s.close();}
 });
});
