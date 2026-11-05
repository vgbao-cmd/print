import {useState} from 'react';
import {TIERS,type Settings,type Tier,type TierStyle} from './shared';
import {bridge} from './bridge';
import {S} from './strings';
export function TierSettings({draft,setDraft}:{draft:Settings;setDraft:(fn:(s:Settings)=>Settings)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const change=(tier:Tier,patch:Partial<TierStyle>)=>setDraft(s=>({...s,tiers:{...s.tiers,[tier]:{...s.tiers[tier],...patch}}}));
 async function choose(tier:Tier){setBusy(true);setError('');try{const r=await bridge.action('pickMusic');if(!r.ok)setError(r.message||S.premium.error);else if(r.musicFile)change(tier,{musicFile:r.musicFile,musicName:r.musicName||''});}catch{setError(S.premium.error);}finally{setBusy(false);}}
 return <section className="panel settings-panel"><h2>{S.premium.title}</h2><p className="hint">{S.premium.help}</p><p className="hint">{S.premium.localHelp}</p>{error&&<div className="notice error">{error}</div>}
 {TIERS.map(t=>{const v=draft.tiers[t];return <div className={`tier-settings-block tier-${t}`} key={t}><div className="section-line"><h2>{S.tiers[t]}</h2><span className="count-pill">×{v.scale}</span></div><div className="tier-fields">
  <label className="field-label">{S.premium.scale}<input type="number" min="0.5" max="4" step="0.05" value={v.scale} onChange={e=>change(t,{scale:Number(e.target.value)})}/></label>
  <label className="field-label">{S.premium.duration}<input type="number" min="0" max="30" step="0.5" value={v.spotlightDuration/1000} onChange={e=>change(t,{spotlightDuration:Number(e.target.value)*1000})}/></label>
 </div><label className="toggle-row"><span>{S.premium.enabled}</span><input type="checkbox" checked={v.spotlightEnabled} onChange={e=>change(t,{spotlightEnabled:e.target.checked})}/></label><label className="toggle-row"><span>{S.premium.voice}</span><input type="checkbox" checked={v.voiceEnabled} onChange={e=>change(t,{voiceEnabled:e.target.checked})}/></label>
 <label className="field-label">{S.premium.musicVolume}<input type="range" min="0" max="1" step="0.01" value={v.musicVolume} onChange={e=>change(t,{musicVolume:Number(e.target.value)})}/></label>
 <div className="music-file-row"><span><b>{S.premium.music}</b><small>{v.musicName||S.premium.builtin}</small></span><button className="button button-light" disabled={busy} onClick={()=>void choose(t)}>{S.premium.choose}</button></div>{v.musicFile&&<button className="text-button" onClick={()=>change(t,{musicFile:'',musicName:''})}>{S.premium.restore}</button>}
 </div>;})}</section>;
}
