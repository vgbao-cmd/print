import {webpSize} from './webp';
import {nativeImage} from 'electron';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,readdir,stat,unlink} from 'node:fs/promises';
import {join} from 'node:path';
const DOMAINS=['tiktokcdn.com','tiktokcdn-us.com','tiktokcdn-eu.com','byteoversea.com','ibytedtos.com','ibyteimg.com','muscdn.com','tiktok.com','ttwstatic.com'];
export function allowedImage(value:string){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&DOMAINS.some(d=>u.hostname===d||u.hostname.endsWith('.'+d));}catch{return false;}}
export class Images {
  constructor(private directory?:string){}
  failures=new Map<string,number>();
  private async disk(url:string){if(!this.directory)return '';try{const file=join(this.directory,createHash('sha256').update(url).digest('hex')+'.cache'),info=await stat(file);if(Date.now()-info.mtimeMs>6*3600000||info.size>2*1024*1024)return '';const data=await readFile(file,'utf8');return /^data:image\/(png|webp);base64,/.test(data)?data:'';}catch{return '';}}
  private async persist(url:string,data:string){if(!this.directory||this.disposed)return;try{await mkdir(this.directory,{recursive:true});await writeFile(join(this.directory,createHash('sha256').update(url).digest('hex')+'.cache'),data);const names=(await readdir(this.directory)).filter(n=>/^[a-f0-9]{64}\.cache$/.test(n));const files=(await Promise.all(names.map(async name=>{try{return {name,...await stat(join(this.directory!,name))};}catch{return null;}}))).filter(f=>f!==null).sort((a,b)=>a.mtimeMs-b.mtimeMs);let bytes=files.reduce((n,f)=>n+f.size,0),count=files.length;for(const f of files){if(count<=128&&bytes<=16*1024*1024)break;await unlink(join(this.directory,f.name)).catch(()=>{});count--;bytes-=f.size;}}catch{}}
  cache=new Map<string,{data:string;at:number;bytes:number}>();inflight=new Map<string,Promise<string>>();active=0;waiters:(()=>void)[]=[];bytes=0;disposed=false;controllers=new Set<AbortController>();
  async get(url:string):Promise<string>{
    if(!allowedImage(url)||this.disposed)return '';if(Date.now()-(this.failures.get(url)??0)<60000)return '';const hit=this.cache.get(url);
    if(hit&&Date.now()-hit.at<6*3600000){this.cache.delete(url);this.cache.set(url,hit);return hit.data;}
    if(hit){this.bytes-=hit.bytes;this.cache.delete(url);}
    if(this.inflight.has(url))return this.inflight.get(url)!;
    if(this.waiters.length>=64)return '';
    const request=this.load(url).then(data=>{if(!data){if(this.failures.size>=128)this.failures.delete(this.failures.keys().next().value!);this.failures.set(url,Date.now());}return data;}).finally(()=>this.inflight.delete(url));this.inflight.set(url,request);return request;
  }
  private async load(url:string){
    const original=url;
    if(this.active>=4)await new Promise<void>(resolve=>this.waiters.push(resolve));
    if(this.disposed)return '';this.active++;const controller=new AbortController();this.controllers.add(controller);const timer=setTimeout(()=>controller.abort(),6000);
    try{
      const saved=await this.disk(original);if(saved){this.cache.set(original,{data:saved,at:Date.now(),bytes:saved.length});this.bytes+=saved.length;this.trim();return saved;}
      let response:Response|undefined;
      for(let redirects=0;redirects<4;redirects++){
        if(!allowedImage(url))return '';response=await fetch(url,{signal:controller.signal,redirect:'manual',credentials:'omit',referrerPolicy:'no-referrer'});
        if(response.status>=300&&response.status<400){const location=response.headers.get('location');await response.body?.cancel();if(!location)return '';url=new URL(location,url).href;continue;}break;
      }
      if(!response?.ok||!response.headers.get('content-type')?.startsWith('image/'))return '';
      if(Number(response.headers.get('content-length'))>2*1024*1024){await response.body?.cancel();return '';}
      const chunks:Uint8Array[]=[];let bytes=0;const reader=response.body!.getReader();
      while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>2*1024*1024){await reader.cancel();return '';}chunks.push(value);}
      const buffer=Buffer.concat(chunks),webp=webpSize(buffer);if(webp){if(!webp.width||!webp.height||webp.width>4096||webp.height>4096)return '';const data='data:image/webp;base64,'+buffer.toString('base64');this.cache.set(original,{data,at:Date.now(),bytes:data.length});this.bytes+=data.length;this.trim();await this.persist(original,data);return data;}const img=nativeImage.createFromBuffer(buffer);if(img.isEmpty())return '';
      const size=img.getSize(),scale=Math.min(1,512/Math.max(size.width,size.height));
      const data=img.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale)),quality:'good'}).toDataURL();
      while(this.cache.size>=128||this.bytes+data.length>16*1024*1024){const first=this.cache.keys().next().value;if(!first)break;this.bytes-=this.cache.get(first)!.bytes;this.cache.delete(first);}
      this.cache.set(original,{data,at:Date.now(),bytes:data.length});this.bytes+=data.length;this.trim();await this.persist(original,data);return data;
    }catch{return '';}finally{clearTimeout(timer);this.controllers.delete(controller);this.active--;this.waiters.shift()?.();}
  }
  private trim(){while(this.cache.size>128||this.bytes>16*1024*1024){const key=this.cache.keys().next().value;if(!key)break;this.bytes-=this.cache.get(key)!.bytes;this.cache.delete(key);}}
  close(){this.disposed=true;for(const c of this.controllers)c.abort();this.controllers.clear();for(const resolve of this.waiters)resolve();this.waiters=[];this.cache.clear();this.bytes=0;}
}
