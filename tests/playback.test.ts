import {it,expect,vi,afterEach} from 'vitest';
import {PlaybackClock,playbackNow} from '../src/playback';
import {Store} from '../electron/store';
import {demoEvents} from '../electron/demo';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('freezes virtual elapsed time and resumes without counting stopped time',()=>{
 let wall=1000;const c=new PlaybackClock(()=>wall);wall+=1200;c.stop();const stopped=c.now();wall+=90000;expect(c.now()).toBe(stopped);c.resume();wall+=300;expect(c.now()).toBe(2500);expect(playbackNow({clock:2200,sentAt:100,stopped:true},900)).toBe(2200);
});
it('reset clears active work and balances while keeping receipts, combos and configuration',()=>{
 const s=new Store(':memory:');try{const gifts=demoEvents('combo','demo:test'),likes=demoEvents('250','demo:test');s.ingest([...gifts,...likes]);s.claim(1,'active');s.runtime({stopped:true});const settings=s.settings,old=s.session;s.resetSession();expect(s.session).not.toBe(old);expect(s.settings).toEqual(settings);expect(s.complete('active')).toBe(0);expect(s.snapshot('demo:test')).toMatchObject({queue:0,spotlightQueue:0,likesRemainder:0,completed:0,received:0,top:[],paperHistory:[],honored:null,seals:[]});
 s.ingest([...gifts,...likes]);expect(s.count()).toBe(0);s.ingest([{...gifts.at(-1)!,id:'different-receipt-same-combo'}]);expect(s.count()).toBe(0);s.ingest(demoEvents('100','demo:test'));expect(s.count()).toBe(1);
 }finally{s.close();}
});
it('keeps one honored guest, bounded badges, and original paper history',()=>{
 const s=new Store(':memory:');try{for(let i=0;i<20;i++){s.ingest(demoEvents(i%2?'fame':'legendary','demo:test'));s.claim(1,'p');s.complete('p');const spot=s.claimSpotlight('s')!;s.completeSpotlight('s');if(spot.item.tier==='fame')expect(s.snapshot('demo:test').honored).toEqual(spot.item);}expect(s.get<string[]>('seals',[]).length).toBe(10);expect(s.get<any[]>('paperHistory',[]).length).toBe(12);s.resetSession();expect(s.get('honored',null)).toBeNull();}finally{s.close();}
});
it('restores a stopped active job without requeueing or crediting it twice',()=>{
 const dir=mkdtempSync(join(tmpdir(),'stopped-')),file=join(dir,'printer.sqlite');let s=new Store(file);try{s.ingest(demoEvents('royal','demo:test'));const items=s.claim(1,'original');s.runtime({stopped:true,clock:1234,batch:{token:'original',items}});s.close();s=new Store(file);expect(s.count()).toBe(0);expect(s.get<any>('runtime',null).batch.token).toBe('original');expect(s.complete('original')).toBe(1);expect(s.complete('original')).toBe(0);expect(s.snapshot('demo:test').spotlightQueue).toBe(1);}finally{s.close();rmSync(dir,{recursive:true,force:true});}
});
it('invalidates speech callbacks on Stop and clears retained speech on Reset',async()=>{
 vi.useFakeTimers();let utterance:any;const speak=vi.fn((u:any)=>utterance=u),cancel=vi.fn();vi.stubGlobal('window',{printer:{}});vi.stubGlobal('speechSynthesis',{getVoices:()=>[{lang:'en-US',voiceURI:'english'}],speak,cancel});vi.stubGlobal('SpeechSynthesisUtterance',class {constructor(public text:string){}});
 const {Audio}=await import('../src/audio');const {DEFAULTS}=await import('../src/shared');const a=new Audio();a.test({...DEFAULTS,tts:true});const old=utterance;expect(a.speaking).toBe(true);a.stopAll(true);expect(a.queue).toHaveLength(1);old.onend();vi.advanceTimersByTime(20000);expect(speak).toHaveBeenCalledTimes(1);expect(a.diagnostics()).toMatchObject({stopped:true,speaking:false,musicTracks:0,scheduledSources:0});a.resume();expect(speak).toHaveBeenCalledTimes(2);old.onend();expect(a.speaking).toBe(true);a.stopAll(false);a.resume();vi.advanceTimersByTime(20000);expect(speak).toHaveBeenCalledTimes(2);expect(a.queue).toHaveLength(0);a.close();
});
