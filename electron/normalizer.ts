import type {Gift,LiveEvent} from '../src/shared';
type Raw=Record<string,any>;
const text=(v:unknown,n=200)=>Array.from(String(v??'')).slice(0,n).join('').replace(/[\u0000-\u001f\u007f]/g,'');
export const url=(v:unknown)=>{try{const u=new URL(String(v));return u.protocol==='https:'?u.href:'';}catch{return '';}};
const image=(v:any)=>url(typeof v==='string'?v:v?.urlList?.[0]??v?.url_list?.[0]??v?.url?.[0]);
// Native v2.5 User.avatarThumb/avatarMedium/avatarLarge, Image.urlList.
// profilePictureUrl is supported only as a legacy payload compatibility path.
// Never use room totalLikeCount as a per-viewer delta.
export function normalize(type:'like'|'gift',raw:Raw,room:string):LiveEvent|null{
  const u=raw.user??raw; const userId=text([u.userId,u.idStr,u.id,u.uniqueId,u.displayId].find(v=>v!=null&&String(v)!==''&&!['0','unknown','anonymous'].includes(String(v).toLowerCase())),140);
  const msg=text(raw.common?.msgId??raw.common?.messageId??raw.msgId,140);
  const group=text(raw.groupId??raw.gift?.groupId,140);
  if(!userId||['0','unknown','anonymous'].includes(userId.toLowerCase()))return null;
  const count=Number(type==='like'?(raw.likeCount??raw.count):(raw.repeatCount??1));
  if(!Number.isSafeInteger(count)||count<1||count>1e7)return null;
  const giftId=text([raw.giftId,raw.gift?.id].find(v=>v!=null&&String(v)!==''&&String(v)!=='0'),100);
  const end=raw.repeatEnd===true||raw.repeatEnd===1;
  // Refuse unidentifiable events rather than silently replaying them on reconnect.
  const id=msg&&msg!=='0'?msg:(type==='gift'&&group&&group!=='0'?`group:${group}:${count}:${end}`:'');
  if(!id)return null;
  const payloadRoom=String(raw.common?.roomId??'');
  const e:LiveEvent={id,scope:`tiktok:${text(payloadRoom&&payloadRoom!=='0'?payloadRoom:room,140)}`,type,userId,name:text(u.nickname||u.nickName||u.uniqueId||userId),avatar:image(u.avatarThumb)||image(u.avatarMedium)||image(u.avatarLarge)||url(u.profilePictureUrl??raw.profilePictureUrl),count};
  if(type==='gift'){
    if(payloadRoom&&payloadRoom!=='0'&&room&&payloadRoom!==room)return null;
    if(!giftId)return null;e.giftId=giftId;e.giftName=text(raw.gift?.name??raw.giftDetails?.giftName??raw.extendedGiftInfo?.name,100);
    const coins=Number([raw.gift?.diamondCount,raw.extendedGiftInfo?.diamond_count,raw.diamondCount].find(v=>Number.isSafeInteger(Number(v))&&Number(v)>0));
    if(Number.isSafeInteger(coins)&&coins>0)e.coins=coins;
    e.streakable=Number(raw.giftType??raw.gift?.type??raw.giftDetails?.giftType)===1;
    e.end=end;
    if(e.streakable)e.streak=group&&group!=='0'?group:undefined;
    // Missing group IDs cannot safely distinguish repeated final updates.
    if(e.streakable&&!e.streak)return null;
  }
  return e;
}
export function catalog(raw:any):Gift[]{
  const list=Array.isArray(raw)?raw:raw?.gifts??raw?.data?.gifts??raw?.data??[];
  if(!Array.isArray(list))return [];
  const gifts=new Map<string,Gift>();
  for(const g of list){const id=text(g.id??g.gift_id,100),coins=Number(g.diamond_count??g.diamondCount),name=text(g.name_en??g.nameEn??g.name??g.gift_name),img=image(g.image??g.icon);
    if(id&&id!=='0'&&name&&Number.isSafeInteger(coins)&&coins>0)gifts.set(id,{id,name,image:img,coins});}
  return [...gifts.values()].slice(0,3000).sort((a,b)=>a.coins-b.coins||a.id.localeCompare(b.id));
}

export function giftRejection(raw:Raw,room:string):string {
 const u=raw.user??raw;
 if(![u.userId,u.idStr,u.id,u.uniqueId,u.displayId].some(v=>v!=null&&String(v)!==''&&!['0','unknown','anonymous'].includes(String(v).toLowerCase())))return 'Missing reliable viewer ID; cannot safely award a print.';
 if(raw.common?.roomId&&String(raw.common.roomId)!=='0'&&String(raw.common.roomId)!==room)return 'Payload room does not match the active connection.';
 const count=Number(raw.repeatCount??1);if(!Number.isSafeInteger(count)||count<1||count>1e7)return 'Invalid or zero repeat count; quantity cannot be safely inferred.';
 if(![raw.giftId,raw.gift?.id].some(v=>v!=null&&String(v)!==''&&String(v)!=='0'))return 'Missing real gift ID.';
 if(Number(raw.giftType??raw.gift?.type??raw.giftDetails?.giftType)===1&&(!raw.groupId||String(raw.groupId)==='0'))return 'Combo missing group ID; independent gifts cannot be distinguished safely.';
 return 'Missing reliable message ID or combo ID; replay protection requires event identity.';
}
