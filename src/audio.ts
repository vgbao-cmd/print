import type {Print,Settings,Spotlight,Tier} from './shared';
import {DEFAULTS,styleFor} from './shared';
import {bridge} from './bridge';
import {THEMES} from './music-themes';
export function englishVoices(){return speechSynthesis.getVoices().filter(v=>/^en(?:[-_]|$)/i.test(v.lang));}
interface Track {gain:GainNode;nodes:Set<AudioScheduledSourceNode>;timer?:ReturnType<typeof setInterval>;endTimer?:ReturnType<typeof setTimeout>;element?:HTMLAudioElement;source?:MediaElementAudioSourceNode;end:number}
export class Audio {
 context?:AudioContext;printBus?:GainNode;musicBus?:GainNode;queue:string[]=[];speaking=false;timer?:ReturnType<typeof setTimeout>;closed=false;
 nodes=new Map<AudioScheduledSourceNode,AudioNode[]>();current?:Track;generation=0;settings=DEFAULTS;fadeTimers=new Set<ReturnType<typeof setTimeout>>();stopped=false;voiceGeneration=0;currentText='';
 constructor(private error:()=>void=()=>{}){}
 private init(){if(!this.context){this.context=new AudioContext();this.printBus=this.context.createGain();this.musicBus=this.context.createGain();this.printBus.connect(this.context.destination);this.musicBus.connect(this.context.destination);this.mix();}void this.context.resume();return this.context;}
 private mix(){if(!this.context)return;const c=this.context;for(const [node,v] of [[this.printBus,this.settings.printVolume],[this.musicBus,this.settings.musicVolume*(this.speaking?.22:1)]] as const){if(node){node.gain.cancelScheduledValues(c.currentTime);if(this.stopped)node.gain.setValueAtTime(0,c.currentTime);else node.gain.setTargetAtTime(v,c.currentTime,.075);}}}
 private track(node:AudioScheduledSourceNode,linked:AudioNode[],owner?:Track){this.nodes.set(node,linked);owner?.nodes.add(node);node.onended=()=>{node.disconnect();for(const n of linked)n.disconnect();this.nodes.delete(node);owner?.nodes.delete(node);};}
 private note(freq:number,at:number,length:number,volume:number,bus:AudioNode,wave:OscillatorType='sine',owner?:Track){const c=this.context!,osc=c.createOscillator(),g=c.createGain();osc.type=wave;osc.frequency.value=freq;g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(volume,at+.015);g.gain.exponentialRampToValueAtTime(.0001,at+Math.max(.03,length));osc.connect(g).connect(bus);osc.start(at);osc.stop(at+length+.025);this.track(osc,[g],owner);}
 sound(settings:Settings,tier:Tier='classic'){
  this.settings=settings;if(!settings.sound||this.closed||this.stopped)return;const c=this.init();this.mix();const at=c.currentTime;
  const buffer=c.createBuffer(1,c.sampleRate*.55,c.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.14*(1-i/data.length);
  const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=720;gain.gain.value=.45;source.connect(filter).connect(gain).connect(this.printBus!);source.start(at);this.track(source,[filter,gain]);
  for(let i=0;i<5;i++)this.note(90+i*13,at+i*.075,.055,.08,this.printBus!,'triangle');
  if(tier==='glow')for(let i=0;i<4;i++)this.note([880,1108,1318,1760][i],at+.12+i*.075,.2,.09,this.printBus!);
 }
 async spotlight(spot:Spotlight,settings:Settings,elapsed=Date.now()-spot.started){await this.music(spot.item,Date.now()+Math.max(0,spot.duration-elapsed),settings,Math.max(0,elapsed/1000),spot.duration/1000);}
 cue(item:Print,settings:Settings){const s=styleFor(item,settings);if(s.musicFile&&!this.current)void this.music(item,Date.now()+1800,settings);}
 private async music(item:Print,endWall:number,settings:Settings,offset=0,total?:number){
  if(this.closed||this.stopped)return;this.settings=settings;const c=this.init();this.mix();const generation=++this.generation,old=this.current;
  if(old){old.gain.gain.cancelScheduledValues(c.currentTime);old.gain.gain.setTargetAtTime(0,c.currentTime,.06);await new Promise<void>(resolve=>{const timer=setTimeout(()=>{this.fadeTimers.delete(timer);this.stopTrack(old);resolve();},300);this.fadeTimers.add(timer);});}
  if(this.closed||this.stopped||generation!==this.generation||Date.now()>=endWall)return;
  const style=styleFor(item,settings),gain=c.createGain(),remaining=Math.max(.05,(endWall-Date.now())/1000),at=c.currentTime;
  gain.connect(this.musicBus!);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(style.musicVolume,at+Math.min(.25,remaining/3));gain.gain.setValueAtTime(style.musicVolume,at+Math.max(Math.min(.25,remaining/3),remaining-.4));gain.gain.linearRampToValueAtTime(0,at+remaining);
  const track:Track={gain,nodes:new Set(),end:at+remaining};this.current=track;
  track.endTimer=setTimeout(()=>this.stopTrack(track),remaining*1000+20);
  if(style.musicFile){try{
    const url=await bridge.music(style.musicFile);if(this.closed||this.stopped||generation!==this.generation||this.current!==track)return;if(!url)throw Error('Missing audio');
    const element=new window.Audio(url);track.element=element;element.loop=true;const source=c.createMediaElementSource(element);track.source=source;source.connect(gain);
    let fallback=false;const fail=()=>{if(fallback||this.current!==track)return;fallback=true;element.pause();source.disconnect();element.removeAttribute('src');element.load();this.error();this.synthesize(track,item.tier,offset,total??remaining);};
    element.onloadedmetadata=()=>{if(this.current===track&&Number.isFinite(element.duration)&&element.duration>0)element.currentTime=offset%element.duration;};element.onerror=fail;await element.play().catch(fail);return;
   }catch{if(this.current===track){this.error();this.synthesize(track,item.tier,offset,total??remaining);}return;}}
  this.synthesize(track,item.tier,offset,total??remaining);
 }
 private synthesize(track:Track,tier:Tier,offset=0,total=5){
  const c=this.context!,theme=THEMES[tier],pattern=theme.notes,tempo=theme.tempo;let index=Math.floor(offset/tempo),next=c.currentTime+.025;const began=c.currentTime-offset,high=['royal','rainbow','legendary','fame'].includes(tier);
  const schedule=()=>{if(this.closed||this.current!==track){if(track.timer)clearInterval(track.timer);return;}while(next<c.currentTime+.35&&next<track.end-.15){const phase=Math.min(1,(next-began)/total),note=phase>.84&&high?[0,7,12,19][index%4]:pattern[index%pattern.length],freq=261.626*2**(note/12),energy=high?(phase<.2?.5:phase<.72?1:.7):1;this.note(freq,next,Math.min(.42,tempo*1.7),(tier==='bloom'?.18:.12)*energy,track.gain,theme.wave,track);
    if((tier==='royal'||tier==='legendary'||tier==='fame')&&index%4===0)for(const semitone of [-12,-5,0])this.note(261.626*2**(semitone/12),next,tempo*3.2,.045,track.gain,'triangle',track);
    if(high&&phase>.22&&phase<.82&&index%2===0)this.note(freq/2,next,tempo*.7,.045*energy,track.gain,'triangle',track);index++;next+=tempo*(high&&phase>.32&&phase<.74?.82:1);}};schedule();track.timer=setInterval(schedule,100);
 }
 private stopTrack(track:Track){clearInterval(track.timer);clearTimeout(track.endTimer);for(const node of track.nodes){try{node.stop();}catch{}node.disconnect();for(const linked of this.nodes.get(node)??[])linked.disconnect();this.nodes.delete(node);}track.nodes.clear();if(track.element){track.element.pause();track.element.onerror=null;track.element.removeAttribute('src');track.element.load();}track.source?.disconnect();track.gain.disconnect();if(this.current===track)this.current=undefined;}
 say(items:Print[],settings:Settings,backlog:number){
  this.settings=settings;const allowed=items.filter(p=>styleFor(p,settings).voiceEnabled);if(!settings.tts||!allowed.length||!englishVoices().length||this.closed||this.stopped)return;
  const item=allowed[0],text=item.tier==='fame'?`Welcome to the Hall of Fame, ${item.name}!`:item.tier==='legendary'?`A legendary supporter, ${item.name}!`:item.tier==='royal'?`A royal welcome, ${item.name}!`:item.tier==='rainbow'?`A rainbow celebration for ${item.name}!`:backlog>30||allowed.length>1?'Thank you, everyone!':`Thank you, ${item.name}!`;
  if(this.queue.length>=3)this.queue.splice(0,this.queue.length,'Thank you, everyone!');else this.queue.push(text);this.next(settings);
 }
 test(settings:Settings){if(this.stopped||!englishVoices().length)return;this.settings=settings;this.queue.push('Thank you! Your print is ready.');this.queue=this.queue.slice(-4);this.next({...settings,tts:true});}
 private next(settings:Settings){
  if(this.speaking||!this.queue.length||this.closed||this.stopped)return;const voices=englishVoices(),voice=voices.find(v=>v.voiceURI===settings.voice)??voices[0];if(!voice){this.queue=[];return;}
  this.speaking=true;this.mix();const generation=this.voiceGeneration;this.currentText=this.queue.shift()!;const utterance=new SpeechSynthesisUtterance(this.currentText);utterance.voice=voice;utterance.lang=voice.lang;utterance.volume=settings.voiceVolume;utterance.rate=1.05;let done=false;
  const finish=()=>{if(done||generation!==this.voiceGeneration||this.stopped||this.closed)return;done=true;clearTimeout(this.timer);this.currentText='';this.speaking=false;this.next(this.settings);this.mix();};utterance.onend=finish;utterance.onerror=finish;this.timer=setTimeout(()=>{if(generation!==this.voiceGeneration||this.stopped)return;speechSynthesis.cancel();finish();},10000);speechSynthesis.speak(utterance);
 }
 configure(settings:Settings){this.settings=settings;if(!settings.tts){this.queue=[];speechSynthesis.cancel();clearTimeout(this.timer);this.speaking=false;}this.mix();}
 duck(active:boolean){this.speaking=active;this.mix();}
 stopAll(preserveSpeech=true){this.stopped=true;this.generation++;this.voiceGeneration++;clearTimeout(this.timer);if(preserveSpeech&&this.currentText)this.queue=[this.currentText,...this.queue].slice(0,4);else if(!preserveSpeech)this.queue=[];this.currentText='';this.speaking=false;speechSynthesis.cancel();for(const timer of this.fadeTimers)clearTimeout(timer);this.fadeTimers.clear();if(this.current)this.stopTrack(this.current);for(const [node,linked] of this.nodes){try{node.stop();}catch{}node.disconnect();for(const n of linked)n.disconnect();}this.nodes.clear();this.mix();}
 resume(){if(this.closed)return;this.stopped=false;this.mix();this.next(this.settings);}
 diagnostics(){return {stopped:this.stopped,voiceGeneration:this.voiceGeneration,ttsQueued:this.queue.length,speaking:this.speaking,musicTracks:this.current?1:0,musicKind:this.current?.element?'local file':this.current?'synthesized':'none',mediaReady:this.current?.element?.readyState??0,scheduledSources:this.nodes.size,musicGain:this.musicBus?.gain.value??0,printGain:this.printBus?.gain.value??0,ducked:this.speaking,fadeTimers:this.fadeTimers.size};}
 recorder?:MediaRecorder;recordBus?:MediaStreamAudioDestinationNode;recordChunks:Blob[]=[];
 record(){if(this.recorder)return;const c=this.init();this.recordBus=c.createMediaStreamDestination();this.printBus!.connect(this.recordBus);this.musicBus!.connect(this.recordBus);this.recordChunks=[];this.recorder=new MediaRecorder(this.recordBus.stream);this.recorder.ondataavailable=e=>{if(e.data.size)this.recordChunks.push(e.data);};this.recorder.start(1000);}
 stopRecord():Promise<string>{return new Promise(resolve=>{const recorder=this.recorder;if(!recorder)return resolve('');recorder.onstop=async()=>{const data=await new Blob(this.recordChunks).arrayBuffer(),bytes=new Uint8Array(data);let s='';for(const b of bytes)s+=String.fromCharCode(b);resolve(btoa(s));if(this.recordBus){this.printBus?.disconnect(this.recordBus);this.musicBus?.disconnect(this.recordBus);}this.recordBus=undefined;this.recorder=undefined;this.recordChunks=[];};recorder.stop();});}
 close(){this.closed=true;this.generation++;this.queue=[];clearTimeout(this.timer);speechSynthesis.cancel();if(this.current)this.stopTrack(this.current);for(const timer of this.fadeTimers)clearTimeout(timer);this.fadeTimers.clear();for(const [node,linked] of this.nodes){try{node.stop();}catch{}node.disconnect();for(const n of linked)n.disconnect();}this.nodes.clear();this.musicBus?.disconnect();this.printBus?.disconnect();void this.context?.close();}
}
