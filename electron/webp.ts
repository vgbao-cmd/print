export function webpSize(b:Buffer):{width:number;height:number}|null{
 if(b.length<30||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WEBP')return null;
 for(let at=12;at+8<b.length;){const kind=b.toString('ascii',at,at+4),length=b.readUInt32LE(at+4),p=at+8;if(p+length>b.length)return null;
  if(kind==='VP8X'&&length>=10){if(b[p]&2)return null;return {width:1+b.readUIntLE(p+4,3),height:1+b.readUIntLE(p+7,3)};}
  if(kind==='VP8 '&&length>=10&&b[p+3]===0x9d&&b[p+4]===1&&b[p+5]===0x2a)return {width:b.readUInt16LE(p+6)&0x3fff,height:b.readUInt16LE(p+8)&0x3fff};
  if(kind==='VP8L'&&length>=5&&b[p]===0x2f)return {width:1+(b[p+1]|(b[p+2]&63)<<8),height:1+((b[p+2]>>6)|(b[p+3]<<2)|((b[p+4]&15)<<10))};at=p+length+(length%2);
 }return null;
}
