import { env } from 'cloudflare:workers';
import type { Game } from './stream';

export function streamKey(userId:string,game:Game){return game==='valorant'?userId:`${userId}::apex`;}

export async function ensureOverlayToken(key:string){
  await env.DB!.prepare('INSERT OR IGNORE INTO overlay_links (stream_key,token) VALUES (?,?)').bind(key,crypto.randomUUID()).run();
  const row=await env.DB!.prepare('SELECT token FROM overlay_links WHERE stream_key = ?').bind(key).first<{token:string}>();
  if(!row)throw Error('OBS表示URLを作成できません');
  return row.token;
}

export async function streamKeyForToken(token:string){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token))return null;
  const row=await env.DB!.prepare('SELECT stream_key FROM overlay_links WHERE token = ?').bind(token).first<{stream_key:string}>();
  return row?.stream_key??null;
}
