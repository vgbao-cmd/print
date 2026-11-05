export const ROW=286;
export type PaperPhase='ready'|'preparing'|'printing'|'name'|'feeding'|'complete';
export interface PaperFrame {item:number;local:number;feed:number;phase:PaperPhase;image:number;name:number;lines:number;x:number;y:number;deposit:boolean}
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const ease=(n:number)=>n*n*(3-2*n);
export function paperFrame(progress:number,count:number,duration:number):PaperFrame {
 const all=clamp(progress)*count,item=Math.min(count-1,Math.floor(all)),local=all>=count?1:all-item;
 const per=duration/count,lines=per>=2500?32:per>=1600?24:per>=850?16:8;
 const image=clamp((local-.08)/.50),name=clamp((local-.60)/.18),feed=ease(clamp((local-.87)/.13));
 const phase:PaperPhase=local<.08?'preparing':local<.60?'printing':local<.79?'name':local<.87?'complete':local<1?'feeding':'complete';
 let x=0,y=0,deposit=false;
 if(phase==='printing'){
  const n=image*lines,row=Math.min(lines-1,Math.floor(n)),f=image>=1?1:n-row;
  x=row%2===0?f:1-f;y=(row+.5)/lines*450;deposit=image>0&&image<1;
 }else if(phase==='name'){
  const n=name*3,row=Math.min(2,Math.floor(n)),f=name>=1?1:n-row;
  x=row%2===0?f:1-f;y=450+(row+.5)*50;deposit=name>0&&name<1;
 }else if(phase==='preparing'){
  x=1-clamp(local/.08);y=10;
 }else {
  const t=clamp((local-.79)/.08);x=1;y=575+(-77-575)*ease(t);
 }
 return {item,local,feed,phase,image,name,lines,x,y,deposit};
}
// Both the paper texture and the print head consume the same strip geometry.
export function strips(progress:number,lines:number,start:number,height:number){
 const p=clamp(progress),n=p*lines,whole=Math.floor(n),fraction=n-whole,h=height/lines;
 const rects:{x:number;y:number;w:number;h:number}[]=[];
 if(whole)rects.push({x:0,y:start,w:512,h:whole*h});
 if(fraction>0){const w=512*fraction;rects.push({x:whole%2===0?0:512-w,y:start+whole*h,w,h});}
 return rects;
}
