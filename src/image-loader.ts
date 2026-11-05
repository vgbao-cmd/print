// Bound image decoding as well as downloads. Large WebP avatars are immediately
// resampled, then their original decoded surface is released.
let active=0;const waiters:(()=>void)[]=[];
export async function loadImage(src:string):Promise<HTMLImageElement>{
 if(active>=2)await new Promise<void>(resolve=>waiters.push(resolve));else active++;
 try{const image=new Image();image.src=src;await image.decode();if(Math.max(image.naturalWidth,image.naturalHeight)<=512)return image;
  const k=512/Math.max(image.naturalWidth,image.naturalHeight),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*k));canvas.height=Math.max(1,Math.round(image.naturalHeight*k));canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);image.src='';const scaled=new Image();scaled.src=canvas.toDataURL('image/png');canvas.width=1;await scaled.decode();return scaled;
 }finally{const next=waiters.shift();if(next)next();else active--;}
}
