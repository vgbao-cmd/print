import type {Batch,Print,Snapshot} from './shared';
import {guideItems} from './gift-guide';
import {PAPER_WIDTH,PAPER_HEIGHT,PAPER_X,PAPER_Y,printLayout,paperPositions,type PrintLayout} from './print-layout';
import {wrapName} from './text-layout';
import {playbackNow} from './playback';
import {drawPerformance,drawHonored,showAmbient} from './performances';
import {S} from './strings';
import {paperFrame,ROW,strips,type PaperFrame} from './paper-path';
const COLORS={classic:'#79dce4',glow:'#a3f0e2',bloom:'#e1a5c1',love:'#e88ba7',royal:'#e6c16c',rainbow:'#a3b4ee',legendary:'#af92df',fame:'#f2d98f'};
const make=(w:number,h:number)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
type Texture={item:Print;full:HTMLCanvasElement;mask:HTMLCanvasElement;layout:PrintLayout;image?:HTMLImageElement};
export class PaperPrinter {
 ctx:CanvasRenderingContext2D;sheet=make(PAPER_WIDTH,PAPER_HEIGHT);background=make(1080,1920);textures=new Map<string,Texture>();giftImages=new Map<string,HTMLImageElement>();
 batch:Batch|null=null;history:Print[]=[];state:Snapshot|null=null;disposed=false;metrics={frames:0,totalMs:0,maxMs:0};
 spotProgress:number|null=null;showOrigin={token:'',x:360,y:620};lastPositions=new Map<string,{x:number;y:number}>();
 constructor(public element:HTMLCanvasElement){element.width=1080;element.height=1920;this.ctx=element.getContext('2d',{alpha:false})!;this.room();}
 room(){const c=this.background.getContext('2d')!,g=c.createRadialGradient(580,350,60,560,650,1500);g.addColorStop(0,'#102834');g.addColorStop(.5,'#07111f');g.addColorStop(1,'#020611');c.fillStyle=g;c.fillRect(0,0,1080,1920);
  c.strokeStyle='#92dbec0a';for(const x of [155,970]){c.beginPath();c.moveTo(x,200);c.lineTo(x,1790);c.stroke();}
  const floor=c.createLinearGradient(0,1690,0,1920);floor.addColorStop(0,'#17323b00');floor.addColorStop(1,'#10202a');c.fillStyle=floor;c.fillRect(0,1690,1080,230);
 }
 setBatch(b:Batch|null,history:Print[]){this.batch=b;this.history=history.slice(0,12);const visible:Print[]=[];let buffer=false;for(const p of paperPositions(b?.items??[],this.history,0,0,this.state?.settings,0).sort((a,b)=>a.y-b.y)){if(p.y>PAPER_HEIGHT){if(buffer)break;buffer=true;}visible.push(p.item);}const wanted=[...(b?.items??[]),...visible,...(this.state?.spotlight?[this.state.spotlight.item]:[]),...(this.state?.honored?[this.state.honored]:[])];const ids=new Set(wanted.map(p=>p.id));
  for(const [id,t] of this.textures)if(!ids.has(id)){t.full.width=1;t.mask.width=1;if(t.image)t.image.src='';this.textures.delete(id);}
  for(const item of wanted){const sealed=this.state?.seals?.includes(item.id)??false;if(!this.textures.has(item.id)){const full=make(1,1);this.textures.set(item.id,{item:{...item,sealed},full,mask:make(1,1),layout:printLayout(item,this.state?.settings)});this.texture(this.textures.get(item.id)!);}else{const t=this.textures.get(item.id)!;if(sealed&&!t.item.sealed){t.item={...t.item,sealed:true};this.texture(t);}}}
 }
 setImage(id:string,image:HTMLImageElement){const t=this.textures.get(id);if(t&&!this.disposed){t.image=image;this.texture(t);}}
 texture(t:Texture){const l=t.layout;t.full.width=Math.ceil(l.width);t.full.height=Math.ceil(l.height);t.mask.width=t.full.width;t.mask.height=t.full.height;const c=t.full.getContext('2d')!;const item=t.item,color=COLORS[item.tier];
  const radius=l.diameter/2,cy=l.pad+radius,cx=l.width/2;
  c.save();c.beginPath();c.arc(cx,cy,radius,0,Math.PI*2);c.clip();
  if(t.image){const image=t.image,k=Math.max(radius*2/image.naturalWidth,radius*2/image.naturalHeight);c.drawImage(image,cx-image.naturalWidth*k/2,cy-image.naturalHeight*k/2,image.naturalWidth*k,image.naturalHeight*k);}
  else {const g=c.createLinearGradient(0,0,l.width,l.imageHeight);g.addColorStop(0,'#f0ca9c');g.addColorStop(.5,'#c7a1c9');g.addColorStop(1,'#73abc9');c.fillStyle=g;c.fillRect(0,0,l.width,l.imageHeight);c.fillStyle='#fff8eb';c.textAlign='center';c.font=`${radius}px "Noto Sans"`;c.fillText('✦',cx,cy+radius*.32);}
  c.restore();
  c.strokeStyle=item.tier==='classic'?'#b7c9d2':color;c.lineWidth=item.tier==='classic'?2:Math.max(3,l.diameter*.015);c.beginPath();c.arc(cx,cy,radius+2,0,Math.PI*2);c.stroke();
  if(item.tier!=='classic'){
   c.save();c.strokeStyle=color;c.lineWidth=1.5;c.beginPath();c.arc(cx,cy,radius+7,0,Math.PI*2);c.stroke();c.fillStyle=color;c.textAlign='center';
   const decoration=item.tier==='bloom'?'✿':item.tier==='love'?'♥':item.tier==='royal'?'♛':item.tier==='fame'?'★':item.tier==='legendary'?'✧':'✦';
   for(let i=0;i<(item.tier==='royal'?1:8);i++){const a=item.tier==='royal'?-Math.PI/2:i*Math.PI/4;c.font=`${item.tier==='royal'?Math.min(42,l.pad*1.4):Math.min(26,l.pad)}px "Segoe UI Emoji","Noto Sans"`;c.fillText(decoration,cx+Math.cos(a)*(radius+6),cy+Math.sin(a)*(radius+6)+7);}c.restore();
  }
  if(item.tier==='rainbow'){const g=c.createLinearGradient(0,0,l.width,l.imageHeight);['#e99aab','#edca79','#7bcab8','#7d9fde','#c296d6'].forEach((v,i)=>g.addColorStop(i/4,v));c.strokeStyle=g;c.lineWidth=Math.max(4,l.diameter*.015);c.beginPath();c.arc(cx,cy,radius+2,0,Math.PI*2);c.stroke();}
  // Names remain full Unicode in storage; bound their visible layout to this row.
  c.fillStyle='#17212c';c.textAlign='center';c.font=`700 ${l.nameFont}px "Noto Sans","Printer CJK","Printer Arabic"`;
  wrapName(item.name,s=>c.measureText(s).width,l.width-8).forEach((name,i)=>c.fillText(name,cx,l.imageHeight+8+l.nameFont+i*l.lineHeight,l.width-8));
  if(item.quantity>1){c.fillStyle='#96783b';c.font=`600 ${Math.max(16,l.nameFont*.65)}px "Noto Sans"`;c.textAlign='right';c.fillText(`×${item.quantity}`,l.width-4,l.imageHeight-4);}
  if(item.tier==='legendary'&&item.sealed){c.strokeStyle='#8d72b9';c.lineWidth=2;c.strokeRect(8,l.height-33,l.width-16,27);c.fillStyle='#775b9f';c.textAlign='center';c.font='600 16px "Noto Sans"';c.fillText('LEGENDARY SUPPORTER',l.width/2,l.height-13,l.width-24);}
 }
 masked(t:Texture,f:PaperFrame){const c=t.mask.getContext('2d')!,l=t.layout;c.clearRect(0,0,t.mask.width,t.mask.height);if(f.image===1&&f.name===1){c.drawImage(t.full,0,0);return t.mask;}for(const r of [...strips(f.image,f.lines,0,l.imageHeight),...strips(f.name,3,l.imageHeight,t.full.height-l.imageHeight)]){const x=r.x/512*t.full.width,w=r.w/512*t.full.width;if(w>0&&r.h>0)c.drawImage(t.full,x,r.y,w,r.h,x,r.y,w,r.h);}return t.mask;}
 round(x:number,y:number,w:number,h:number,r:number,fill:string,stroke?:string){const c=this.ctx;c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke();}}
 text(value:string,x:number,y:number,size:number,color:string,weight=400,align:CanvasTextAlign='left',max?:number){const c=this.ctx;c.fillStyle=color;c.textAlign=align;c.font=`${weight} ${size}px "Noto Sans","Printer CJK","Printer Arabic","Segoe UI Emoji"`;max?c.fillText(value,x,y,max):c.fillText(value,x,y);}
 render(progress=0):PaperFrame|null {
  if(this.disposed)return null;const start=performance.now(),c=this.ctx;c.drawImage(this.background,0,0);const b=this.batch,f=b?paperFrame(progress,b.items.length,b.duration):null;
  this.text(S.app,560,135,42,'#e5f1f3',600,'center');this.text(S.likes(this.state?.settings.likes??100),560,182,24,'#82cbd8',500,'center');
  const spotlight=this.state?.spotlight,sp=spotlight?(this.spotProgress??Math.max(0,Math.min(1,((this.state?playbackNow(this.state):Date.now())-spotlight.started)/spotlight.duration))):0;
  // Side supports and their contact shadows, behind the entire continuous sheet.
  for(const x of [95,965]){this.round(x+9,377,24,1122,5,'#0008');const metal=c.createLinearGradient(x,0,x+22,0);metal.addColorStop(0,'#32495c');metal.addColorStop(.3,'#b6c5d1');metal.addColorStop(.55,'#71859b');metal.addColorStop(1,'#263d55');this.round(x,366,22,1120,6,metal as unknown as string);c.fillStyle='#76dcea33';c.fillRect(x-2,395,2,1060);}
  // Paper's curvature is a bounded strip transform, including its printed history.
  const sheet=this.sheet.getContext('2d')!;sheet.clearRect(0,0,PAPER_WIDTH,PAPER_HEIGHT);const paper=sheet.createLinearGradient(0,0,PAPER_WIDTH,0);paper.addColorStop(0,'#cbd0d7');paper.addColorStop(.08,'#f2f3f1');paper.addColorStop(.53,'#fffef9');paper.addColorStop(.94,'#e9ebeb');paper.addColorStop(1,'#c0c7d0');sheet.fillStyle=paper;sheet.fillRect(0,0,PAPER_WIDTH,PAPER_HEIGHT);
  const prep=f?.phase==='preparing'?Math.min(1,f.local/.08):1,eased=prep*prep*(3-2*prep);
  const positions=paperPositions(b?.items??[],this.history,f?.item??0,f?.feed??0,this.state?.settings,eased);
  this.lastPositions.clear();for(const p of positions){this.lastPositions.set(p.item.id,{x:PAPER_X+p.layout.left+p.layout.width/2,y:PAPER_Y+p.y+p.layout.pad+p.layout.diameter/2});if(p.y>PAPER_HEIGHT||p.y+p.layout.height<0)continue;const t=this.textures.get(p.item.id);if(t)sheet.drawImage(p.active&&f?this.masked(t,f):t.full,p.layout.left,p.y);}
  // Shadow behind the sheet, then segmented lower curl. All rows use one surface.
  c.save();c.shadowColor='#000b';c.shadowBlur=36;c.shadowOffsetX=10;c.shadowOffsetY=13;c.fillStyle='#dce3e4';c.fillRect(PAPER_X,PAPER_Y,PAPER_WIDTH,PAPER_HEIGHT-24);c.restore();
  for(let sy=0;sy<PAPER_HEIGHT;sy+=10){const t=Math.max(0,(sy-780)/320),shift=-15*Math.sin(t*Math.PI),width=PAPER_WIDTH+15*Math.sin(t*Math.PI),dy=PAPER_Y+sy-t*t*24;c.drawImage(this.sheet,0,sy,PAPER_WIDTH,Math.min(10,PAPER_HEIGHT-sy),PAPER_X+shift,dy,width,10.5);}
  const curl=c.createLinearGradient(0,1160,0,1470);curl.addColorStop(0,'#00102200');curl.addColorStop(.35,'#00102212');curl.addColorStop(.65,'#ffffff10');curl.addColorStop(1,'#00102224');c.fillStyle=curl;c.fillRect(PAPER_X,1160,PAPER_WIDTH,310);
  // Head runs on a real moving guide in front of the upper print zone.
  const active=f&&b?b.items[f.item]:null,l=active?printLayout(active,this.state?.settings):null,printX=PAPER_X+(l?.left??48),printY=PAPER_Y+72;
  let hx=938,hy=425;
  if(f&&l){hx=printX+f.x*l.width;hy=printY+(f.y<=450?f.y/450*l.imageHeight:l.imageHeight+(f.y-450)/150*(l.height-l.imageHeight));
   if(f.phase==='preparing'){const t=f.local/.08,e=t*t*(3-2*t);hx=938+(printX-938)*e;hy=425+(printY+l.imageHeight/(2*f.lines)-425)*e;}
   else if(f.local>=.87){hx=938;hy=425;}
   else if(f.local>=.79){const t=Math.min(1,(f.local-.79)/.08),e=t*t*(3-2*t);hx=printX+l.width+(938-printX-l.width)*e;hy=(printY+l.imageHeight+(l.height-l.imageHeight)*5/6)*(1-e)+425*e;}}
  const railY=hy-55;const rail=c.createLinearGradient(0,railY,0,railY+15);rail.addColorStop(0,'#eef3f2');rail.addColorStop(.3,'#9aa9b9');rail.addColorStop(.6,'#52667c');rail.addColorStop(1,'#c1d0db');this.round(110,railY,858,14,5,rail as unknown as string,'#8da4b8');
  for(const x of [100,955])this.round(x,railY-12,28,40,5,'#172638','#51687f');
  if(f?.deposit){c.save();c.shadowColor=COLORS[active!.tier];c.shadowBlur=13;c.strokeStyle=COLORS[active!.tier];c.lineWidth=2;c.beginPath();c.moveTo(hx-8,hy);c.lineTo(hx,hy);c.stroke();c.restore();}
  const head=c.createLinearGradient(hx-32,hy-76,hx+29,hy-5);head.addColorStop(0,'#475e72');head.addColorStop(.5,'#182a3d');head.addColorStop(1,'#0c1624');this.round(hx-32,hy-79,64,65,9,head as unknown as string,'#5c7c91');
  for(const [i,color] of ['#49c0f0','#e25da0','#e8cf61'].entries()){c.fillStyle=color;c.fillRect(hx-22+i*15,hy-62,11,30);}
  c.fillStyle='#d1b47c';c.beginPath();c.moveTo(hx-8,hy-14);c.lineTo(hx+8,hy-14);c.lineTo(hx+2,hy);c.lineTo(hx-2,hy);c.fill();
  if(f?.deposit){c.save();c.shadowColor='#6fe4ef';c.shadowBlur=12;c.fillStyle='#b2f4f5';c.beginPath();c.ellipse(hx,hy,4,2,0,0,Math.PI*2);c.fill();c.restore();}
  // Horizontal brushed metal body and a deep roller slot.
  c.save();c.shadowColor='#4ac8ec66';c.shadowBlur=22;this.round(60,222,960,154,12,'#29485e');c.restore();
  const gold=spotlight?.item.tier==='fame'&&sp<1;const body=c.createLinearGradient(0,221,0,372);body.addColorStop(0,gold?'#e4d7b1':'#b2c2d1');body.addColorStop(.13,gold?'#c9ab70':'#879fb6');body.addColorStop(.48,gold?'#9b7a45':'#687e9e');body.addColorStop(.77,gold?'#d8bd82':'#8ba1bb');body.addColorStop(1,gold?'#584225':'#203d5b');this.round(63,223,954,144,10,body as unknown as string,gold?'#e2c77a':'#6aaec7');
  c.strokeStyle='#e6f8ff12';for(let y=238;y<350;y+=5){c.beginPath();c.moveTo(78,y);c.lineTo(1002,y);c.stroke();}
  this.round(86,370,900,24,6,'#0a101b','#3f647b');const roller=c.createLinearGradient(0,373,0,390);roller.addColorStop(0,'#8c9ca9');roller.addColorStop(.4,'#dae0e1');roller.addColorStop(1,'#4b6074');this.round(140,374,800,12,4,roller as unknown as string);
  for(let i=0;i<33;i++){c.fillStyle='#243c5133';const shift=(f?.feed??0)*18;c.fillRect(148+i*24+(shift%12),375,2,10);}
  for(const x of [85,1000])for(const y of [242,344]){c.fillStyle='#30455c';c.beginPath();c.arc(x,y,3,0,Math.PI*2);c.fill();}
  this.text(S.roll.engine,100,319,25,'#203448',600);this.text(active?`${S.tiers[active.tier]}  ·  ×${(active.style??this.state?.settings.tiers[active.tier])?.scale??1}`:S.roll.series,100,346,16,'#e1eff5',500);
  for(let i=0;i<20;i++){c.fillStyle='#344b64';c.fillRect(410+i*7,252,3,19);}
  this.round(800,239,200,111,10,'#111f2c','#9fb7c9');this.round(812,251,160,86,4,'#020b13');
  c.save();c.shadowColor='#68eff0';c.shadowBlur=6;const label=f?(f.local>=.87?S.roll.ready:S.roll.printing):S.roll.ready;this.text(label,892,284,20,'#7cecf0',700,'center');c.restore();
  this.text(active?Array.from(active.name).slice(0,18).join(''):S.ready,892,309,11,'#71a5b5',500,'center',130);
  for(let i=0;i<3;i++){c.fillStyle=i===0?'#63dfbb':i===1?'#57bbd6':'#819fc5';c.beginPath();c.arc(995,259+i*26,4,0,Math.PI*2);c.fill();}
  showAmbient(c,spotlight,sp);this.drawSpotlight();
  this.drawGiftGuide();
  this.text(`${this.state?.queue??0} ${S.queue}`,540,1880,18,'#8aa5b9',500,'center');
  const top=this.state?.top??[];if(top.length)this.text(S.supporters+'  '+top.map(p=>`${p.name} | ${S.coins(p.coins)}`).join('    '),540,1855,16,'#9eb8c9',400,'center',920);
  if(this.state?.honored){const texture=this.textures.get(this.state.honored.id);if(texture)drawHonored(c,this.state.honored,texture);}const ms=performance.now()-start;this.metrics.frames++;this.metrics.totalMs+=ms;this.metrics.maxMs=Math.max(this.metrics.maxMs,ms);return f;
 }
 drawGiftGuide(){
  const state=this.state;if(!state)return;const entries=guideItems(state.settings,state.demo,state.connection==='connected'?state.gifts:[]);if(!entries.length)return;
  this.text(state.demo?'GIFT GUIDE - DEMO PREVIEW':'GIFT GUIDE',540,1524,23,'#a9d6df',600,'center');
  entries.forEach(({tier,gift},i)=>{const row=i<4?0:1,col=i<4?i:i-4,count=row===0?Math.min(4,entries.length):entries.length-4,w=232,x=540+(col-(count-1)/2)*w,y=1574+row*146,image=this.giftImages.get(tier);
   if(image){const k=Math.min(76/image.naturalWidth,66/image.naturalHeight);this.ctx.drawImage(image,x-image.naturalWidth*k/2,y-image.naturalHeight*k/2,image.naturalWidth*k,image.naturalHeight*k);}
   this.text(gift.displayName||gift.name,x,y+58,26,'#eef1ed',600,'center',222);this.text(S.coins(gift.coins),x,y+85,22,'#dbc68e',500,'center',222);this.text(S.tiers[tier].replace('PRINT','Print').replace('HALL OF FAME','Hall of Fame').replace('LEGENDARY','Legendary').replace('RAINBOW','Rainbow').replace('ROYAL','Royal').replace('BLOOM','Bloom').replace('GLOW','Glow').replace('LOVE','Love'),x,y+109,20,COLORS[tier],500,'center',222);
  });
 }
 drawSpotlight(){
  const spot=this.state?.spotlight;if(!spot)return;const p=this.spotProgress??Math.max(0,Math.min(1,(playbackNow(this.state!)-spot.started)/spot.duration));if(p>=1)return;
  const t=this.textures.get(spot.item.id);if(!t)return;const c=this.ctx,color=COLORS[spot.item.tier],enter=Math.min(1,p*spot.duration/550),exit=Math.min(1,(1-p)*spot.duration/500),e=enter*enter*(3-2*enter),a=Math.min(e,exit),scale=.15+.85*a;
  if(this.showOrigin.token!==spot.token){const at=this.lastPositions.get(spot.item.id);this.showOrigin={token:spot.token,x:at?.x??360,y:Math.min(1750,at?.y??620)};}if(drawPerformance(c,spot,p,t,this.showOrigin))return;
  c.save();c.globalAlpha=a;c.translate(832+(540-832)*a,300+(950-300)*a);c.scale(scale,scale);
  const glow=c.createRadialGradient(0,-30,120,0,-20,470);glow.addColorStop(0,color+'38');glow.addColorStop(1,color+'00');c.fillStyle=glow;c.fillRect(-460,-480,920,960);
  c.shadowColor='#000b';c.shadowBlur=30;c.fillStyle='#081827ed';c.beginPath();c.roundRect(-312,-335,624,815,35);c.fill();c.shadowBlur=0;
  const radius=235;c.save();c.beginPath();c.arc(0,-36,radius,0,Math.PI*2);c.clip();const l=t.layout;c.drawImage(t.full,l.pad,l.pad,l.diameter,l.diameter,-radius,-radius-36,radius*2,radius*2);c.restore();
  c.strokeStyle=color;c.lineWidth=7;c.shadowColor=color;c.shadowBlur=14;c.beginPath();c.arc(0,-36,radius+8,0,Math.PI*2);c.stroke();c.shadowBlur=0;
  const tier=spot.item.tier,time=p*spot.duration/1000;
  if(tier==='bloom'||tier==='love')for(let i=0;i<14;i++){const phase=(time*.28+i/14)%1,angle=i*2.399,x=Math.cos(angle)*(230+phase*90),y=-36+Math.sin(angle)*230-phase*90;c.globalAlpha=a*(1-phase*.65);c.fillStyle=color;c.font=`${24+18*Math.sin(phase*Math.PI)}px "Segoe UI Emoji"`;c.textAlign='center';c.fillText(tier==='love'?'♥':'✿',x,y);}c.globalAlpha=a;
  if(tier==='royal'||tier==='fame'){
   c.strokeStyle='#e9c773';c.lineWidth=3;c.beginPath();c.roundRect(-280,-310,560,730,22);c.stroke();c.fillStyle='#f4d18a';c.font='80px "Segoe UI Emoji"';c.textAlign='center';c.fillText(tier==='royal'?'♛':'★',0,-269);
  }
  if(tier==='rainbow'){for(let i=0;i<32;i++){const angle=i/32*Math.PI*2+time*.7;c.strokeStyle=`hsl(${i/32*360+time*35} 78% 70%)`;c.lineWidth=9;c.beginPath();c.arc(0,-36,radius+18,angle,angle+.15);c.stroke();}}
  if(tier==='legendary'){
   c.save();c.shadowColor='#a288f2';c.shadowBlur=18;c.strokeStyle='#bfacf9';c.lineWidth=9;c.beginPath();for(let i=0;i<100;i++){const angle=i/99*Math.PI*2+time*.45,r=263+Math.sin(angle*5-time*2)*11,x=Math.cos(angle)*r,y=-36+Math.sin(angle)*r;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
   const angle=time*.45,hx=Math.cos(angle)*263,hy=-36+Math.sin(angle)*263;c.translate(hx,hy);c.rotate(angle+Math.PI/2);c.fillStyle='#d6c6ff';c.beginPath();c.moveTo(0,-28);c.lineTo(23,14);c.lineTo(7,10);c.lineTo(-6,25);c.lineTo(-23,6);c.closePath();c.fill();c.fillStyle='#67edf0';c.fillRect(-12,-4,5,5);c.fillRect(7,-4,5,5);c.restore();
  }
  if(tier==='fame')for(let i=0;i<40;i++){const q=(time*.35+i*.17)%1,x=Math.sin(i*7.3)*310,y=-330+q*700;c.save();c.translate(x,y);c.rotate(time+i);c.fillStyle=['#eac66b','#93dce8','#dba5cc','#b6dfb4'][i%4];c.fillRect(-3,-6,6,12);c.restore();}
  c.fillStyle='#f1f5ec';c.textAlign='center';c.font='600 43px "Noto Sans","Printer CJK","Printer Arabic"';wrapName(spot.item.name,s=>c.measureText(s).width,550).forEach((s,i)=>c.fillText(s,0,275+i*49,550));
  c.fillStyle=color;c.font='500 21px "Noto Sans"';c.fillText(S.tiers[tier],0,443,550);if(spot.item.quantity>1){c.fillStyle='#f4dba6';c.font='600 30px "Noto Sans"';c.fillText(`×${spot.item.quantity}`,236,-270);}
  c.restore();
 }
 pixels(){const t=this.batch?this.textures.get(this.batch.items[0].id):undefined;if(!t)return [];const c=t.mask.getContext('2d')!,w=t.full.width,h=t.full.height,a=c.getImageData(0,0,w,h).data,b=t.full.getContext('2d')!.getImageData(0,0,w,h).data;let visiblePixels=0,fullPixels=0,mismatchedPixels=0;for(let i=0;i<a.length;i+=4){if(a[i+3])visiblePixels++;if(b[i+3])fullPixels++;if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])mismatchedPixels++;}return [{visiblePixels,fullPixels,mismatchedPixels}];}
 close(){this.disposed=true;for(const t of this.textures.values()){if(t.image)t.image.src='';t.full.width=1;t.mask.width=1;}for(const image of this.giftImages.values())image.src='';this.textures.clear();this.giftImages.clear();this.sheet.width=1;this.background.width=1;this.element.width=1;}
}
