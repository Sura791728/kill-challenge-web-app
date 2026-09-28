import {env} from 'cloudflare:workers';
import {accountByUsername,accountFromRequest,body,clearSession,forgetSession,issueSession,json,limit,limitKey,sameOrigin} from '../../../lib/accounts';
import {equalHex,normalizeRecoveryCode,passwordHash,randomHex,recoveryCode,sha256,usernameOf,validPassword} from '../../../lib/passwords';

export const dynamic='force-dynamic';

export async function GET(request:Request){
  try{return json({account:await accountFromRequest(request)});}
  catch(e){console.error(e);return json({error:'アカウントを確認できません'},503);}
}

export async function POST(request:Request){
  if(!sameOrigin(request))return json({error:'ページを再読み込みしてください'},403);
  const data=await body(request);
  if(!data)return json({error:'入力を確認してください'},400);
  if(data.kind==='logout'){
    try{await forgetSession(request.headers.get('Cookie'));return json({ok:true},200,clearSession());}
    catch(e){console.error(e);return json({error:'ログアウトできません'},503);}
  }
  const username=usernameOf(data.username);
  if(!username)return json({error:'ユーザー名は英数字と _ を使い、3〜24文字にしてください'},400);
  if(!validPassword(data.password))return json({error:'パスワードは12〜128文字で入力してください'},400);
  try{
    if(data.kind==='register'){
      if(!await limit(request,'register',5,24*60*60*1000))return json({error:'登録回数の上限です。時間をおいてお試しください'},429);
      const id=randomHex(16),salt=randomHex(16),code=recoveryCode();
      const hash=await passwordHash(data.password,salt);
      try{await env.DB!.prepare('INSERT INTO accounts (id, username, password_salt, password_hash, recovery_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(id,username,salt,hash,await sha256(code.replaceAll('-','')),Date.now()).run();}
      catch(e){if(String(e).includes('UNIQUE'))return json({error:'そのユーザー名は使われています'},409);throw e;}
      return json({account:{id,username},recoveryCode:code},201,await issueSession(id));
    }
    if(data.kind!=='login'&&data.kind!=='recover')return json({error:'操作を確認してください'},400);
    const allowedIp=await limit(request,'access',20,15*60*1000);
    const allowedName=await limitKey(`account:${username}`,10,15*60*1000);
    if(!allowedIp||!allowedName)return json({error:'試行回数が多いため、15分後にお試しください'},429);
    const account=await accountByUsername(username);
    if(data.kind==='login'){
      const hash=await passwordHash(data.password,account?.password_salt??'00000000000000000000000000000000');
      if(!account||!equalHex(hash,account.password_hash))return json({error:'ユーザー名かパスワードが違います'},401);
      return json({account:{id:account.id,username}},200,await issueSession(account.id));
    }
    const code=normalizeRecoveryCode(data.recoveryCode);
    const recoveryHash=code?await sha256(code):'';
    if(!account||!equalHex(recoveryHash,account.recovery_hash))return json({error:'ユーザー名か復旧コードが違います'},401);
    const newCode=recoveryCode(),salt=randomHex(16);
    const updated=await env.DB!.prepare('UPDATE accounts SET password_salt = ?, password_hash = ?, recovery_hash = ? WHERE id = ? AND recovery_hash = ?')
      .bind(salt,await passwordHash(data.password,salt),await sha256(newCode.replaceAll('-','')),account.id,account.recovery_hash).run();
    if(updated.meta.changes!==1)return json({error:'復旧コードをもう一度確認してください'},409);
    await env.DB!.prepare('DELETE FROM sessions WHERE account_id = ?').bind(account.id).run();
    return json({account:{id:account.id,username},recoveryCode:newCode},200,await issueSession(account.id));
  }catch(e){console.error(e);return json({error:'処理できませんでした。少し待って再試行してください'},503);}
}
