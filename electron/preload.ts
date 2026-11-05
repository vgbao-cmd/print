import {contextBridge,ipcRenderer} from 'electron';
contextBridge.exposeInMainWorld('printer',{
  state:()=>ipcRenderer.invoke('state'),action:(name:string,data?:unknown)=>ipcRenderer.invoke('action',name,data),
  image:(url:string)=>ipcRenderer.invoke('image',url),ready:()=>ipcRenderer.invoke('ready'),complete:(token:string)=>ipcRenderer.invoke('complete',token),
  music:(token:string)=>ipcRenderer.invoke('music',token),completeSpotlight:(token:string)=>ipcRenderer.invoke('completeSpotlight',token),
  audioError:()=>ipcRenderer.invoke('audioError'),
  subscribe:(callback:(state:unknown)=>void)=>{const listener=(_:unknown,state:unknown)=>callback(state);ipcRenderer.on('snapshot',listener);return ()=>ipcRenderer.removeListener('snapshot',listener);},
  audio:(callback:(kind:string)=>void)=>{const listener=(_:unknown,kind:string)=>callback(kind);ipcRenderer.on('audio',listener);return ()=>ipcRenderer.removeListener('audio',listener);}
});
