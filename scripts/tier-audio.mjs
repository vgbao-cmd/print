import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('artifacts',{recursive:true});
await build({entryPoints:['src/music-themes.ts'],outfile:'artifacts/music-themes.cjs',bundle:true,platform:'node',format:'cjs'});
const {THEMES}=createRequire(import.meta.url)('../artifacts/music-themes.cjs');
const rate=44100,seconds=25,samples=new Float64Array(rate*seconds);
function note(freq,start,length,volume,wave='sine',envelope=()=>1){const from=Math.round(start*rate),to=Math.min(samples.length,Math.round((start+length)*rate));for(let i=from;i<to;i++){const t=(i-from)/rate,phase=t*freq*2*Math.PI,osc=wave==='triangle'?2/Math.PI*Math.asin(Math.sin(phase)):Math.sin(phase),gain=t<.015?t/.015:Math.exp(Math.log(.0001/Math.max(volume,.001))*(t-.015)/Math.max(.02,length-.015));samples[i]+=osc*volume*gain*envelope(i/rate);}}
let seed=9321;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
for(const start of [0,3.5,7,12]){let filtered=0;for(let j=0;j<rate*.55;j++){filtered=filtered*.88+(random()*2-1)*.12;const index=Math.round(start*rate)+j;samples[index]+=filtered*.35*.25*(1-j/(rate*.55));}for(let i=0;i<5;i++)note(90+i*13,start+i*.075,.055,.08*.35,'triangle');}
for(const [tier,start,duration] of [['royal',6.5,5],['fame',11.5,12]]){
 const theme=THEMES[tier],end=start+duration,envelope=time=>Math.max(0,Math.min(1,(time-start)/.25,(end-time)/.4))*.65*.35;
 let index=0;for(let at=start+.025;at<end-.15;at+=theme.tempo,index++){note(261.626*2**(theme.notes[index%theme.notes.length]/12),at,Math.min(.42,theme.tempo*1.7),.12,theme.wave,envelope);if(index%4===0)for(const n of [-12,-5,0])note(261.626*2**(n/12),at,theme.tempo*3.2,.045,'triangle',envelope);}
}
const wav=Buffer.alloc(44+samples.length*2);wav.write('RIFF');wav.writeUInt32LE(36+samples.length*2,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);let peak=0;
for(let i=0;i<samples.length;i++){peak=Math.max(peak,Math.abs(samples[i]));wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);}
writeFileSync('artifacts/tier-comparison-audio.wav',wav);writeFileSync('artifacts/tier-audio-result.json',JSON.stringify({seconds,rate,peak,clipped:peak>1,source:'Original procedural themes shared with the application; offline soundtrack export, no TTS.'},null,2));
