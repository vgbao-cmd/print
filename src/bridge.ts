import type {Snapshot} from './shared';
export interface Bridge {
 state():Promise<Snapshot>;action(name:string,data?:unknown):Promise<{ok:boolean;token?:string;message?:string;musicFile?:string;musicName?:string;canceled?:boolean}>;
 music(token:string):Promise<string>;completeSpotlight(token:string):Promise<boolean>;
 audioError():Promise<void>;
 image(url:string):Promise<string>;ready():Promise<void>;complete(token:string):Promise<boolean>;
 subscribe(callback:(snapshot:Snapshot)=>void):()=>void;audio(callback:(kind:string)=>void):()=>void;
}
declare global {interface Window {printer:Bridge}}
export const bridge=window.printer;
