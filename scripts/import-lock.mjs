import {readFileSync,writeFileSync} from 'node:fs';
const lock=JSON.parse(readFileSync(process.argv[2],'utf8'));
const pkg=JSON.parse(readFileSync('package.json','utf8'));
lock.name=pkg.name;lock.version=pkg.version;lock.packages[''].name=pkg.name;lock.packages[''].version=pkg.version;
writeFileSync('package-lock.json',JSON.stringify(lock,null,2)+'\n');
