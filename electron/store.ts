import {DatabaseSync} from 'node:sqlite';
import {verifiedMapping} from '../src/gift-guide';
import {finishHistory} from '../src/print-layout';
import {randomUUID} from 'node:crypto';
import {DEFAULTS,TIERS,validSettings,styleFor,type LiveEvent,type Print,type Settings} from '../src/shared';

// Adapted from the 0.16.0 SQLite/WAL receipt ledger. A receipt, balance and print
// entitlement now commit in one transaction, rather than separate checkpoints.
export class Store {
  catalogScope='';catalogGifts:import('../src/shared').Gift[]=[];
  db:DatabaseSync; settings:Settings; session:string;
  constructor(file:string){
    this.db=new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS receipts(key TEXT PRIMARY KEY) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS pending_gifts(key TEXT PRIMARY KEY,payload TEXT NOT NULL) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS combos(key TEXT PRIMARY KEY) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS people(session TEXT,scope TEXT,id TEXT,name TEXT,avatar TEXT,likes INTEGER DEFAULT 0,coins INTEGER DEFAULT 0,PRIMARY KEY(session,scope,id));
      CREATE TABLE IF NOT EXISTS jobs(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE,payload TEXT,kind TEXT,remaining INTEGER,state TEXT DEFAULT 'pending',token TEXT);
      CREATE INDEX IF NOT EXISTS pending_jobs ON jobs(state,kind,seq);
      CREATE TABLE IF NOT EXISTS spotlights(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE,payload TEXT,state TEXT DEFAULT 'pending',token TEXT);
      CREATE INDEX IF NOT EXISTS pending_spotlights ON spotlights(state,seq);`);
    this.settings=validSettings(this.get('settings',DEFAULTS)); this.session=this.get('session',randomUUID());
    for(const tier of TIERS)this.db.prepare("UPDATE jobs SET payload=json_set(payload,'$.style',json(?)) WHERE json_type(payload,'$.style') IS NULL AND json_extract(payload,'$.tier')=?").run(JSON.stringify(this.settings.tiers[tier]),tier);
    this.set('settings',this.settings);this.set('session',this.session);if(!this.get<any>('runtime',null)?.stopped)this.recover();
  }
  get<T>(key:string,fallback:T):T{const r=this.db.prepare('SELECT value FROM meta WHERE key=?').get(key);return r?JSON.parse(String(r.value)):fallback;}
  set(key:string,value:unknown){this.db.prepare('INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));}
  transaction<T>(fn:()=>T):T{this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  save(s:Settings){this.settings=validSettings(s);this.set('settings',this.settings);return this.settings;}
  recover(){this.db.prepare("UPDATE jobs SET state='pending',token=NULL WHERE state='active'").run();this.db.prepare("UPDATE spotlights SET state='pending',token=NULL WHERE state='active'").run();}
  ingest(events:LiveEvent[]){return this.transaction(()=>events.map(e=>this.event(e)));}
  private event(e:LiveEvent){
    if(!e.id||!e.userId||!Number.isSafeInteger(e.count)||e.count<0||e.count>1e7)throw Error('Invalid event');
    const receipt=`${e.scope}:${e.type}:${e.id}`;
    if(e.type==='gift'&&e.scope.startsWith('tiktok:')){const actual=this.catalogScope===e.scope?this.catalogGifts.find(g=>g.id===e.giftId):undefined;const tier=TIERS.find(t=>this.settings.mappings[t]?.id===e.giftId);if(!actual||(e.coins!==undefined&&e.coins!==actual.coins)||(tier&&!verifiedMapping(this.settings.mappings[tier],this.catalogGifts,tier))){if(!this.db.prepare('SELECT 1 FROM receipts WHERE key=?').get(receipt))this.db.prepare('INSERT OR IGNORE INTO pending_gifts VALUES(?,?)').run(receipt,JSON.stringify(e));return {fresh:false,prints:0,pending:true};}e={...e,coins:actual.coins};}
    this.db.prepare('DELETE FROM pending_gifts WHERE key=?').run(receipt);
    const fresh=Number(this.db.prepare('INSERT OR IGNORE INTO receipts VALUES(?)').run(receipt).changes)>0;
    if(!fresh){this.set('duplicates',this.get('duplicates',0)+1);return {fresh:false,prints:0};}
    this.set('received',this.get('received',0)+1);
    this.db.prepare(`INSERT INTO people(session,scope,id,name,avatar) VALUES(?,?,?,?,?) ON CONFLICT(session,scope,id) DO UPDATE SET name=excluded.name,avatar=CASE WHEN excluded.avatar<>'' THEN excluded.avatar ELSE people.avatar END`).run(this.session,e.scope,e.userId,e.name,e.avatar);
    const p=this.db.prepare('SELECT * FROM people WHERE session=? AND scope=? AND id=?').get(this.session,e.scope,e.userId)!;
    let tier:Print['tier']='classic',quantity=1,draws=0;
    if(e.type==='like'){
      const total=Number(p.likes)+e.count;draws=Math.floor(total/this.settings.likes);
      this.db.prepare('UPDATE people SET likes=? WHERE session=? AND scope=? AND id=?').run(total%this.settings.likes,this.session,e.scope,e.userId);
    } else {
      if(e.streakable&&!e.end)return {fresh:true,prints:0};
      if(e.streak){const key=`${e.scope}:${e.userId}:${e.giftId}:${e.streak}`;if(!Number(this.db.prepare('INSERT OR IGNORE INTO combos VALUES(?)').run(key).changes))return {fresh:true,prints:0};}
      const configured=TIERS.find(t=>this.settings.mappings[t]?.id===e.giftId&&(!e.scope.startsWith('tiktok:')||(this.catalogScope===e.scope&&verifiedMapping(this.settings.mappings[t],this.catalogGifts,t))));
      const mapped=configured?this.settings.mappings[configured]:undefined;
      const unit=e.coins??mapped?.coins??0;
      if(!Number.isSafeInteger(unit)||unit<0||unit>1e6)throw Error('Invalid coin amount');
      this.db.prepare('UPDATE people SET coins=coins+? WHERE session=? AND scope=? AND id=?').run(unit*e.count,this.session,e.scope,e.userId);
      if(e.scope.startsWith('demo:')&&e.demoTier)tier=e.demoTier;
      else if(configured)tier=configured;
      else return {fresh:true,prints:0};
      quantity=e.count;draws=quantity>0?1:0;
    }
    if(draws){const item:Print={id:receipt,userId:e.userId,name:e.name,avatar:e.avatar||String(p.avatar),tier,quantity,source:e.scope,style:{...this.settings.tiers[tier]}};
      this.db.prepare('INSERT INTO jobs(id,payload,kind,remaining) VALUES(?,?,?,?)').run(receipt,JSON.stringify(item),e.type,draws);}
    return {fresh:true,prints:draws,remainder:e.type==='like'?(Number(p.likes)+e.count)%this.settings.likes:undefined};
  }
  count(){return Number(this.db.prepare("SELECT coalesce(sum(remaining),0) AS n FROM jobs WHERE state='pending'").get()!.n);}
  claim(size:number,token:string):Print[]{return this.transaction(()=>{
    const out:Print[]=[];let streak=this.get('giftRun',0);
    for(let i=0;i<size;i++){
      const preferred=streak>=3?'like':'gift';
      const row=this.db.prepare("SELECT * FROM jobs WHERE state='pending' AND kind=? ORDER BY seq LIMIT 1").get(preferred)??this.db.prepare("SELECT * FROM jobs WHERE state='pending' ORDER BY seq LIMIT 1").get();
      if(!row)break;
      const item:Print=JSON.parse(String(row.payload));item.style??={...this.settings.tiers[item.tier]}; const remaining=Number(row.remaining);
      const id=`${item.id}:draw:${remaining}`; item.id=id;
      if(remaining>1){this.db.prepare('UPDATE jobs SET remaining=remaining-1 WHERE seq=?').run(row.seq!);
        this.db.prepare("INSERT INTO jobs(id,payload,kind,remaining,state,token) VALUES(?,?,?,1,'active',?)").run(id,JSON.stringify(item),String(row.kind),token);
      }else this.db.prepare("UPDATE jobs SET state='active',token=?,payload=? WHERE seq=?").run(token,JSON.stringify(item),row.seq!);
      out.push(item);streak=row.kind==='gift'?streak+1:0;
    }
    this.set('giftRun',Math.min(3,streak));return out;
  });}
  complete(token:string){return this.transaction(()=>{const n=Number(this.db.prepare("SELECT count(*) AS n FROM jobs WHERE state='active' AND token=?").get(token)!.n);
    const finished:Print[]=[];for(const r of this.db.prepare("SELECT payload FROM jobs WHERE state='active' AND token=? ORDER BY seq").all(token)){const item:Print=JSON.parse(String(r.payload)),style=styleFor(item,this.settings);finished.push(item);if(style.spotlightEnabled&&style.spotlightDuration>0)this.db.prepare('INSERT OR IGNORE INTO spotlights(id,payload) VALUES(?,?)').run(item.id,JSON.stringify({...item,style}));}
    this.set('paperHistory',finishHistory(this.get<Print[]>('paperHistory',[]),finished,this.settings));this.db.prepare("DELETE FROM jobs WHERE state='active' AND token=?").run(token);this.set('completed',this.get('completed',0)+n);return n;});}
  claimSpotlight(token:string){return this.transaction(()=>{const row=this.db.prepare("SELECT * FROM spotlights WHERE state='pending' ORDER BY seq LIMIT 1").get();if(!row)return null;this.db.prepare("UPDATE spotlights SET state='active',token=? WHERE seq=?").run(token,row.seq!);const item:Print=JSON.parse(String(row.payload));return {item,duration:styleFor(item,this.settings).spotlightDuration};});}
  completeSpotlight(token:string){return this.transaction(()=>{const row=this.db.prepare("SELECT payload FROM spotlights WHERE state='active' AND token=?").get(token);if(!row)return 0;const item:Print=JSON.parse(String(row.payload));
    if(item.tier==='fame')this.set('honored',item);
    if(item.tier==='legendary')this.set('seals',[item.id,...this.get<string[]>('seals',[]).filter(id=>id!==item.id)].slice(0,12));
    return Number(this.db.prepare("DELETE FROM spotlights WHERE state='active' AND token=?").run(token).changes);});}
  verify(scope:string,gifts:import('../src/shared').Gift[]){this.catalogScope=scope;this.catalogGifts=gifts;let cursor='',total=0;while(true){const rows=this.db.prepare('SELECT key,payload FROM pending_gifts WHERE key>? ORDER BY key LIMIT 128').all(cursor);if(!rows.length)break;cursor=String(rows.at(-1)!.key);this.ingest(rows.map(r=>JSON.parse(String(r.payload))));total+=rows.length;}return total;}
  runtime(data:unknown){this.set('runtime',data);}
  resetSession(){return this.transaction(()=>{let cursor='';while(true){const rows=this.db.prepare('SELECT key,payload FROM pending_gifts WHERE key>? ORDER BY key LIMIT 128').all(cursor);if(!rows.length)break;cursor=String(rows.at(-1)!.key);for(const row of rows){this.db.prepare('INSERT OR IGNORE INTO receipts VALUES(?)').run(row.key!);const e:LiveEvent=JSON.parse(String(row.payload));if(e.streak)this.db.prepare('INSERT OR IGNORE INTO combos VALUES(?)').run(`${e.scope}:${e.userId}:${e.giftId}:${e.streak}`);}}this.db.exec('DELETE FROM pending_gifts;DELETE FROM jobs;DELETE FROM spotlights;DELETE FROM people;');this.session=randomUUID();this.set('session',this.session);for(const key of ['completed','received','duplicates','giftRun'])this.set(key,0);this.set('honored',null);this.set('paperHistory',[]);this.set('seals',[]);this.set('runtime',null);return this.session;});}
  clear(through=Number.MAX_SAFE_INTEGER){return this.transaction(()=>{const n=Number(this.db.prepare("SELECT coalesce(sum(remaining),0) n FROM jobs WHERE state='pending' AND seq<=?").get(through)!.n);this.db.prepare("DELETE FROM jobs WHERE state='pending' AND seq<=?").run(through);return n;});}
  newSession(){if(this.count()||Number(this.db.prepare("SELECT count(*) n FROM jobs WHERE state='active'").get()!.n)||Number(this.db.prepare('SELECT count(*) n FROM spotlights').get()!.n))throw Error('Queue not empty');
    this.session=randomUUID();this.transaction(()=>{this.set('session',this.session);this.set('completed',0);this.set('received',0);this.set('duplicates',0);this.db.prepare('DELETE FROM people').run();});return this.session;}
  snapshot(scope:string){return {
    pendingGifts:Number(this.db.prepare('SELECT count(*) n FROM pending_gifts').get()!.n),paperHistory:this.get('paperHistory',[]),queue:this.count(),honored:this.get('honored',null),seals:this.get('seals',[]),spotlightQueue:Number(this.db.prepare("SELECT count(*) n FROM spotlights WHERE state='pending'").get()!.n),clearThrough:Number(this.db.prepare("SELECT coalesce(max(seq),0) n FROM jobs WHERE state='pending'").get()!.n),completed:this.get('completed',0),received:this.get('received',0),duplicates:this.get('duplicates',0),session:this.session,
    top:this.db.prepare('SELECT name,coins FROM people WHERE session=? AND scope=? AND coins>0 ORDER BY coins DESC,id LIMIT 3').all(this.session,scope),
    likesRemainder:Number(this.db.prepare('SELECT coalesce(sum(likes),0) n FROM people WHERE session=? AND scope=?').get(this.session,scope)!.n),
    preview:this.db.prepare("SELECT payload,remaining FROM jobs WHERE state='pending' ORDER BY seq LIMIT 8").all().map(r=>({...JSON.parse(String(r.payload)),waiting:Number(r.remaining)}))
  };}
  close(){this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');this.db.close();}
}
