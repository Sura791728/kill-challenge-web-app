import {env} from 'cloudflare:workers';
import {randomHex,sha256} from './passwords';

const COOKIE = '__Host-kc_session';
const SESSION_SECONDS = 60 * 60 * 24 * 30;

export type Account = {id:string;username:string};
export type StoredAccount = Account & {password_salt:string;password_hash:string;recovery_hash:string};

export function json(data:unknown,status=200,cookie?:string):Response {
  const headers = new Headers({'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'});
  if(cookie)headers.set('Set-Cookie',cookie);
  return new Response(JSON.stringify(data),{status,headers});
}

export function sameOrigin(request:Request):boolean {
  const origin=request.headers.get('Origin');
  return origin!==null && origin===new URL(request.url).origin;
}

export async function body(request:Request):Promise<Record<string,unknown>|null> {
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return null;
  if(Number(request.headers.get('Content-Length')||0)>4096)return null;
  try{
    const reader=request.body?.getReader();if(!reader)return null;
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;if(size>4096){await reader.cancel();return null;}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    const raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    const value:unknown=JSON.parse(raw);return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;}
  catch{return null;}
}

export async function getAccount(cookieHeader:string|null):Promise<Account|null> {
  const token=readToken(cookieHeader);
  if(!token)return null;
  const hash=await sha256(token);
  const row=await env.DB!.prepare('SELECT accounts.id, accounts.username FROM sessions JOIN accounts ON accounts.id = sessions.account_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?').bind(hash,Date.now()).first<Account>();
  return row??null;
}

export async function accountFromRequest(request:Request):Promise<Account|null> {
  return getAccount(request.headers.get('Cookie'));
}

export function readToken(cookieHeader:string|null):string|null {
  const found=cookieHeader?.split(';').map(part=>part.trim()).find(part=>part.startsWith(`${COOKIE}=`));
  const token=found?.slice(COOKIE.length+1);
  return token&&/^[0-9a-f]{64}$/.test(token)?token:null;
}

export async function issueSession(accountId:string):Promise<string> {
  const token=randomHex(32);
  await env.DB!.prepare('INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)').bind(await sha256(token),accountId,Date.now()+SESSION_SECONDS*1000).run();
  return `${COOKIE}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSession():string {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export async function forgetSession(cookieHeader:string|null):Promise<void> {
  const token=readToken(cookieHeader);
  if(token)await env.DB!.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
}

export async function accountByUsername(username:string):Promise<StoredAccount|null> {
  return await env.DB!.prepare('SELECT id, username, password_salt, password_hash, recovery_hash FROM accounts WHERE username = ?').bind(username).first<StoredAccount>()??null;
}

export async function limit(request:Request,scope:string,max:number,windowMs:number):Promise<boolean> {
  const ip=request.headers.get('CF-Connecting-IP');
  if(!ip)return limitKey(`${scope}:unidentified`,Math.max(100,max*50),Math.min(windowMs,60*60*1000));
  // Cloudflare masks the end-user IP on cross-zone Worker requests. Keep a
  // shared ceiling here; login and recovery also have a per-username limit.
  if(ip==='2a06:98c0:3600::103'&&request.headers.has('CF-Worker'))
    return limitKey(`${scope}:worker-aggregate`,scope==='register'?200:2000,windowMs);
  return limitKey(`${scope}:${ip}`,max,windowMs);
}

export async function limitKey(label:string,max:number,windowMs:number):Promise<boolean> {
  const key=await sha256(label);
  const now=Date.now();
  const row=await env.DB!.prepare(`INSERT INTO auth_limits (key, attempts, window_start) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN window_start < ? THEN 1 ELSE attempts + 1 END,
      window_start = CASE WHEN window_start < ? THEN ? ELSE window_start END RETURNING attempts`)
    .bind(key,now,now-windowMs,now-windowMs,now).first<{attempts:number}>();
  return !!row&&row.attempts<=max;
}
