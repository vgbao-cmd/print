import {build} from 'esbuild';
for (const name of ['main','preload','persistence-worker']) await build({entryPoints:[`electron/${name}.ts`],outfile:`dist-electron/${name}.cjs`,bundle:true,platform:'node',format:'cjs',external:['electron','tiktok-live-connector'],sourcemap:true});
