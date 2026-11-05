import type {Print,Spotlight} from './shared';
import type {PrintLayout} from './print-layout';
import {wrapName} from './text-layout';
export interface FaceTexture {full:HTMLCanvasElement;layout:PrintLayout}
const ease=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
function text(c:CanvasRenderingContext2D,s:string,x:number,y:number,size:number,color:string){c.fillStyle=color;c.textAlign='center';c.font=`600 ${size}px "Noto Sans","Printer CJK","Printer Arabic"`;c.fillText(s,x,y);}
function face(c:CanvasRenderingContext2D,t:FaceTexture,x:number,y:number,r:number){c.save();c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.clip();const l=t.layout;c.drawImage(t.full,l.pad,l.pad,l.diameter,l.diameter,x-r,y-r,r*2,r*2);c.restore();}
function name(c:CanvasRenderingContext2D,item:Print,y:number,color='#f4f3e8',size=43){c.fillStyle=color;c.textAlign='center';c.font=`650 ${size}px "Noto Sans","Printer CJK","Printer Arabic"`;wrapName(item.name,s=>c.measureText(s).width,660).forEach((s,i)=>c.fillText(s,0,y+i*(size+7),660));}
function ring(c:CanvasRenderingContext2D,r:number,color:string,width=5){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();}
function crown(c:CanvasRenderingContext2D,y:number,scale=1){c.save();c.translate(0,y);c.scale(scale,scale);c.fillStyle='#f5d37f';c.strokeStyle='#fff1b0';c.lineWidth=2;c.beginPath();c.moveTo(-65,20);c.lineTo(-78,-38);c.lineTo(-36,-13);c.lineTo(0,-64);c.lineTo(36,-13);c.lineTo(78,-38);c.lineTo(65,20);c.closePath();c.fill();c.stroke();c.fillStyle='#bf8e32';c.fillRect(-65,22,130,14);for(const x of [-38,0,38]){c.fillStyle=x?'#e8a7ad':'#81d6e5';c.beginPath();c.arc(x,6,5,0,Math.PI*2);c.fill();}c.restore();}
function quantity(c:CanvasRenderingContext2D,item:Print,x:number,y:number){if(item.quantity>1)text(c,`×${item.quantity}`,x,y,29,'#ffdc8d');}
export function showAmbient(c:CanvasRenderingContext2D,spot:Spotlight|null|undefined,p:number){
 if(!spot)return;const tier=spot.item.tier,strength=ease(p/.1)*ease((1-p)/.1);
 if(tier==='legendary'){c.fillStyle=`rgba(1,5,19,${.23*strength})`;c.fillRect(0,223,1080,1697);}
 if(tier==='fame'){const g=c.createRadialGradient(540,700,80,540,850,950);g.addColorStop(0,`rgba(248,188,65,${.18*strength})`);g.addColorStop(1,'#dcaf4e00');c.fillStyle=g;c.fillRect(0,223,1080,1697);c.save();c.globalAlpha=.1*strength;c.fillStyle='#f8df96';for(const x of [120,960]){c.beginPath();c.moveTo(x,260);c.lineTo(540+(x-540)*.25,1580);c.lineTo(540+(x-540)*.9,1580);c.closePath();c.fill();}c.restore();}
}
export function drawPerformance(c:CanvasRenderingContext2D,spot:Spotlight,p:number,t:FaceTexture,origin={x:360,y:620}):boolean{
 const tier=spot.item.tier;if(!['royal','rainbow','legendary','fame'].includes(tier))return false;
 const intro=ease(p/.14),out=ease((1-p)/.12),time=p*spot.duration/1000;
 c.save();
 if(tier==='royal'){
  c.translate(540,910);c.globalAlpha=Math.min(intro,out);c.fillStyle='#0c1a2bf2';c.beginPath();c.roundRect(-322,-330,644,815,26);c.fill();
  // Two gold doors unfold; the crown physically descends into place.
  const opening=ease(p/.25);c.strokeStyle='#f2cc73';c.lineWidth=7;
  for(const side of [-1,1]){c.save();c.translate(side*(20+265*opening),0);c.scale(Math.max(.08,opening),1);c.strokeRect(side<0?-20:0,-295,20,600);c.restore();}
  c.save();c.scale(.8+.2*intro,.8+.2*intro);face(c,t,0,-20,224);c.translate(0,-20);ring(c,234,'#e7c474',8);ring(c,246,'#ba8e3d',2);c.restore();
  crown(c,-248-150*(1-ease((p-.07)/.25)),.85);name(c,spot.item,275,'#fff0ca',36);
  const stamp=ease((p-.48)/.12);c.save();c.translate(0,440);c.rotate(-.055);c.scale(1+.55*(1-stamp),1+.55*(1-stamp));c.globalAlpha*=stamp;c.strokeStyle='#e6bd65';c.lineWidth=3;c.strokeRect(-205,-38,410,66);text(c,'ROYAL GUEST',0,8,30,'#f4d887');c.restore();quantity(c,spot.item,252,-255);
 }else if(tier==='rainbow'){
  c.translate(540,935);const opening=ease(p/.18),closing=ease((1-p)/.16);c.globalAlpha=Math.min(opening,closing);
  // A tall portal, not a recolored picture frame.
  c.fillStyle='#0b1532ee';c.beginPath();c.ellipse(0,5,310*opening,407,0,0,Math.PI*2);c.fill();
  for(let i=0;i<7;i++){c.strokeStyle=`hsl(${i*50+time*35} 88% 69%)`;c.lineWidth=8;c.beginPath();c.ellipse(0,-8,286+i*5,370+i*5,0,0,Math.PI*2);c.stroke();}
  const flight=ease((p-.12)/.18);c.save();c.translate((origin.x-540)*(1-flight),(origin.y-935)*(1-flight));const initial=t.layout.diameter/492,flyScale=initial+(1-initial)*flight;c.scale(flyScale,flyScale);face(c,t,0,-35,246);c.restore();
  for(let j=0;j<4;j++){c.strokeStyle=`hsla(${j*85+time*80} 88% 73% / .8)`;c.lineWidth=6;c.beginPath();for(let i=0;i<70;i++){const a=i/69*Math.PI*2+time*.7+j,r=270+Math.sin(a*3+j)*16,x=Math.cos(a)*r,y=-35+Math.sin(a)*r*.92;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}
  name(c,spot.item,285);text(c,'RAINBOW PRINT',0,414,24,'#b9d4ff');quantity(c,spot.item,260,-270);
 }else if(tier==='legendary'){
  c.translate(540,950);c.globalAlpha=Math.min(intro,out);c.fillStyle='#081129f2';c.beginPath();c.moveTo(0,-365);c.lineTo(330,-230);c.lineTo(300,290);c.lineTo(0,475);c.lineTo(-300,290);c.lineTo(-330,-230);c.closePath();c.fill();
  face(c,t,0,-45,254);ring(c,272,'#a991e9',3);
  // A segmented luminous dragon flies in, then coils into the badge ring.
  const coil=ease((p-.04)/.32),phase=time*.62;c.save();c.shadowColor='#a389ef';c.shadowBlur=16;c.lineCap='round';c.strokeStyle='#c1adff';c.lineWidth=11;c.beginPath();let hx=0,hy=0;
  for(let i=0;i<76;i++){const u=i/75,a=u*Math.PI*2*coil+phase,r=290+Math.sin(u*22-time*2)*10,x=Math.cos(a)*r-650*(1-coil)*(1-u),y=-45+Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y);hx=x;hy=y;}c.stroke();
  c.translate(hx,hy);c.rotate(phase+Math.PI/2);c.fillStyle='#dbcaff';c.beginPath();c.moveTo(0,-37);c.lineTo(23,-8);c.lineTo(30,20);c.lineTo(10,12);c.lineTo(0,33);c.lineTo(-17,17);c.lineTo(-30,20);c.lineTo(-23,-8);c.closePath();c.fill();c.fillStyle='#83f7ed';c.fillRect(-15,-3,7,5);c.fillRect(8,-3,7,5);c.strokeStyle='#c9b5ff';c.lineWidth=4;c.beginPath();c.moveTo(-17,-18);c.quadraticCurveTo(-36,-42,-19,-56);c.moveTo(17,-18);c.quadraticCurveTo(36,-42,19,-56);c.moveTo(-25,12);c.bezierCurveTo(-60,0,-56,45,-77,39);c.moveTo(25,12);c.bezierCurveTo(60,0,56,45,77,39);c.stroke();c.fillStyle='#e7dcff';c.beginPath();c.moveTo(-8,20);c.lineTo(0,49);c.lineTo(8,20);c.closePath();c.fill();c.restore();for(let j=0;j<12;j++){const a=j/12*Math.PI*2*coil+phase,r=290;c.save();c.translate(Math.cos(a)*r,-45+Math.sin(a)*r);c.rotate(a);c.fillStyle='#a0e7ee';c.beginPath();c.moveTo(3,-9);c.lineTo(24,0);c.lineTo(3,9);c.closePath();c.fill();c.restore();}
  const badge=ease((p-.48)/.15);c.globalAlpha*=badge;name(c,spot.item,320,'#ede7ff',38);text(c,'LEGENDARY SUPPORTER',0,448,25,'#c1adff');if(p>.85){c.save();c.translate(0,475);c.scale(1+.2*(1-ease((p-.85)/.06)),1);text(c,'✦  LEGENDARY BADGE  ✦',0,0,18,'#a4eee9');c.restore();}quantity(c,spot.item,265,-290);
 }else{
  // The largest avatar and a stage affecting the whole machine environment.
  const returning=ease((p-.90)/.10),x=540+(205-540)*returning,y=945+(204-945)*returning,scale=1-.944*returning;
  c.translate(x,y);c.scale(scale,scale);c.globalAlpha=intro;
  const rise=ease(p/.18);c.fillStyle='#101d2bf5';c.strokeStyle='#d8b15b';c.lineWidth=3;c.beginPath();c.moveTo(-365,-365);c.lineTo(365,-365);c.lineTo(365,455);c.lineTo(285,510);c.lineTo(-285,510);c.lineTo(-365,455);c.closePath();c.fill();c.stroke();
  for(const side of [-1,1]){c.fillStyle='#cba257';c.beginPath();c.moveTo(side*355,-320);c.lineTo(side*(355+85*rise),-160);c.lineTo(side*(355+85*rise),450);c.lineTo(side*355,380);c.closePath();c.fill();}
  text(c,'HALL OF FAME',0,-300,37,'#ffe4a0');face(c,t,0,-5,282);c.save();c.translate(0,-5);ring(c,292,'#f2d38c',9);ring(c,305,'#a8833d',3);c.restore();
  if(returning<.8){c.globalAlpha*=1-returning;name(c,spot.item,332,'#fff4d7',40);text(c,'HONORED GUEST',0,477,24,'#e7c986');quantity(c,spot.item,301,-325);
   for(let i=0;i<36;i++){const u=(time*.25+i*.139)%1,px=Math.sin(i*12.1)*365,py=-360+u*820;c.save();c.translate(px,py);c.rotate(time+i);c.fillStyle=['#e9c875','#b4e9e7','#f0b1cd','#fff1c1'][i%4];c.fillRect(-3,-7,6,14);c.restore();}}
 }
 c.restore();return true;
}
export function drawHonored(c:CanvasRenderingContext2D,item:Print,t:FaceTexture){c.save();c.fillStyle='#122534';c.strokeStyle='#ac8b4a';c.lineWidth=1;c.beginPath();c.roundRect(171,187,774,33,8);c.fill();c.stroke();face(c,t,205,203.5,15);text(c,'HONORED GUEST',315,209,13,'#e5c16c');c.textAlign='left';c.fillStyle='#f1e7cb';c.font='600 18px "Noto Sans","Printer CJK","Printer Arabic"';const name=item.name.length>48?item.name.slice(0,47)+'…':item.name;c.fillText(name,405,210,510);c.restore();}
