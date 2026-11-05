import {TIERS,type Gift,type Settings,type Tier} from './shared';
export const PRESETS:Partial<Record<Tier,Gift>>={
 glow:{id:'',name:'Rose',coins:1,image:'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp'},
 bloom:{id:'',name:'Finger Heart',coins:5,image:'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/a4c4dc437fd3a6632aba149769491f49.png~tplv-obj.webp'},
 love:{id:'',name:'Rosa',coins:10,image:'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eb77ead5c3abb6da6034d3cf6cfeb438~tplv-obj.webp'},
 royal:{id:'',name:'Perfume',coins:20,image:'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/20b8f61246c7b6032777bb81bf4ee055~tplv-obj.webp'},
 rainbow:{id:'',name:'Doughnut',coins:30,image:'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/4e7ad6bdf0a1d860c538f38026d4e812~tplv-obj.webp'},
 legendary:{id:'',name:'Takoyaki',coins:88,image:'https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b0d9f32b9d4c04afbb0267dcb5b576fa.png~tplv-obj.webp'},
 fame:{id:'',name:'Hand Heart',coins:100,image:'https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/374dfe46d5b09ce1db19be06202d34f5.png~tplv-obj.webp'}
};
export const giftName=(name:string)=>name.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
export const isTakoyaki=(g:Gift)=>g.coins===88&&giftName(g.name)==='takoyaki';
export function verifiedMapping(g:Gift|undefined,catalog:Gift[],tier:Tier){const actual=g&&catalog.find(a=>a.id===g.id&&a.coins===g.coins&&giftName(a.name)===giftName(g.name));return !!actual&&/^[\x20-\x7e]+$/.test(g!.displayName?.trim()||g!.name)&&(tier!=='legendary'||isTakoyaki(actual));}
export function resolvePresets(settings:Settings,catalog:Gift[]){
 const next=structuredClone(settings);for(const tier of TIERS.slice(1)){const old=next.mappings[tier],preset=PRESETS[tier]!;
  if(old){if(verifiedMapping(old,catalog,tier)){const actual=catalog.find(g=>g.id===old.id)!;next.mappings[tier]={...actual,displayName:old.displayName};}continue;}
  const matches=catalog.filter(g=>g.coins===preset.coins&&giftName(g.name)===giftName(preset.name));if(matches.length===1)next.mappings[tier]={...matches[0],displayName:preset.name};
 }return next;
}
export function guideItems(settings:Settings,demo:boolean,catalog:Gift[]){return TIERS.slice(1).flatMap(tier=>{const g=settings.mappings[tier];return demo?[{tier,gift:PRESETS[tier]!,preview:true}]:verifiedMapping(g,catalog,tier)?[{tier,gift:g!,preview:false}]:[];});}
export function fallbackGiftImage(g:Gift,tier:Tier){const preset=PRESETS[tier];return preset&&giftName(g.name)===giftName(preset.name)&&g.coins===preset.coins?preset.image:'';}
