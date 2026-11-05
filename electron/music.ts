import {dialog} from 'electron';
import type {BrowserWindow} from 'electron';
import {mkdir,stat,readFile,writeFile} from 'node:fs/promises';
import {join,extname,basename} from 'node:path';
import {createHash} from 'node:crypto';
export const musicToken=(token:unknown):token is string=>typeof token==='string'&&/^[a-f0-9]{64}\.(mp3|wav|ogg|m4a|flac)$/.test(token);
export class MusicFiles {
 constructor(private directory:string){}
 async select(owner:BrowserWindow){
  const result=await dialog.showOpenDialog(owner,{title:'Choose a music file',buttonLabel:'CHOOSE MUSIC',properties:['openFile'],filters:[{name:'Audio files (up to 20 MB)',extensions:['mp3','wav','ogg','m4a','flac']}]});
  if(result.canceled||!result.filePaths[0])return {ok:true,canceled:true};
  return this.importFile(result.filePaths[0]);
 }
 async importFile(file:string){
  const s=await stat(file),ext=extname(file).toLowerCase();if(!s.isFile()||s.size>20*1024*1024||!['.mp3','.wav','.ogg','.m4a','.flac'].includes(ext))return {ok:false,message:'Choose an audio file smaller than 20 MB.'};
  const data=await readFile(file),token=createHash('sha256').update(data).digest('hex')+ext;await mkdir(this.directory,{recursive:true});await writeFile(join(this.directory,token),data);return {ok:true,musicFile:token,musicName:basename(file)};
 }
 async exists(token:string){if(!musicToken(token))return false;try{return (await stat(join(this.directory,token))).isFile();}catch{return false;}}
 async data(token:string){if(!musicToken(token))return '';try{const file=join(this.directory,token),s=await stat(file);if(s.size>20*1024*1024)return '';const data=await readFile(file),mime=token.endsWith('.mp3')?'audio/mpeg':token.endsWith('.m4a')?'audio/mp4':token.endsWith('.wav')?'audio/wav':token.endsWith('.flac')?'audio/flac':'audio/ogg';return `data:${mime};base64,${data.toString('base64')}`;}catch{return '';}}
}
