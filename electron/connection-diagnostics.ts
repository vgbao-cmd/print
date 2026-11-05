export function normalizeUsername(input:string):string {
  let value=input.trim();
  if(/^https?:\/\//i.test(value)){
    let url:URL;try{url=new URL(value);}catch{throw Error('INVALID_USERNAME');}
    if(!['tiktok.com','www.tiktok.com','m.tiktok.com'].includes(url.hostname)||url.username||url.password)throw Error('INVALID_USERNAME');
    const match=url.pathname.match(/^\/@([^/]+)(?:\/live)?\/?$/);if(!match)throw Error('INVALID_USERNAME');
    value=match[1];
  }else value=value.replace(/^@+/,'');
  if(!/^[a-zA-Z0-9_](?:[a-zA-Z0-9_.]{0,22}[a-zA-Z0-9_])?$/.test(value))throw Error('INVALID_USERNAME');
  return value;
}
export function errorChain(input:any):any[]{
  const found:any[]=[],seen=new Set();
  const walk=(e:any)=>{if(e==null||seen.has(e)||found.length>=12)return;seen.add(e);found.push(e);
    if(typeof e==='object'){walk(e.exception);walk(e.cause);for(const child of (Array.isArray(e.config?.requestErrs)?e.config.requestErrs:[]))walk(child);}
  };walk(input);return found;
}
export type Failure={code:string;message:string;retry:boolean};
export function classifyError(input:unknown):Failure {
  const chain=errorChain(input),text=chain.map(e=>`${e?.constructor?.name} ${e?.name} ${e?.code} ${e?.message??(typeof e==='string'?e:'')} ${e?.response?.statusCode??e?.statusCode??''}`).join(' ').toLowerCase();
  const result=(code:string,message:string,retry=false)=>({code,message,retry});
  if(/invalid_username|invaliduniqueid/.test(text))return result('INVALID_USERNAME','Enter a TikTok username or a full tiktok.com/@username/live URL.');
  if(/useroffline|not live|isn.t online|offline/.test(text))return result('NOT_LIVE','TikTok reports this account is not LIVE. Start the LIVE, then connect again.');
  if(/usernotfound|user not found|account not found|user does not exist/.test(text))return result('USER_NOT_FOUND','TikTok could not find this account. Check the username.');
  if(/eai_again|enotfound|dns/.test(text))return result('DNS_ERROR','DNS lookup failed. Check your network and DNS settings.',true);
  if(/cert_|certificate|tls|ssl/.test(text))return result('TLS_ERROR','TLS verification failed. Check the system clock, certificates and HTTPS inspection.');
  if(/429|ratelimit|rate.?limit/.test(text))return result('RATE_LIMITED','TikTok or the signing service is rate limited. Wait before trying again.');
  if(/401|403|api.?key|lack of permission|authenticatedwebsocket/.test(text))return result('AUTH_REQUIRED','TikTok or the signing provider denied access. Check provider access and diagnostics. No paid service is enabled.');
  if(/signapi|signature|sign error|sign server/.test(text))return result('SIGNING_ERROR','The signing service failed. Check provider availability and try later.');
  if(/timeout|timed out|etimedout/.test(text))return result('TIMEOUT','Connection timed out. Check network access and try again.',true);
  if(/econn|enet|ehost|socket|connection lost|fetch failed/.test(text))return result('NETWORK_ERROR','The network connection failed. Check firewall, proxy and Internet access.',true);
  if(/module_not_found|err_require_esm|cannot find module|protobuf|schema|missing cursor/.test(text))return result('CONNECTOR_ERROR','Connector loading or protocol failed. Rebuild the app and check connector compatibility.');
  return result('CONNECTION_FAILED','Connection could not be confirmed. Copy diagnostics to identify the failing stage.');
}
// Never serialize error objects: they can contain cookies, headers and signed URLs.
// Preserve only frame locations (not the raw message/first stack line or directory paths).
export function safeError(input:unknown){return errorChain(input).map(e=>({
  category:classifyError(e).code,
  route:typeof e?.config?.routeId==='string'&&/^[a-zA-Z0-9_]{1,80}$/.test(e.config.routeId)?e.config.routeId:undefined,
  kind:String(e?.constructor?.name??'Unknown').replace(/[^a-zA-Z0-9_]/g,'').slice(0,60),
  code:/^[A-Z][A-Z0-9_]{1,60}$/.test(e?.code)?e.code:undefined,
  httpStatus:Number.isInteger(e?.response?.statusCode)?e.response.statusCode:undefined,
  stack:typeof e?.stack==='string'?e.stack.split('\n').slice(1,13).map((line:string)=>{
    const match=line.match(/(?:[/\\])([^/\\\s():?]+\.(?:[cm]?js|tsx?)):(\d+):(\d+)\)?$/);
    return match?`at ${match[1]}:${match[2]}:${match[3]}`:'at [redacted frame]';
  }):undefined
}));}
export type ConnectionDiagnostic={time:string;stage:string;code:string;attempt:number;state:string;roomId?:string;errors?:ReturnType<typeof safeError>};
