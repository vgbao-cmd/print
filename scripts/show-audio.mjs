import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
const dir='artifacts/shows',r=JSON.parse(readFileSync(dir+'/result.json','utf8'));
await build({entryPoints:['src/music-themes.ts'],outfile:dir+'/themes.cjs',bundle:true,platform:'node',format:'cjs'});
const {THEMES}=createRequire(import.meta.url)('../artifacts/shows/themes.cjs');
const stops=r.events.flatMap((e,i)=>e.name.startsWith('STOP during')?[[e.time/1000,r.events[i+1].time/1000]]:[]);
const virtual=t=>t-stops.reduce((n,[a,b])=>n+Math.max(0,Math.min(t,b)-a),0);
const rate=24000,seconds=r.seconds,virtualSamples=new Float64Array(Math.ceil(rate*seconds)),samples=new Float64Array(Math.ceil(rate*seconds));
function note(freq,start,length,volume,wave,envelope){const from=Math.round(start*rate),to=Math.min(virtualSamples.length,Math.round((start+length)*rate));for(let i=from;i<to;i++){const t=(i-from)/rate,phase=t*freq*2*Math.PI,osc=wave==='triangle'?2/Math.PI*Math.asin(Math.sin(phase)):Math.sin(phase),gain=t<.015?t/.015:Math.exp(Math.log(.0001/Math.max(volume,.001))*(t-.015)/Math.max(.02,length-.015));virtualSamples[i]+=osc*volume*gain*envelope(i/rate);}}
for(const song of r.musicTimeline){const theme=THEMES[song.tier],start=virtual(song.time),end=start+song.duration,envelope=t=>Math.max(0,Math.min(1,(t-start)/.25,(end-t)/.4))*.65*.35;let index=0;
 for(let at=start+.025;at<end-.15;){const phase=(at-start)/song.duration,energy=phase<.2?.5:phase<.72?1:.7,n=phase>.84?[0,7,12,19][index%4]:theme.notes[index%theme.notes.length],freq=261.626*2**(n/12);note(freq,at,Math.min(.42,theme.tempo*1.7),.12*energy,theme.wave,envelope);
  if(['royal','legendary','fame'].includes(song.tier)&&index%4===0)for(const n of [-12,-5,0])note(261.626*2**(n/12),at,theme.tempo*3.2,.045,'triangle',envelope);
  if(phase>.22&&phase<.82&&index%2===0)note(freq/2,at,theme.tempo*.7,.045*energy,'triangle',envelope);index++;at+=theme.tempo*(phase>.32&&phase<.74?.82:1);
 }
}
for(let i=0;i<samples.length;i++){const t=i/rate;if(!stops.some(([a,b])=>t>=a&&t<b))samples[i]=virtualSamples[Math.floor(virtual(t)*rate)]??0;}
let seed=491;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(const start of r.printTimeline){let filtered=0;for(let j=0;j<rate*.55;j++){const at=Math.round(start*rate)+j,t=at/rate;if(at>=samples.length)break;filtered=filtered*.88+(random()*2-1)*.12;if(!stops.some(([a,b])=>t>=a&&t<b))samples[at]+=filtered*.35*.25*(1-j/(rate*.55));}}
const wav=Buffer.alloc(44+samples.length*2);wav.write('RIFF');wav.writeUInt32LE(36+samples.length*2,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);let peak=0;for(let i=0;i<samples.length;i++){peak=Math.max(peak,Math.abs(samples[i]));wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);}
writeFileSync(dir+'/soundtrack.wav',wav);writeFileSync(dir+'/soundtrack.json',JSON.stringify({seconds,rate,peak,stops,source:'Offline rendering from original app themes, actual observed show timestamps and virtual Stop/Resume timeline; no TTS. Not a speaker or native audio recording.'},null,2));
