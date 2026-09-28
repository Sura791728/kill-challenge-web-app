'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {type Settings,type Counts,validateSettings} from '@/lib/stream';

export default function SettingsEditor({current,counts,onSave}:{current:Settings;counts:Counts;onSave:(settings:Settings)=>void}){
  const [draft,setDraft]=useState<Settings>(()=>structuredClone(current));
  const [dirty,setDirty]=useState(false),[error,setError]=useState('');
  useEffect(()=>{if(!dirty)setDraft(structuredClone(current));},[current,dirty]);
  const edit=(fn:(s:Settings)=>void)=>{setDraft(old=>{const next=structuredClone(old);fn(next);return next;});setDirty(true);setError('');};
  const keys=['small','medium','large'] as const;
  function save(){
    try{
      const next=validateSettings(draft);
      const removed=current.panels.filter(p=>!next.panels.some(n=>n.id===p.id));
      if(removed.some(p=>counts.panels[current.panels.findIndex(x=>x.id===p.id)]>0)&&!confirm('削除するパネルの記録も消えます。続けますか？'))return;
      onSave(next);setDirty(false);setError('');
    }catch(e){setError(e instanceof Error?e.message:'入力を確認してください');}
  }
  return <details className="card settings-card"><summary>⚙ チャレンジ設定を編集 <span>パネル・ポイント・ギフト・倍率</span></summary><div className="settings-content">
    <p className="hint">このゲームの設定だけを変更します。VALORANTとAPEXの記録は別々です。</p>
    <h3>ポイントとキル</h3><div className="settings-points"><label>ポイントの呼び名<Input value={draft.pointLabel} maxLength={12} onChange={e=>edit(s=>{s.pointLabel=e.target.value;})}/></label><label>1キルに必要なポイント<Input type="number" min="1" step="1" value={draft.pointsPerKill} onChange={e=>edit(s=>{s.pointsPerKill=Number(e.target.value);})}/></label></div>
    <h3>パネルの内容 <small>1～16枚</small></h3><div className="setting-list">{draft.panels.map((p,i)=><div className="setting-panel" key={p.id}><span className="setting-index">{i+1}</span><label>名前<Input value={p.name} maxLength={32} onChange={e=>edit(s=>{s.panels[i].name=e.target.value;})}/></label><label>目標数<Input type="number" min="1" step="1" value={p.goal} onChange={e=>edit(s=>{s.panels[i].goal=Number(e.target.value);})}/></label><label>単位<Input value={p.unit} maxLength={8} onChange={e=>edit(s=>{s.panels[i].unit=e.target.value;})}/></label><Button type="button" variant="outline" disabled={draft.panels.length<=1} onClick={()=>edit(s=>{const id=s.panels[i].id;s.panels.splice(i,1);for(const key of keys)if(s.gifts[key].panelId===id)s.gifts[key].panelId=null;})}>削除</Button></div>)}</div><Button type="button" variant="secondary" disabled={draft.panels.length>=16} onClick={()=>edit(s=>{s.panels.push({id:crypto.randomUUID(),name:`パネル${s.panels.length+1}`,goal:1,unit:'回'});})}>＋ パネルを追加</Button>
    <h3>ギフトのポイント <small>連動先を選ぶと個数もパネルに加算</small></h3><div className="setting-list">{keys.map(key=><div className="setting-gift" key={key}><label>表示名<Input value={draft.gifts[key].name} maxLength={24} onChange={e=>edit(s=>{s.gifts[key].name=e.target.value;})}/></label><label>1個のポイント<Input type="number" min="0" step="1" value={draft.gifts[key].points} onChange={e=>edit(s=>{s.gifts[key].points=Number(e.target.value);})}/></label><label>連動するパネル<select value={draft.gifts[key].panelId??''} onChange={e=>edit(s=>{s.gifts[key].panelId=e.target.value||null;})}><option value="">なし</option>{draft.panels.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label></div>)}</div>
    <h3>ランク倍率 <small>倍率を掛けた後、小数点以下を切り捨て</small></h3><div className="setting-ranks">{draft.ranks.map((r,i)=><div key={i}><label>ランク名<Input value={r.name} maxLength={24} onChange={e=>edit(s=>{s.ranks[i].name=e.target.value;})}/></label><label>倍率<Input type="number" min="0" max="10" step="0.1" value={r.factor} onChange={e=>edit(s=>{s.ranks[i].factor=Number(e.target.value);})}/></label><Button type="button" variant="outline" disabled={draft.ranks.length<=1} onClick={()=>edit(s=>{s.ranks.splice(i,1);})}>削除</Button></div>)}</div><Button type="button" variant="secondary" disabled={draft.ranks.length>=12} onClick={()=>edit(s=>{s.ranks.push({name:'新しい倍率',factor:1});})}>＋ 倍率を追加</Button>
    <div className="settings-save"><Button type="button" onClick={save} disabled={!dirty}>設定を保存</Button><Button type="button" variant="outline" onClick={()=>{setDraft(structuredClone(current));setDirty(false);setError('');}}>入力を戻す</Button><span role="status">{error||'パネルの追加・削除後は操作履歴を新しい配置に合わせて整理します。'}</span></div>
  </div></details>;
}
