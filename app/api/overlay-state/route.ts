import { env } from 'cloudflare:workers';
import {streamKeyForToken} from '../../../lib/overlay-link';
import {normalizeStream,type Stream} from '../../../lib/stream';

export const dynamic='force-dynamic';
export async function GET(request:Request){
  const token=new URL(request.url).searchParams.get('token')||'';
  try{
    const key=await streamKeyForToken(token);
    if(!key)return Response.json({error:'OBS表示URLが無効です'}, {status:404,headers:{'Cache-Control':'no-store'}});
    const row=await env.DB!.prepare('SELECT payload FROM streams WHERE user_id = ?').bind(key).first<{payload:string}>();
    if(!row)return Response.json({error:'記録がありません'}, {status:404,headers:{'Cache-Control':'no-store'}});
    const stream=JSON.parse(row.payload) as Stream;
    return Response.json({stream:normalizeStream(stream,stream.settings?.game??'valorant')},{headers:{'Cache-Control':'no-store'}});
  }catch(e){console.error(e);return Response.json({error:'記録を読み込めません'}, {status:503,headers:{'Cache-Control':'no-store'}});}
}
