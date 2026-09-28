'use client';
import {useState,type FormEvent} from 'react';

type Mode='login'|'register'|'recover';
export default function AuthScreen(){
  const [mode,setMode]=useState<Mode>('login');
  const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[code,setCode]=useState('');
  const [newCode,setNewCode]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false);
  const switchMode=(next:Mode)=>{setMode(next);setError('');setPassword('');setCode('');};
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError('');setBusy(true);
    try{
      const response=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:mode,username,password,recoveryCode:code})});
      const data=await response.json() as {error?:string;recoveryCode?:string};
      if(!response.ok)throw Error(data.error||'もう一度お試しください');
      if(data.recoveryCode){setNewCode(data.recoveryCode);setPassword('');}
      else location.reload();
    }catch(e){setError(e instanceof Error?e.message:'接続を確認してください');}
    finally{setBusy(false);}
  }
  return <main className="signin-page"><section className="signin-card">
    <span className="eyebrow">STREAM CONTROL</span><h1>キルチャレ管理</h1>
    {newCode?<div className="recovery-result"><h2>復旧コードを保存してください</h2><p>パスワードを忘れたときに使います。今だけ表示され、再発行後は以前のコードが無効になります。</p><code>{newCode}</code><button type="button" className="signin-button" onClick={async()=>{try{await navigator.clipboard.writeText(newCode);setCopied(true);}catch{setError('コピーできませんでした。コードを手動で保存してください');}}}>{copied?'コピーしました':'コードをコピー'}</button>{error&&<p className="auth-error" role="alert">{error}</p>}<button type="button" className="signin-secondary" onClick={()=>location.assign('/')}>保存したので管理画面へ</button></div>:
    <><div className="auth-tabs" role="group" aria-label="アカウントの操作"><button type="button" aria-pressed={mode==='login'} onClick={()=>switchMode('login')}>ログイン</button><button type="button" aria-pressed={mode==='register'} onClick={()=>switchMode('register')}>新規登録</button></div>
      <p>{mode==='register'?'無料で登録して、スマホとPCで同じ記録を使えます。':mode==='recover'?'保存した復旧コードで新しいパスワードを設定します。':'登録したユーザー名とパスワードで続けます。'}</p>
      <form onSubmit={submit} className="auth-form">
        <label>ユーザー名<input name="username" value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" pattern="[A-Za-z0-9_]{3,24}" maxLength={24} required placeholder="英数字と _ で3〜24文字"/></label>
        {mode==='recover'&&<label>復旧コード<input name="recoveryCode" value={code} onChange={e=>setCode(e.target.value)} autoComplete="off" required placeholder="保存したコードを入力"/></label>}
        <label>{mode==='recover'?'新しいパスワード':'パスワード'}<input name="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='login'?'current-password':'new-password'} minLength={mode==='login'?undefined:12} maxLength={128} required placeholder={mode==='login'?'パスワード':'12文字以上'}/></label>
        <button className="signin-button" type="submit" disabled={busy}>{busy?'処理中…':mode==='login'?'ログイン':mode==='register'?'アカウントを作成':'パスワードを再設定'}</button>
      </form>
      {error&&<p className="auth-error" role="alert">{error}</p>}
      <button type="button" className="signin-secondary" onClick={()=>switchMode(mode==='recover'?'login':'recover')}>{mode==='recover'?'ログインに戻る':'パスワードを忘れた場合'}</button>
      <small>記録と設定はアカウントごとに保存します。復旧コードは登録時に控えてください。</small>
    </>}
  </section></main>;
}
