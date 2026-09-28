'use client';
import {useEffect,useState} from 'react';
import {allComplete,fresh,quota,remaining,type Game,type Stream} from '@/lib/stream';

const shapes=[
  '0,0 200,0 202,25 225,220 0,315','200,0 540,0 540,170 202,25',
  '0,315 225,220 232,285 246,425 0,425','0,425 246,425 260,610 0,565',
  '246,425 540,370 540,565 260,610','232,285 540,285 540,370 246,425',
  '0,565 260,610 267,675 280,780 0,780','260,610 540,565 540,780 280,780 267,675'
];
const centers=[[105,146],[386,73],[110,358],[115,493],[393,489],[393,332],[126,676],[407,676]];
const allShape='202,25 540,170 540,285 232,285 225,220';
const fmt=(n:number)=>n.toLocaleString('ja-JP');
export default function Overlay({game,view,token}:{game:Game;view:'gauge'|'panels';token?:string}){
  const [stream,setStream]=useState<Stream|null>(null),[connected,setConnected]=useState(false);
  useEffect(()=>{
    document.body.classList.add('overlay-body');let alive=true;
    const refresh=async()=>{try{
      const response=await fetch(token?`/api/overlay-state?token=${encodeURIComponent(token)}`:`/api/state?game=${game}`,{cache:'no-store'});if(!response.ok)throw Error();
      const data=await response.json() as {stream:Stream};if(alive){setStream(data.stream);setConnected(true);}
    }catch{if(alive)setConnected(false);}};
    void refresh();const timer=setInterval(()=>void refresh(),2000);
    return()=>{alive=false;clearInterval(timer);document.body.classList.remove('overlay-body');};
  },[game,token]);
  const current=stream??fresh(game),s=current.settings,c=current.counts;
  const legacy=s.panels.length===8&&s.panels.every((p,i)=>p.id===`legacy-${i}`);
  if(view==='panels'&&legacy)return <div className="overlay-root panels-overlay" aria-label="パネルチャレンジ"><svg viewBox="0 0 540 780" role="img" aria-label="パネル"><defs><linearGradient id="panel-fill" x2="1" y2="1"><stop stopColor="#4b234c"/><stop offset="1" stopColor="#2b1b41"/></linearGradient></defs>{s.panels.map((p,i)=>c.panels[i]>=p.goal?null:<g key={p.id}><polygon points={shapes[i]} fill="url(#panel-fill)" stroke="#dc86b7" strokeWidth="2"/><text x={centers[i][0]} y={centers[i][1]-16} textAnchor="middle" className="overlay-panel-name">{p.name.length>11?<><tspan x={centers[i][0]} dy="-11">{p.name.slice(0,11)}</tspan><tspan x={centers[i][0]} dy="24">{p.name.slice(11,22)}</tspan></>:p.name}</text><text x={centers[i][0]} y={centers[i][1]+34} textAnchor="middle" className="overlay-panel-count">{fmt(c.panels[i])} / {fmt(p.goal)}</text></g>)}{allComplete(c,s)?null:<g><polygon points={allShape} fill="url(#panel-fill)" stroke="#dc86b7" strokeWidth="2"/><text x="389" y="223" textAnchor="middle" className="overlay-all">全達成</text></g>}</svg></div>;
  if(view==='panels'){
    const n=s.panels.length+1,columns=Math.ceil(Math.sqrt(n*540/780));
    return <div className="overlay-root panels-overlay panel-grid" style={{gridTemplateColumns:`repeat(${columns},1fr)`}} aria-label="パネルチャレンジ">{s.panels.map((p,i)=><div key={p.id} className={`panel-tile ${c.panels[i]>=p.goal?'opened':''}`}><span>{p.name}</span><strong>{fmt(c.panels[i])} / {fmt(p.goal)}{p.unit}</strong></div>)}<div className={`panel-tile all-tile ${allComplete(c,s)?'opened':''}`}><span>全達成</span><strong>{s.panels.filter((p,i)=>c.panels[i]>=p.goal).length} / {s.panels.length}</strong></div></div>;
  }
  return <div className="overlay-root gauge-overlay"><div className="gauge-head"><span>{game==='apex'?'APEX LEGENDS':'VALORANT'} KILL CHALLENGE</span><small>{connected?'LIVE':'接続待ち'}</small></div><div className="gauge-values"><span>消化キル <strong>{fmt(c.converted)}</strong> <em>/ {fmt(quota(c,s))}</em></span><span>残り <strong>{fmt(remaining(c,s))}</strong> キル</span></div><div className="gauge-track"><span style={{width:`${quota(c,s)?Math.min(100,c.converted/quota(c,s)*100):0}%`}}/></div></div>;
}
