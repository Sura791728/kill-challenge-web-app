'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import SettingsEditor from './settings-editor';
import {allComplete,defaultSettings,normalizeStream,quota,reduce,remaining,zero,type Action,type Game,type Stream} from '@/lib/stream';

const fmt=(n:number)=>n.toLocaleString('ja-JP');
const asInt=(s:string)=>s.trim()===''?NaN:Number(s);
export default function Control({userId,game}:{userId:string;game:Game}){
  const key=`kill-challenge-outbox:${userId}:${game}`,cache=`kill-challenge-snapshot:${userId}:${game}`;
  const [stream,setStream]=useState<Stream|null>(null),[status,setStatus]=useState('記録を読み込み中…'),[queueCount,setQueueCount]=useState(0);
  const [killQty,setKillQty]=useState('1'),[killRank,setKillRank]=useState('1');
  const [giftQty,setGiftQty]=useState<Record<string,string>>({small:'1',medium:'1',large:'1'});
  const [otherBC,setOtherBC]=useState(''),[otherQty,setOtherQty]=useState('1');
  const [panelQty,setPanelQty]=useState<string[]>([]);
  const [party,setParty]=useState(Array.from({length:5},()=>({quantity:'0',rank:'1'})));
  const [view,setView]=useState<'gauge'|'panels'>('gauge');
  const [overlayToken,setOverlayToken]=useState('');
  const [legacy,setLegacy]=useState<{bc:number;kills:number;panels:number[]}|null>(null);
  const stateRef=useRef<Stream|null>(null),queueRef=useRef<Action[]>([]),busyRef=useRef(false);
  const show=(value:Stream)=>{const s=normalizeStream(value,game);stateRef.current=s;setStream(s);try{localStorage.setItem(cache,JSON.stringify(s));}catch{}};
  const saveQueue=(q:Action[])=>{try{localStorage.setItem(key,JSON.stringify(q));queueRef.current=q;setQueueCount(q.length);return true;}catch{setStatus('未送信操作を端末に保存できません');return false;}};
  const api=`/api/state?game=${game}`;
  const sync=useCallback(async()=>{
    if(busyRef.current)return;busyRef.current=true;
    try{
      const response=await fetch(api,{cache:'no-store'});
      const data=await response.json() as {stream:Stream;error?:string};if(!response.ok)throw Error(data.error||'読み込みに失敗しました');
      let next=normalizeStream(data.stream,game);
      for(const action of queueRef.current)next=reduce(next,action);
      show(next);
      while(queueRef.current.length){
        const action=queueRef.current[0];
        const sent=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(action)});
        const result=await sent.json() as {stream:Stream;error?:string};if(!sent.ok)throw Error(result.error||'送信に失敗しました');
        if(!saveQueue(queueRef.current.slice(1)))throw Error('未送信履歴を更新できません');
        next=normalizeStream(result.stream,game);
        for(const pending of queueRef.current)next=reduce(next,pending);
        show(next);
      }
      setStatus('同期済み');
    }catch(e){setStatus(`${queueRef.current.length?'未送信 '+queueRef.current.length+'件 · ':''}${e instanceof Error?e.message:'接続を確認してください'}`);}
    finally{busyRef.current=false;}
  },[api,game]);
  useEffect(()=>{
    try{
      const cached=JSON.parse(localStorage.getItem(cache)||'null');if(cached)show(cached);
      const pending=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(pending))saveQueue(pending);
      if(game==='valorant'){
        const old=JSON.parse(localStorage.getItem('kill-challenge-console-v1')||'null')?.state;
        if(old&&Number.isSafeInteger(old.bc)&&Number.isSafeInteger(old.kills)&&Array.isArray(old.panels)&&old.panels.length===5&&[old.bc,old.kills,...old.panels].some(Boolean))setLegacy(old);
      }
    }catch{}
    void sync();const timer=setInterval(()=>void sync(),3000);return()=>clearInterval(timer);
  },[sync,cache,key,game]);
  useEffect(()=>{
    let alive=true;
    void fetch(`/api/overlay-link?game=${game}`,{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<{token:string}>;}).then(data=>{if(alive)setOverlayToken(data.token);}).catch(()=>{if(alive)setStatus('OBS表示URLを読み込めません。ページを再読み込みしてください');});
    return()=>{alive=false;};
  },[game]);
  const defaults=useMemo(()=>defaultSettings(game),[game]);
  const settings=stream?.settings??defaults,count=stream?.counts??zero(settings.panels.length);
  useEffect(()=>{
    const factors=settings.ranks.map(r=>String(r.factor));
    if(!factors.includes(killRank))setKillRank(factors[0]);
    setParty(old=>old.map(p=>factors.includes(p.rank)?p:{...p,rank:factors[0]}));
  },[settings.ranks,killRank]);
  function submit(fields:Omit<Action,'id'>){
    const action={...fields,id:crypto.randomUUID()} as Action;
    if(!stateRef.current){setStatus('記録を読み込んでから操作してください');return;}
    try{
      const preview=reduce(stateRef.current,action);
      if(preview===stateRef.current)return;
      if(!saveQueue([...queueRef.current,action]))return;
      show(preview);setStatus(`未送信 ${queueRef.current.length}件`);void sync();
    }catch(e){setStatus(e instanceof Error?e.message:'入力を確認してください');}
  }
  const setPanel=(i:number,value:string)=>setPanelQty(old=>{const next=old.slice();next[i]=value;return next;});
  const setPlayer=(i:number,field:'quantity'|'rank',value:string)=>setParty(old=>old.map((p,j)=>j===i?{...p,[field]:value}:p));
  async function copyOverlay(){
    if(!overlayToken){setStatus('OBS表示URLを準備中です');return;}
    const url=new URL('/overlay',location.origin);url.searchParams.set('view',view);url.searchParams.set('game',game);
    url.searchParams.set('token',overlayToken);
    try{await navigator.clipboard.writeText(url.href);setStatus('OBS用URLをコピーしました');}
    catch{setStatus(`OBS用URL：${url.href}`);}
  }
  async function renewOverlay(){
    if(!confirm('今までのOBS表示URLは使えなくなります。新しいURLを発行しますか？'))return;
    try{const response=await fetch(`/api/overlay-link?game=${game}`,{method:'POST'});const data=await response.json() as {token?:string;error?:string};if(!response.ok||!data.token)throw Error(data.error||'発行できません');setOverlayToken(data.token);setStatus('新しいOBS表示URLを発行しました');}
    catch(e){setStatus(e instanceof Error?e.message:'OBS表示URLを更新できません');}
  }
  const overlayHref=overlayToken?`/overlay?game=${game}&view=${view}&token=${encodeURIComponent(overlayToken)}`:'';
  const teamSize=game==='apex'?3:5;
  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">◎</span><div><span className="eyebrow">STREAM CONTROL</span><h1>キルチャレ管理</h1></div></div><div className="top-actions"><span className="sync-state">{status}</span><Button className="undo" variant="secondary" disabled={!stream?.undo.length} onClick={()=>submit({kind:'undo'})}>↶ 元に戻す</Button><Button className="undo" variant="secondary" disabled={!stream?.redo.length} onClick={()=>submit({kind:'redo'})}>↷ やり直す</Button></div></header>
    <nav className="game-tabs" aria-label="ゲームを切り替え"><a href="/?game=valorant" aria-current={game==='valorant'?'page':undefined}>VALORANT</a><a href="/?game=apex" aria-current={game==='apex'?'page':undefined}>APEX</a><a className="signout-link" href="/signout-with-chatgpt?return_to=/">ログアウト</a></nav>
    <section className="scoreboard" aria-label="配信の集計"><div className="score primary"><span>残りキルノルマ</span><div><strong>{fmt(remaining(count,settings))}</strong> キル</div><small>{fmt(settings.pointsPerKill)}{settings.pointLabel}ごとに1キル · 小数点以下切り捨て</small></div><div className="score"><span>累計{settings.pointLabel}</span><div><strong>{fmt(count.bc)}</strong> {settings.pointLabel}</div><small>次の1キルまで {fmt(settings.pointsPerKill-count.bc%settings.pointsPerKill)}{settings.pointLabel}</small></div><div className="score"><span>消化 / 換算</span><div><strong>{fmt(count.kills)}</strong> / {fmt(count.converted)}</div><small>獲得ノルマ {fmt(quota(count,settings))}キル</small></div></section>
    {legacy&&stream&&settings.panels[0]?.id==='legacy-0'&&![count.bc,count.kills,...count.panels].some(Boolean)&&<div className="legacy-banner"><div><strong>この端末に旧版の記録があります</strong><span>{fmt(legacy.bc)}BC・{fmt(legacy.kills)}キル。旧ミッションスターベイビーは別項目のため引き継ぎません。</span></div><Button onClick={()=>{submit({kind:'importLegacy',legacy});setLegacy(null);}}>記録を引き継ぐ</Button></div>}
    {stream&&<SettingsEditor current={settings} counts={count} onSave={next=>submit({kind:'configure',settings:next})}/>}
    <div className="workgrid"><div className="left-column">
      <section className="card"><div className="card-heading"><span className="section-number">01</span><div><h2>キルを記録</h2><p>ランク倍率を適用し、換算キルを消化</p></div></div><div className="kill-form"><label>キル数<Input aria-label="キル数" type="number" min="1" step="1" value={killQty} onChange={e=>setKillQty(e.target.value)}/></label><label>ランク<select aria-label="ランク" value={killRank} onChange={e=>setKillRank(e.target.value)}>{settings.ranks.map((r,i)=><option key={i} value={r.factor}>{r.name} ×{r.factor}</option>)}</select></label><Button onClick={()=>submit({kind:'kill',quantity:asInt(killQty),rank:Number(killRank),direction:1})}>＋ 加算</Button><Button variant="outline" onClick={()=>submit({kind:'kill',quantity:asInt(killQty),rank:Number(killRank),direction:-1})}>− 取り消し</Button></div>
        <details className="party"><summary>{teamSize}人分をまとめて計算・加算</summary><p>各プレイヤーの換算キルは小数点以下を切り捨てます。</p><div className="party-list">{party.slice(0,teamSize).map((p,i)=><div className="party-row" key={i}><span>{i+1}人目</span><select aria-label={`${i+1}人目のランク`} value={p.rank} onChange={e=>setPlayer(i,'rank',e.target.value)}>{settings.ranks.map((r,j)=><option key={j} value={r.factor}>{r.name} ×{r.factor}</option>)}</select><Input aria-label={`${i+1}人目のキル数`} type="number" min="0" step="1" value={p.quantity} onChange={e=>setPlayer(i,'quantity',e.target.value)}/><strong>{Number.isFinite(asInt(p.quantity))?Math.floor(Math.max(0,asInt(p.quantity))*Number(p.rank)):0}換算</strong></div>)}</div><Button onClick={()=>submit({kind:'party',players:party.slice(0,teamSize).map(p=>({quantity:asInt(p.quantity),rank:Number(p.rank)}))})}>{teamSize}人分を消化に加算</Button></details>
      </section>
      <section className="card"><div className="card-heading"><span className="section-number">02</span><div><h2>ギフトを記録</h2><p>ポイントと、設定した連動パネルを同時に加算</p></div></div><div className="gift-list">{(['small','medium','large'] as const).map(key=>{const gift=settings.gifts[key];return <div className="gift-row" key={key}><div className="gift-name"><span className="gift-size">{key==='small'?'小':key==='medium'?'中':'大'}</span><span>{gift.name}<small>{fmt(gift.points)} {settings.pointLabel} / 個</small></span></div><Input aria-label={`${gift.name}の個数`} type="number" min="1" step="1" value={giftQty[key]} onChange={e=>setGiftQty(old=>({...old,[key]:e.target.value}))}/><Button variant="secondary" onClick={()=>submit({kind:'gift',gift:key,quantity:asInt(giftQty[key])})}>加算</Button></div>;})}</div><div className="other-gift"><h3>その他（ポイントのみ）</h3><div className="other-inputs"><label>1個の{settings.pointLabel}<Input type="number" min="1" step="1" placeholder="例：500" value={otherBC} onChange={e=>setOtherBC(e.target.value)}/></label><label>個数<Input type="number" min="1" step="1" value={otherQty} onChange={e=>setOtherQty(e.target.value)}/></label><Button variant="secondary" onClick={()=>submit({kind:'other',quantity:asInt(otherQty),unitBC:asInt(otherBC)})}>加算</Button></div></div></section>
      <section className="card obs-card"><div className="card-heading"><span className="section-number">04</span><div><h2>OBS表示</h2><p>ゲーム別のブラウザソース</p></div></div><div className="obs-actions"><select aria-label="OBS表示の種類" value={view} onChange={e=>setView(e.target.value as 'gauge'|'panels')}><option value="gauge">キルゲージ 900×170</option><option value="panels">パネル 540×780</option></select><Button variant="secondary" disabled={!overlayToken} onClick={copyOverlay}>URLをコピー</Button>{overlayHref&&<a href={overlayHref} target="_blank" rel="noreferrer">表示を確認</a>}<Button variant="outline" disabled={!overlayToken} onClick={renewOverlay}>URLを再発行</Button></div><p className="hint">コピーしたURLをOBSのブラウザソースに設定してください。URLを知る人は表示を見られます。パネルは画像の上に重ね、達成した領域が透明になります。</p></section>
    </div><section className="card panels-card"><div className="card-heading"><span className="section-number">03</span><div><h2>パネルチャレンジ</h2><p>名前と目標は上の「チャレンジ設定」で変更できます</p></div></div><div className="all-progress">全達成 <strong>{settings.panels.filter((p,i)=>count.panels[i]>=p.goal).length} / {settings.panels.length}</strong> {allComplete(count,settings)?'達成':''}</div><div className="panel-list">{settings.panels.map((p,i)=><div className="panel-item" key={p.id}><div className="panel-top"><span>{p.name}</span><strong>{fmt(count.panels[i]||0)} <small>/ {fmt(p.goal)}{p.unit}</small></strong></div><div className="progress"><span style={{width:`${Math.min(100,(count.panels[i]||0)/p.goal*100)}%`}}/></div><div className="panel-actions"><Input aria-label={`${p.name}の個数`} type="number" min="1" step="1" value={panelQty[i]??'1'} onChange={e=>setPanel(i,e.target.value)}/><Button onClick={()=>submit({kind:'panel',panelId:p.id,quantity:asInt(panelQty[i]??'1'),direction:1})}>＋ 加算</Button><Button variant="outline" onClick={()=>submit({kind:'panel',panelId:p.id,quantity:asInt(panelQty[i]??'1'),direction:-1})}>− 取り消し</Button></div></div>)}</div><div className="reset-actions"><Button variant="outline" onClick={()=>{if(confirm('このゲームのパネルを0にしますか？ あとから元に戻せます。'))submit({kind:'resetPanels'});}}>パネルだけリセット</Button><Button variant="outline" onClick={()=>{if(confirm('このゲームのポイント・キル・パネルをすべて0にしますか？ あとから元に戻せます。'))submit({kind:'resetAll'});}}>このゲームの記録をリセット</Button></div></section></div>
    <p className="footer-status" role="status" aria-live="polite">{status}{queueCount>0&&<><Button variant="outline" onClick={()=>void sync()}>未送信を再試行</Button><Button variant="outline" onClick={()=>{if(confirm(`${queueCount}件の未送信操作を取り消しますか？`)){saveQueue([]);void sync();}}}>未送信を破棄</Button></>} · {stream?.lastAction??'記録なし'}</p>
  </main>;
}
