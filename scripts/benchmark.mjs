import {build} from 'esbuild';
import {mkdtempSync,writeFileSync,mkdirSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
mkdirSync('artifacts',{recursive:true});
await build({entryPoints:['electron/store.ts','electron/demo.ts'],outdir:'artifacts/bench-modules',bundle:true,platform:'node',format:'cjs',outExtension:{'.js':'.cjs'}});
const require=createRequire(import.meta.url),{Store}=require('../artifacts/bench-modules/store.cjs'),{demoEvents}=require('../artifacts/bench-modules/demo.cjs');
const dir=mkdtempSync(join(tmpdir(),'avatar-benchmark-')),file=join(dir,'bench.sqlite'),store=new Store(file);
const before=process.memoryUsage(),start=performance.now(),events=demoEvents('burst','demo:benchmark');
store.ingest(events);const ms=performance.now()-start,queue=store.count(),after=process.memoryUsage();
store.ingest(events);const duplicates=store.snapshot('demo:benchmark').duplicates;
let completed=0,batches=0;const drainStart=performance.now();
while(store.count()){const token=`batch-${batches++}`;store.claim(3,token);completed+=store.complete(token);}
const drainMs=performance.now()-drainStart;store.close();
const result={synthetic:true,events:1000,ingestMs:ms,eventsPerSecond:1000/(ms/1000),queue,duplicates,completed,batches,drainMs,heapBefore:before.heapUsed,heapAfter:after.heapUsed,rssBefore:before.rss,rssAfter:after.rss,databaseBytes:statSync(file).size,node:process.version,platform:process.platform,note:'Storage/rules benchmark only. Excludes real TikTok, network images, animation and TTS. Not a sustained-load guarantee.'};
writeFileSync('artifacts/benchmark.json',JSON.stringify(result,null,2));process.stdout.write(JSON.stringify(result,null,2)+'\n');rmSync(dir,{recursive:true,force:true});
