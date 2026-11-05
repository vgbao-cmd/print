import {normalize,catalog} from './normalizer';
import type {Gift,LiveEvent} from '../src/shared';
import {normalizeUsername,classifyError,safeError,type ConnectionDiagnostic} from './connection-diagnostics';
export type Client={on:(name:string,fn:(data:any)=>void)=>any;removeAllListeners:()=>any;connect:()=>Promise<any>;disconnect:()=>any;fetchAvailableGifts:()=>Promise<any>};
export type Factory=(username:string)=>Promise<Client>;
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
  phase='disconnected';private attemptId=0;
  get session(){return this.attemptId;}
  constructor(private receive:(e:LiveEvent)=>void,private status:(state:string,message:string)=>void,private onRoom:(room:string)=>void,private factory:Factory=createConnection,private log:(entry:ConnectionDiagnostic)=>void=()=>{},private timeoutMs=25000){}
  private report(stage:string,code:string,attempt:number,error?:unknown){this.log({time:new Date().toISOString(),stage,code,attempt,state:this.phase,roomId:this.room||undefined,...(error?{errors:safeError(error)}:{})});}
  private update(state:string,message=''){this.phase=state;this.status(state,message);}
  private close(c:Client){
    c.removeAllListeners();c.on('error',()=>{});
    // 2.5 disconnect does not abort an in-flight connect. Close a late socket too.
    const close=()=>{try{Promise.resolve(c.disconnect()).catch(()=>{});}catch{}};
    c.on('connected',()=>{close();c.removeAllListeners();c.on('error',()=>{});});close();
  }
  private dispose(){const c=this.client;this.client=undefined;if(c)this.close(c);}
  disconnect(announce=true){this.generation++;this.attemptId++;this.connected=false;this.room='';clearTimeout(this.timer);clearTimeout(this.deadline);this.dispose();this.phase='disconnected';if(announce){this.update('disconnected');this.report('disconnect','CANCELLED',this.attemptId);}}
  connect(input:string){
    if(['connecting','reconnecting','connected'].includes(this.phase))return false;
    this.disconnect(false);let name:string;
    try{name=normalizeUsername(input);}catch(error){const f=classifyError(error);this.update('error',f.message);this.report('validation',f.code,this.attemptId,error);return false;}
    void this.attempt(name,this.generation,0);return true;
  }
  private async attempt(name:string,generation:number,retry:number){
    const id=++this.attemptId;let failed=false,c:Client|undefined,transportError:unknown,deadline:ReturnType<typeof setTimeout>|undefined;
    const current=()=>generation===this.generation&&id===this.attemptId&&!failed;
    this.update(retry?'reconnecting':'connecting');this.report('connect','START',id);
    const fail=(error:unknown)=>{
      if(!current())return;failed=true;clearTimeout(deadline);this.connected=false;this.room='';this.dispose();
      const f=classifyError(error),again=f.retry&&retry<3;
      this.update(again?'reconnecting':'error',`${f.code}: ${f.message}${again?' Retrying shortly.':''}`);this.report('connect',f.code,id,error);
      if(again)this.timer=setTimeout(()=>{if(generation===this.generation&&id===this.attemptId)void this.attempt(name,generation,retry+1);},2000*2**retry);
    };
    // Covers module loading / factory creation as well as HTTP, signing and WebSocket.
    deadline=setTimeout(()=>fail(Error('Connection timeout')),this.timeoutMs);this.deadline=deadline;
    try{
      c=await this.factory(name);if(!current()){this.close(c);return;}this.client=c;
      for(const type of ['like','gift'] as const)c.on(type,raw=>{if(!current()||!this.connected)return;const e=normalize(type,raw,this.room);if(e)this.receive(e);});
      c.on('error',error=>{
        if(!current())return;
        // Some errors (e.g. catalog fetch) are nonfatal. connect()'s rejection and
        // disconnected are authoritative; do not kill fallback routes on error events.
        const info=String(error?.info??'');const stage=/room id/i.test(info)?'room-lookup':/room info/i.test(info)?'room-info':/gift/i.test(info)?'gift-catalog':/websocket/i.test(info)?'websocket':'connector-event';
        if(this.connected&&stage==='websocket')transportError=error;
        this.report(stage,classifyError(error).code,id,error);
      });
      c.on('disconnected',()=>{if(this.connected)fail(transportError??Error('Connection lost'));});
      c.on('streamEnd',()=>fail(Error('Account is not live')));
      const result=await c.connect();
      if(!current()){this.close(c);return;}clearTimeout(deadline);
      if(!result?.isConnected||!result?.roomId){fail(Error('Connection not confirmed'));return;}
      this.room=String(result.roomId);this.connected=true;this.onRoom(this.room);this.update('connected');this.report('room-connected','CONFIRMED',id);
    }catch(error){fail(error);}
  }
  async gifts():Promise<Gift[]>{const c=this.client,generation=this.generation;if(!c||!this.connected)throw Error('Not connected');
    const gifts=catalog(await c.fetchAvailableGifts());if(c!==this.client||generation!==this.generation)throw Error('Connection changed');if(!gifts.length)throw Error('No valid gifts');return gifts;}
}
