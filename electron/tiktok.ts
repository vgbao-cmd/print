import {normalize,catalog} from './normalizer';
import {S} from '../src/strings';
import type {Gift,LiveEvent} from '../src/shared';
type Client={on:(name:'like'|'gift'|'error'|'disconnected'|'streamEnd'|'connected',fn:(data:any)=>void)=>any;removeAllListeners:()=>any;connect:()=>Promise<any>;disconnect:()=>any;fetchAvailableGifts:()=>Promise<any>};
export type Factory=(username:string)=>Promise<Client>;
// Reused connection options from 0.16.0. No stored credentials or paid API key.
export const createConnection:Factory=async username=>{
  const {TikTokLiveConnection}=await import('tiktok-live-connector');
  return new TikTokLiveConnection(username,{
    processInitialData:false,fetchRoomInfoOnConnect:true,enableExtendedGiftInfo:false,authenticateWs:false,
    // @ts-expect-error Connector 2.5 declares cookieJar required; runtime provides a default.
    webClientOptions:{timeout:{request:10000},retry:{limit:0}},wsClientOptions:{handshakeTimeout:10000}
  }) as unknown as Client;
};
export class TikTok {
  client?:Client;generation=0;timer?:ReturnType<typeof setTimeout>;deadline?:ReturnType<typeof setTimeout>;room='';connected=false;
  constructor(private receive:(e:LiveEvent)=>void,private status:(state:string,message:string)=>void,private onRoom:(room:string)=>void,private factory:Factory=createConnection){}
  dispose(){const c=this.client;this.client=undefined;if(c){c.removeAllListeners();c.on('error',()=>{});const close=()=>{try{Promise.resolve(c.disconnect()).catch(()=>{});}catch{}};c.on('connected',close);close();}}
  disconnect(announce=true){this.generation++;this.connected=false;clearTimeout(this.timer);clearTimeout(this.deadline);this.dispose();if(announce)this.status('disconnected','');}
  connect(name:string){this.disconnect(false);name=name.trim().replace(/^@/,'');if(!/^[a-zA-Z0-9_.]{2,50}$/.test(name)){this.status('disconnected',S.ui.invalidUser);return;}void this.attempt(name,this.generation,0);}
  async attempt(name:string,generation:number,retry:number){
    if(generation!==this.generation)return;this.status(retry?'reconnecting':'connecting','');let failed=false;
    const fail=(error:any)=>{
      if(failed||generation!==this.generation)return;failed=true;clearTimeout(this.deadline);this.connected=false;this.dispose();
      const value=String(error?.message??error).toLowerCase();
      const offline=/offline|not live|usernotfound|user not found/.test(value),sign=/sign|429|rate.?limit|api.?key|401|403/.test(value);
      const message=offline?S.errors.offline:sign?S.errors.sign:S.errors.connect;
      if(!offline&&!sign&&retry<3){this.status('reconnecting',message);this.timer=setTimeout(()=>void this.attempt(name,generation,retry+1),2000*2**retry);}
      else this.status('disconnected',message);
    };
    try{
      const c=await this.factory(name);if(generation!==this.generation){c.on('error',()=>{});await c.disconnect();return;}this.client=c;
      for(const type of ['like','gift'] as const)c.on(type,raw=>{if(generation!==this.generation||failed||!this.connected)return;const e=normalize(type,raw,this.room);if(e)this.receive(e);});
      c.on('error',fail);c.on('disconnected',()=>fail(Error('Connection lost')));
      c.on('streamEnd',()=>{if(generation!==this.generation)return;this.disconnect(false);this.status('disconnected',S.errors.offline);});
      this.deadline=setTimeout(()=>fail(Error('Connection timeout')),25000);
      const state=await c.connect();clearTimeout(this.deadline);
      if(generation!==this.generation||failed){try{await c.disconnect();}catch{}return;}
      if(!state?.isConnected||!state?.roomId){fail(Error('Connection not confirmed'));return;}
      this.room=String(state.roomId);this.connected=true;this.onRoom(this.room);this.status('connected','');
    }catch(error){fail(error);}
  }
  async gifts():Promise<Gift[]>{const c=this.client,generation=this.generation;if(!c||!this.connected)throw Error('Not connected');
    const gifts=catalog(await c.fetchAvailableGifts());if(c!==this.client||generation!==this.generation)throw Error('Connection changed');if(!gifts.length)throw Error('No valid gifts');return gifts;}
}
