import {afterEach,describe,it,expect} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from '../electron/store';
import {normalize,catalog} from '../electron/normalizer';
import {demoEvents} from '../electron/demo';
import {DEFAULTS,SpeedPolicy,validSettings,type LiveEvent} from '../src/shared';
import {S} from '../src/strings';
const stores:Store[]=[];const dirs:string[]=[];
function store(file=':memory:'){const s=new Store(file);stores.push(s);return s;}
const like=(id:string,count:number,userId='a'):LiveEvent=>({id,scope:'room',type:'like',count,userId,name:'Viewer',avatar:''});
function configured(s:Store){s.save({...DEFAULTS,mappings:{royal:{id:'real-gift',name:'Catalog gift',coins:23,image:'https://p.tiktokcdn.com/gift.png'}}});}
const gift=(id:string,more:Partial<LiveEvent>={}):LiveEvent=>({...like(id,1),type:'gift',giftId:'real-gift',coins:23,...more});
afterEach(()=>{for(const s of stores.splice(0))try{s.close();}catch{}for(const d of dirs.splice(0))rmSync(d,{recursive:true,force:true});});
describe('entitlement ledger',()=>{
 it('credits per-viewer batched likes, preserves remainder and rejects duplicates',()=>{
  const s=store();expect(s.ingest([like('one',250)])[0]).toMatchObject({prints:2,remainder:50});
  s.ingest([like('two',60,'b')]);expect(s.count()).toBe(2);
  s.ingest([like('one',250)]);expect(s.count()).toBe(2);
  s.ingest([like('three',50)]);expect(s.count()).toBe(3);expect(s.snapshot('room').likesRemainder).toBe(60);
 });
 it('commits only one final combo and accounts for actual coins and quantity',()=>{
  const s=store();configured(s);
  s.ingest([gift('g1',{streak:'chain',streakable:true,count:1}),gift('g2',{streak:'chain',streakable:true,count:3}),gift('g3',{streak:'chain',streakable:true,end:true,count:5}),gift('g4',{streak:'chain',streakable:true,end:true,count:5})]);
  expect(s.count()).toBe(1);expect(s.snapshot('room').top[0].coins).toBe(115);
  expect(s.claim(1,'batch')[0]).toMatchObject({tier:'royal',quantity:5});
  expect(s.complete('batch')).toBe(1);expect(s.complete('batch')).toBe(0);
 });
 it('serves a like after at most three gifts, including across group boundaries',()=>{
  const s=store();configured(s);s.ingest([like('l',100),...Array.from({length:10},(_,i)=>gift(`g${i}`))]);
  const items=[...s.claim(3,'b1'),...s.claim(3,'b2')];expect(items.map(x=>x.tier).slice(0,4)).toEqual(['royal','royal','royal','classic']);
 });
 it('keeps all 90 entitlements while switching to groups of three',()=>{
  const s=store();s.ingest([like('bulk',9000)]);const p=new SpeedPolicy();let completed=0;
  while(s.count()){const policy=p.update(s.count(),s.settings);const token='b'+completed;const items=s.claim(policy.size,token);expect(new Set(items.map(x=>x.id)).size).toBe(items.length);completed+=s.complete(token);}
  expect(completed).toBe(90);expect(s.snapshot('room').completed).toBe(90);
 });
 it('recovers only uncommitted work after closing and reopening',()=>{
  const dir=mkdtempSync(join(tmpdir(),'printer-test-'));dirs.push(dir);const file=join(dir,'test.sqlite');
  const first=store(file);first.ingest([like('persist',350)]);first.claim(1,'done');first.complete('done');first.claim(1,'unfinished');first.close();stores.splice(stores.indexOf(first),1);
  const next=store(file);expect(next.count()).toBe(2);expect(next.snapshot('room').completed).toBe(1);expect(next.snapshot('room').likesRemainder).toBe(50);
  next.ingest([like('persist',350)]);expect(next.count()).toBe(2);
 });
 it('rolls back an entire failed receipt batch',()=>{
  const s=store();expect(()=>s.ingest([like('valid',100),like('bad',NaN)])).toThrow();expect(s.count()).toBe(0);
  expect(s.ingest([like('valid',100)])[0].fresh).toBe(true);
 });
 it('clears only pending work and keeps the active print and receipts',()=>{
  const s=store();s.ingest([like('x',500)]);s.claim(1,'active');expect(s.clear()).toBe(4);expect(s.complete('active')).toBe(1);s.ingest([like('x',500)]);expect(s.count()).toBe(0);
 });
 it('retains new arrivals while a clear-queue confirmation is open',()=>{
  const s=store();s.ingest([like('before',200)]);const confirmed=s.snapshot('room');
  s.ingest([like('after',300)]);expect(s.clear(confirmed.clearThrough)).toBe(2);expect(s.count()).toBe(3);
 });
 it('bounds the preview when receiving 1,000 synthetic events',()=>{
  const s=store();const events=demoEvents('burst','demo:local');s.ingest(events);expect(s.count()).toBeGreaterThan(400);expect(s.snapshot('demo:local').preview.length).toBeLessThanOrEqual(8);s.ingest(events);expect(s.snapshot('demo:local').duplicates).toBe(1000);
 });
});
describe('connector boundary',()=>{
 it('uses the installed v3 user avatar and per-person count instead of total',()=>{
  const e=normalize('like',{common:{msgId:'m',roomId:'123'},user:{id:'42',nickname:'ليلى 🌸',avatarThumb:{urlList:['https://p.tiktokcdn.com/avatar.jpg']}},count:250,total:'9999999'},'123');
  expect(e).toMatchObject({userId:'42',name:'ليلى 🌸',count:250,avatar:'https://p.tiktokcdn.com/avatar.jpg',scope:'tiktok:123'});
  expect(normalize('like',{common:{msgId:'m2',roomId:'0'},user:{idStr:'0',id:'42',nickname:''},count:100},'123')).toMatchObject({scope:'tiktok:123',userId:'42',name:'42'});
 });
 it('rejects no-ID replays and room-only likes',()=>{
  expect(normalize('like',{user:{id:'42'},count:100},'room')).toBeNull();
  expect(normalize('like',{common:{msgId:'x'},user:{id:'42'},total:1000},'room')).toBeNull();
 });
 it('normalizes native gift price, streak ID and final count',()=>{
  expect(normalize('gift',{common:{msgId:'m'},user:{idStr:'42',nickname:'さくら'},giftId:'g',gift:{type:1,diamondCount:23},groupId:'chain',repeatCount:5,repeatEnd:1},'r')).toMatchObject({coins:23,streak:'chain',count:5,end:true,streakable:true,userId:'42'});
 });
 it('keeps only valid real catalog metadata, preserving actual replacement price',()=>{
  expect(catalog([{id:42,name:'Rose',diamond_count:1,image:{url_list:['https://p.tiktokcdn.com/rose.png']}},{id:43,name:'Invalid',diamond_count:0,image:{url_list:['https://p.tiktokcdn.com/no.png']}}])).toEqual([{id:'42',name:'Rose',coins:1,image:'https://p.tiktokcdn.com/rose.png'}]);
 });
});
describe('configuration and language',()=>{
 it('uses the specified boundaries with hysteresis',()=>{const p=new SpeedPolicy();expect(p.update(10,DEFAULTS).duration).toBe(3000);expect(p.update(11,DEFAULTS).duration).toBe(2000);expect(p.update(10,DEFAULTS).duration).toBe(2000);expect(p.update(8,DEFAULTS).duration).toBe(3000);expect(p.update(31,DEFAULTS).duration).toBe(1000);expect(p.update(81,DEFAULTS).size).toBe(3);});
 it('rejects duplicate gifts, inverted thresholds and invalid durations',()=>{expect(()=>validSettings({...DEFAULTS,thresholds:[10,8,80]})).toThrow();expect(()=>validSettings({...DEFAULTS,durations:[0,1,2,3]})).toThrow();const g={id:'1',name:'Actual',coins:1,image:''};expect(()=>validSettings({...DEFAULTS,mappings:{glow:g,bloom:g}})).toThrow();});
 it('formats coins without currency conversion or incorrect pluralization',()=>{expect(S.coins(1)).toBe('1 COIN');expect(S.coins(2)).toBe('2 COINS');});
});
