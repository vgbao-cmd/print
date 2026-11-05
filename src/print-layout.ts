import {styleFor,type Print,type Settings} from './shared';
export const BASE_DIAMETER=128;export const PAPER_WIDTH=800,PAPER_HEIGHT=1100,PAPER_X=140,PAPER_Y=390;
export interface PrintLayout {diameter:number;pad:number;width:number;imageHeight:number;height:number;row:number;feed:number;nameFont:number;lineHeight:number;left:number}
export function printLayout(item:Print,settings?:Settings):PrintLayout {
 const scale=Math.max(.5,Math.min(4,styleFor(item,settings).scale)),diameter=BASE_DIAMETER*scale,pad=12+scale*5,width=diameter+pad*2,nameFont=22*Math.sqrt(scale),lineHeight=nameFont*1.18,imageHeight=diameter+pad*2;
 const height=imageHeight+12+lineHeight*3+8+(item.tier==='legendary'?36:0),row=height+Math.max(20,scale*8);
 return {diameter,pad,width,imageHeight,height,row,feed:Math.min(row,PAPER_HEIGHT-72-height),nameFont,lineHeight,left:Math.min(48,(PAPER_WIDTH-width)/2)};
}
export function finishHistory(history:Print[],items:Print[],settings?:Settings){
 let out=[...history];for(const item of items){const p={...item,style:{...styleFor(item,settings)}};p.paperGap=Math.max(printLayout(p).row,out[0]?printLayout(out[0],settings).feed:0);out=[p,...out.filter(x=>x.id!==p.id)];}return out.slice(0,12);
}
export function paperPositions(batch:Print[],history:Print[],item:number,feed:number,settings?:Settings,preparation=1){
 const current=batch[item]?printLayout(batch[item],settings):null;
 const positions:{item:Print;y:number;active:boolean;layout:PrintLayout}[]=[];
 const older=finishHistory(history.filter(p=>!batch.some(i=>i.id===p.id)),batch.slice(0,item),settings);
 if(current)positions.push({item:batch[item],y:72+feed*current.feed,active:true,layout:current});
 const previousRow=older[0]?printLayout(older[0],settings).feed:0;
 const reserve=current?Math.max(0,current.row-previousRow)*preparation:0;
 let y=72+previousRow+reserve+feed*(current?.feed??0);
 for(const p of older){const l=printLayout(p,settings);positions.push({item:p,y,active:false,layout:l});y+=p.paperGap??l.row;}
 return positions;
}
