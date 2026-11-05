import {EventEmitter} from 'node:events';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {TikTok,type Client} from '../electron/tiktok';
import {normalizeUsername,classifyError,safeError,type ConnectionDiagnostic} from '../electron/connection-diagnostics';
class Fake extends EventEmitter {
  disconnect=vi.fn(async()=>{});fetchAvailableGifts=vi.fn(async()=>[]);
  connect=vi.fn(async():Promise<any>=>({isConnected:true,roomId:'123'}));
}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function setup(clients:Fake[]=[new Fake()],factory?:(name:string)=>Promise<Client>){
  const status=vi.fn(),room=vi.fn(),receive=vi.fn(),log:ConnectionDiagnostic[]=[];
  const make=vi.fn(factory??(async()=>clients.shift()!));
  const t=new TikTok(receive,status,room,make,d=>log.push(d),100);
  return {t,status,room,receive,make,log};
}
afterEach(()=>vi.useRealTimers());
describe('TikTok usernames',()=>{
 it.each([' pinus.si ','@pinus.si','@@pinus.si','https://www.tiktok.com/@pinus.si/live?lang=en'])('normalizes %s',name=>expect(normalizeUsername(name)).toBe('pinus.si'));
 it('preserves underscores',()=>expect(normalizeUsername(' @a_b.c ')).toBe('a_b.c'));
 it.each(['','a b','https://evil.test/@pinus.si','https://www.tiktok.com.evil.test/@pinus.si','https://www.tiktok.com/@name/video/123','a/b','a.','a'.repeat(25)])('rejects %s',name=>expect(()=>normalizeUsername(name)).toThrow());
});
describe('connection diagnostics',()=>{
 it.each([
  [Object.assign(Error('not online'),{name:'UserOfflineError'}),'NOT_LIVE'],
  [Error('User not found'),'USER_NOT_FOUND'],[Object.assign(Error('lookup failed'),{code:'EAI_AGAIN'}),'DNS_ERROR'],
  [Error('self signed certificate'),'TLS_ERROR'],[Error('HTTP 429'),'RATE_LIMITED'],[Error('HTTP 403'),'AUTH_REQUIRED'],
  [Object.assign(Error('unavailable'),{name:'SignAPIError'}),'SIGNING_ERROR'],[Error('timeout'),'TIMEOUT'],
  [Object.assign(Error('socket closed'),{code:'ECONNRESET'}),'NETWORK_ERROR'],[Error('Cannot find module'),'CONNECTOR_ERROR'],
 ])('classifies nested connector errors', (exception,code)=>expect(classifyError({info:'Error while connecting',exception}).code).toBe(code));
 it('inspects composite route failures and redacts raw messages, headers, URLs and paths',()=>{
  const secret='DO_NOT_LEAK';const e=Object.assign(Error(`https://test/?token=${secret} cookie=${secret}`),{code:'EAI_AGAIN',headers:{cookie:secret}});
  e.stack=`Error: ${secret}\n    at request (/Users/private-name/project/index.js:12:3)\n    at https://test/?token=${secret}`;
  const composite={config:{requestErrs:[e]}};
  expect(classifyError(composite).code).toBe('DNS_ERROR');
  const safe=JSON.stringify(safeError(composite));expect(safe).not.toContain(secret);expect(safe).not.toContain('private-name');expect(safe).toContain('index.js:12:3');
 });
});
describe('TikTok connection lifecycle (mock transport, not LIVE validation)',()=>{
 it('only confirms resolved room state; normalizes input; forwards real-shaped events',async()=>{
  const c=new Fake(),{t,status,make,room,receive}=setup([c]);t.connect(' @pinus.si ');
  expect(status).toHaveBeenLastCalledWith('connecting','');expect(make).toHaveBeenCalledWith('pinus.si');
  await flush();expect(status).toHaveBeenLastCalledWith('connected','');expect(room).toHaveBeenCalledWith('123');
  c.emit('like',{common:{msgId:'e1'},user:{id:'u',nickname:'Viewer'},count:100});expect(receive).toHaveBeenCalledWith(expect.objectContaining({scope:'tiktok:123',count:100}));t.disconnect();
 });
 it('rejects unconfirmed connections',async()=>{const c=new Fake();c.connect.mockResolvedValue({isConnected:false,roomId:'123'});const {t,status}=setup([c]);t.connect('name');await flush();expect(status).toHaveBeenLastCalledWith('error',expect.stringContaining('CONNECTION_FAILED'));t.disconnect();});
 it('reports wrapped errors and never retries offline or invalid names',async()=>{
  vi.useFakeTimers();const c=new Fake();c.connect.mockImplementation(async()=>{const e=Object.assign(Error("The requested user isn't online :("),{name:'UserOfflineError'});c.emit('error',{info:'Error while connecting',exception:e});throw e;});
  const {t,status,make,log}=setup([c]);t.connect('name');await flush();expect(status).toHaveBeenLastCalledWith('error',expect.stringContaining('NOT_LIVE'));await vi.advanceTimersByTimeAsync(30000);expect(make).toHaveBeenCalledTimes(1);expect(log.some(d=>d.code==='NOT_LIVE')).toBe(true);
  t.connect('bad name');expect(status).toHaveBeenLastCalledWith('error',expect.stringContaining('username'));expect(make).toHaveBeenCalledTimes(1);t.disconnect();
 });
 it('guards repeated Connect and cancels pending connect on Disconnect',async()=>{
  const c=new Fake();let resolve!:(s:any)=>void;c.connect.mockImplementation(()=>new Promise(r=>resolve=r));
  const {t,make,status,room}=setup([c]);t.connect('name');t.connect('other');await flush();expect(make).toHaveBeenCalledTimes(1);
  t.disconnect();resolve({isConnected:true,roomId:'old'});await flush();expect(room).not.toHaveBeenCalled();expect(status).toHaveBeenLastCalledWith('disconnected','');expect(c.disconnect).toHaveBeenCalled();
 });
 it('times out even a hanging factory and closes late clients',async()=>{
  vi.useFakeTimers();let resolve!:(c:Client)=>void;const {t,status}=setup([],()=>new Promise(r=>resolve=r));t.connect('name');
  await vi.advanceTimersByTimeAsync(100);expect(status).toHaveBeenLastCalledWith('reconnecting',expect.stringContaining('TIMEOUT'));
  const late=new Fake();resolve(late);await flush();expect(late.disconnect).toHaveBeenCalled();expect(late.connect).not.toHaveBeenCalled();t.disconnect();expect(vi.getTimerCount()).toBe(0);
 });
 it('does not let a late previous attempt clear the new deadline or change its state',async()=>{
  vi.useFakeTimers();const old=new Fake(),next=new Fake();let done!:(s:any)=>void;old.connect.mockImplementation(()=>new Promise(r=>done=r));next.connect.mockImplementation(()=>new Promise(()=>{}));
  const {t,status,make}=setup([old,next]);t.connect('name');await flush();await vi.advanceTimersByTimeAsync(2100);expect(make).toHaveBeenCalledTimes(2);
  done({isConnected:true,roomId:'old'});old.emit('connected');await flush();await vi.advanceTimersByTimeAsync(100);
  expect(status).toHaveBeenLastCalledWith('reconnecting',expect.stringContaining('TIMEOUT'));t.disconnect();expect(vi.getTimerCount()).toBe(0);
 });
 it('bounds retry backoff and cancels retries on manual disconnect',async()=>{
  vi.useFakeTimers();const cs=Array.from({length:4},()=>{const c=new Fake();c.connect.mockRejectedValue(Object.assign(Error('network'),{code:'ECONNRESET'}));return c;});
  const {t,make,status}=setup(cs);t.connect('name');await flush();await vi.advanceTimersByTimeAsync(14000);expect(make).toHaveBeenCalledTimes(4);expect(status).toHaveBeenLastCalledWith('error',expect.stringContaining('NETWORK_ERROR'));expect(vi.getTimerCount()).toBe(0);
  const d=setup([new Fake()]);d.t.connect('name');await flush();d.t.disconnect();await vi.advanceTimersByTimeAsync(30000);expect(d.make).toHaveBeenCalledTimes(1);t.disconnect();
 });
 it('cancels a scheduled backoff retry on Disconnect',async()=>{
  vi.useFakeTimers();const c=new Fake();c.connect.mockRejectedValue(Object.assign(Error('network'),{code:'ECONNRESET'}));
  const {t,make,status}=setup([c]);t.connect('name');await flush();expect(vi.getTimerCount()).toBe(1);
  t.disconnect();expect(vi.getTimerCount()).toBe(0);await vi.advanceTimersByTimeAsync(60000);expect(make).toHaveBeenCalledTimes(1);expect(status).toHaveBeenLastCalledWith('disconnected','');
 });
 it('does not treat a preliminary connected event as confirmed room state',async()=>{
  const c=new Fake();let finish!:(s:any)=>void;c.connect.mockImplementation(()=>new Promise(r=>finish=r));const {t,status,room}=setup([c]);
  t.connect('name');await flush();c.emit('connected',{roomId:'123'});expect(status).toHaveBeenLastCalledWith('connecting','');expect(room).not.toHaveBeenCalled();
  finish({isConnected:true,roomId:'123'});await flush();expect(status).toHaveBeenLastCalledWith('connected','');t.disconnect();
 });
 it('reports stream end without retrying and allows a manual new attempt',async()=>{
  vi.useFakeTimers();const c=new Fake(),{t,status,make}=setup([c,new Fake()]);t.connect('name');await flush();c.emit('streamEnd');
  expect(status).toHaveBeenLastCalledWith('error',expect.stringContaining('NOT_LIVE'));await vi.advanceTimersByTimeAsync(30000);expect(make).toHaveBeenCalledTimes(1);
  t.connect('name');await flush();expect(status).toHaveBeenLastCalledWith('connected','');t.disconnect();
 });
 it('ignores old session callbacks after a manual reconnect',async()=>{
  const old=new Fake(),next=new Fake(),{t,status}=setup([old,next]);t.connect('name');await flush();const callbacks=old.listeners('disconnected');t.disconnect();t.connect('other');await flush();for(const cb of callbacks)cb();expect(status).toHaveBeenLastCalledWith('connected','');t.disconnect();
 });
 it('keeps catalog errors separate from the established transport',async()=>{const c=new Fake(),{t,status}=setup([c]);t.connect('name');await flush();c.emit('error',{info:'Failed to fetch room gifts.',exception:Error('HTTP 429')});expect(t.connected).toBe(true);expect(status).toHaveBeenLastCalledWith('connected','');t.disconnect();});
});
