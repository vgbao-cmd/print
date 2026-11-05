import type {LiveEvent,GiftEventDiagnostic} from '../src/shared';
export const diagnosticText=(v:unknown,n=140)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,'').replace(/https?:\/\/\S+/gi,'[redacted URL]').slice(0,n);
const identifier=(v:unknown)=>/^[\w.:-]{1,160}$/.test(String(v??''))?String(v):'';
export function giftDetails(raw:any):Partial<GiftEventDiagnostic>{return {
 giftId:identifier(raw.giftId??raw.gift?.id),giftName:diagnosticText(raw.gift?.name??raw.giftDetails?.giftName??raw.extendedGiftInfo?.name,100),
 coins:Number.isSafeInteger(Number(raw.gift?.diamondCount??raw.diamondCount))?Number(raw.gift?.diamondCount??raw.diamondCount):undefined,
 quantity:Number.isSafeInteger(Number(raw.repeatCount))?Number(raw.repeatCount):undefined,eventId:identifier(raw.common?.msgId??raw.msgId),comboId:identifier(raw.groupId),
};}
export function eventGiftDiagnostic(e:LiveEvent,result:any,catalogName=''):GiftEventDiagnostic{return {
 time:new Date().toISOString(),giftId:identifier(e.giftId),giftName:diagnosticText(catalogName||e.giftName,100),coins:e.coins,quantity:e.count,
 eventId:identifier(e.id),comboId:identifier(e.streak),tier:result.tier,outcome:result.outcome??(result.prints?'queued':result.fresh?'unmapped':'duplicate'),reason:result.reason??'',
};}
