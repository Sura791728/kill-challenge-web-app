export type Game = 'valorant'|'apex';
export type Panel = {id:string;name:string;goal:number;unit:string};
export type Gift = {name:string;points:number;panelId:string|null};
export type Rank = {name:string;factor:number};
export type Settings = {game:Game;pointLabel:string;pointsPerKill:number;panels:Panel[];gifts:{small:Gift;medium:Gift;large:Gift};ranks:Rank[]};
export type Counts = {bc:number;kills:number;converted:number;panels:number[]};
export type Change = Counts;
export type Record = {id:string;label:string;delta:Change;at:number};
export type Stream = {settings:Settings;counts:Counts;undo:Record[];redo:Record[];seen:string[];lastAction:string};
export type Action = {id:string;kind:'gift'|'other'|'kill'|'party'|'panel'|'undo'|'redo'|'resetPanels'|'resetAll'|'importLegacy'|'configure';quantity?:number;gift?:'small'|'medium'|'large';unitBC?:number;panel?:number;panelId?:string;direction?:1|-1;rank?:number;players?:{quantity:number;rank:number}[];legacy?:{bc:number;kills:number;panels:number[]};settings?:Settings};

const legacyPanels:Panel[]=[
  ['フルエール',100,'個'],['ゲーム好きな人',50,'人'],['スコアロック',1,'回'],
  ['ランダムスターベイビー（小）',500,'個'],['ランダムスターベイビー（中）',150,'個'],['ランダムスターベイビー（大）',1,'個'],
  ['プチスターベイビー',500,'個'],['無料ギフト',100,'個']
].map(([name,goal,unit],i)=>({id:`legacy-${i}`,name:String(name),goal:Number(goal),unit:String(unit)}));
const valorantRanks:Rank[]=['アイアン','ブロンズ','シルバー','ゴールド','プラチナ','ダイヤ以上'].map(name=>({name,factor:1}));
const apexRanks:Rank[]=['ルーキー','ブロンズ','シルバー','ゴールド','プラチナ','ダイヤモンド','マスター','Apexプレデター'].map(name=>({name,factor:1}));
export function defaultSettings(game:Game):Settings {
  return {
    game,pointLabel:'BC',pointsPerKill:500,
    panels:Array.from({length:6},(_,i)=>({id:`starter-${i}`,name:`パネル${i+1}`,goal:1,unit:'回'})),
    gifts:{small:{name:'ランダムスターベイビー（小）',points:170,panelId:null},medium:{name:'ランダムスターベイビー（中）',points:3000,panelId:null},large:{name:'ランダムスターベイビー（大）',points:25000,panelId:null}},
    ranks:game==='apex'?apexRanks:valorantRanks
  };
}
function legacySettings():Settings {
  return {game:'valorant',pointLabel:'BC',pointsPerKill:500,panels:legacyPanels,
    gifts:{small:{name:'ランダムスターベイビー（小）',points:170,panelId:'legacy-3'},medium:{name:'ランダムスターベイビー（中）',points:3000,panelId:'legacy-4'},large:{name:'ランダムスターベイビー（大）',points:25000,panelId:'legacy-5'}},
    ranks:[2,1.5,1,.5,.3,.2].map((factor,i)=>({...valorantRanks[i],factor}))};
}
export const zero=(length=8):Counts=>({bc:0,kills:0,converted:0,panels:Array(length).fill(0)});
export const fresh=(game:Game='valorant'):Stream=>{const settings=defaultSettings(game);return {settings,counts:zero(settings.panels.length),undo:[],redo:[],seen:[],lastAction:'操作待ち'};};
export function normalizeStream(raw:Stream,game:Game):Stream {
  if(raw.settings)return raw;
  // Rows created by the original owner-only version use the original eight-panel layout.
  const settings=game==='valorant'?legacySettings():defaultSettings(game);
  return {...raw,settings,counts:{...raw.counts,panels:Array.from({length:settings.panels.length},(_,i)=>raw.counts.panels[i]||0)}};
}
export const quota=(c:Counts,s:Settings)=>Math.floor(c.bc/s.pointsPerKill);
export const remaining=(c:Counts,s:Settings)=>Math.max(0,quota(c,s)-c.converted);
export const allComplete=(c:Counts,s:Settings)=>s.panels.length>0&&s.panels.every((p,i)=>c.panels[i]>=p.goal);
const valid=(n:unknown)=>Number.isSafeInteger(n)&&(n as number)>=1&&(n as number)<=1000000;
const delta=(length:number):Change=>zero(length);
const fmt=(n:number)=>n.toLocaleString('ja-JP');
function apply(c:Counts,d:Change,sign=1):Counts {
  const next={bc:c.bc+d.bc*sign,kills:c.kills+d.kills*sign,converted:c.converted+d.converted*sign,panels:c.panels.map((n,i)=>n+(d.panels[i]||0)*sign)};
  if([next.bc,next.kills,next.converted,...next.panels].some(n=>!Number.isSafeInteger(n)||n<0))throw Error('取り消す数が現在の記録を超えています');
  return next;
}
export function validateSettings(s:Settings):Settings {
  const words=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max;
  if(!s||!['valorant','apex'].includes(s.game)||!words(s.pointLabel,12)||!Number.isSafeInteger(s.pointsPerKill)||s.pointsPerKill<1||s.pointsPerKill>1000000000)throw Error('ポイント設定を確認してください');
  if(!Array.isArray(s.panels)||s.panels.length<1||s.panels.length>16)throw Error('パネルは1～16枚にしてください');
  const ids=new Set<string>();
  for(const p of s.panels){
    if(!p||typeof p.id!=='string'||!/^[A-Za-z0-9_-]{1,50}$/.test(p.id)||ids.has(p.id)||!words(p.name,32)||!words(p.unit,8)||!Number.isSafeInteger(p.goal)||p.goal<1||p.goal>1000000000)throw Error('パネル名・目標・単位を確認してください');
    ids.add(p.id);
  }
  if(!s.gifts||!(['small','medium','large'] as const).every(key=>{const g=s.gifts[key];return g&&words(g.name,24)&&Number.isSafeInteger(g.points)&&g.points>=0&&g.points<=1000000000&&(g.panelId===null||ids.has(g.panelId));}))throw Error('ギフト名・ポイント・連動パネルを確認してください');
  if(!Array.isArray(s.ranks)||s.ranks.length<1||s.ranks.length>12||s.ranks.some(r=>!r||!words(r.name,24)||!Number.isFinite(r.factor)||r.factor<0||r.factor>10))throw Error('ランク倍率を確認してください');
  return s;
}
export function reduce(input:Stream,a:Action):Stream {
  if(typeof a?.id!=='string'||!a.id||a.id.length>100)throw Error('操作IDが正しくありません');
  const s=normalizeStream(input,input.settings?.game||'valorant');
  if(s.seen.includes(a.id))return s;
  const out:Stream=structuredClone(s),settings=out.settings;
  const finish=(label:string)=>{out.seen.push(a.id);out.seen=out.seen.slice(-5000);out.lastAction=label;return out;};
  if(a.kind==='configure'){
    const next=validateSettings(a.settings!);
    if(next.game!==settings.game)throw Error('ゲームの設定は別々に保存してください');
    const sameLayout=next.panels.length===settings.panels.length&&next.panels.every((p,i)=>p.id===settings.panels[i].id);
    out.counts.panels=next.panels.map(p=>{const i=settings.panels.findIndex(old=>old.id===p.id);return i<0?0:out.counts.panels[i];});
    out.settings=structuredClone(next);
    if(!sameLayout){out.undo=[];out.redo=[];}
    return finish('設定を保存しました');
  }
  if(a.kind==='undo'||a.kind==='redo'){
    const source=a.kind==='undo'?out.undo:out.redo,target=a.kind==='undo'?out.redo:out.undo;
    const record=source.pop();if(!record)throw Error('戻せる操作がありません');
    out.counts=apply(out.counts,record.delta,a.kind==='undo'?-1:1);
    target.push(record);return finish(a.kind==='undo'?`「${record.label}」を戻しました`:`「${record.label}」をやり直しました`);
  }
  let d=delta(settings.panels.length),label='';
  const verb=(q:number)=>`${fmt(q)}${a.direction===-1?'取り消し':'加算'}`;
  if(a.kind==='gift'){
    const g=a.gift&&settings.gifts[a.gift];if(!g||!valid(a.quantity))throw Error('ギフトと個数を確認してください');
    d.bc=g.points*a.quantity!;
    const i=settings.panels.findIndex(p=>p.id===g.panelId);if(i>=0)d.panels[i]=a.quantity!;
    label=`${g.name} ${fmt(a.quantity!)}個を加算`;
  }else if(a.kind==='other'){
    if(!valid(a.quantity)||!valid(a.unitBC))throw Error('ポイントと個数を確認してください');
    d.bc=a.quantity!*a.unitBC!;label=`その他 ${fmt(a.quantity!)}個・${fmt(d.bc)}${settings.pointLabel}を加算`;
  }else if(a.kind==='kill'){
    if(!valid(a.quantity)||!settings.ranks.some(r=>r.factor===a.rank)||![1,-1].includes(a.direction!))throw Error('キル数と倍率を確認してください');
    d.kills=a.quantity!*a.direction!;d.converted=Math.floor(a.quantity!*a.rank!)*a.direction!;
    label=`キル ${verb(a.quantity!)}（換算 ${fmt(Math.abs(d.converted))}）`;
  }else if(a.kind==='party'){
    const size=settings.game==='apex'?3:5;
    if(!Array.isArray(a.players)||a.players.length!==size||a.players.some(p=>!Number.isSafeInteger(p.quantity)||p.quantity<0||p.quantity>1000000||!settings.ranks.some(r=>r.factor===p.rank)))throw Error(`${size}人分の入力を確認してください`);
    d.kills=a.players.reduce((n,p)=>n+p.quantity,0);d.converted=a.players.reduce((n,p)=>n+Math.floor(p.quantity*p.rank),0);
    if(!d.kills)throw Error('キル数を入力してください');label=`${size}人分 ${fmt(d.kills)}キル（換算 ${fmt(d.converted)}）を加算`;
  }else if(a.kind==='panel'){
    const i=typeof a.panelId==='string'?settings.panels.findIndex(p=>p.id===a.panelId):a.panel;
    if(!Number.isInteger(i)||i!<0||i!>=settings.panels.length||!valid(a.quantity)||![1,-1].includes(a.direction!))throw Error('パネルと個数を確認してください');
    d.panels[i!]=a.quantity!*a.direction!;label=`${settings.panels[i!].name} ${verb(a.quantity!)}`;
  }else if(a.kind==='importLegacy'){
    const old=a.legacy;
    if(settings.game!=='valorant'||[out.counts.bc,out.counts.kills,out.counts.converted,...out.counts.panels].some(Boolean)||out.undo.length)throw Error('既に記録があるため引き継げません');
    if(!old||!Array.isArray(old.panels)||old.panels.length!==5||![old.bc,old.kills,...old.panels].every(n=>Number.isSafeInteger(n)&&n>=0))throw Error('旧版の記録を確認してください');
    d.bc=old.bc;d.kills=old.kills;d.converted=old.kills;
    for(const [oldIndex,id] of [[0,'legacy-0'],[1,'legacy-1'],[2,'legacy-3'],[3,'legacy-4']] as const){const i=settings.panels.findIndex(p=>p.id===id);if(i>=0)d.panels[i]=old.panels[oldIndex];}
    label='旧版の記録を引き継ぎ';
  }else if(a.kind==='resetPanels'){
    d.panels=out.counts.panels.map(n=>-n);label='パネル記録をリセット';
  }else if(a.kind==='resetAll'){
    d={bc:-out.counts.bc,kills:-out.counts.kills,converted:-out.counts.converted,panels:out.counts.panels.map(n=>-n)};label='全記録をリセット';
  }else throw Error('不明な操作です');
  if(![d.bc,d.kills,d.converted,...d.panels].some(Boolean))return s;
  out.counts=apply(out.counts,d);
  out.undo.push({id:a.id,label,delta:d,at:Date.now()});out.undo=out.undo.slice(-50);out.redo=[];
  return finish(label);
}
