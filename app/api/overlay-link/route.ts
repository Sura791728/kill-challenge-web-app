import { env } from 'cloudflare:workers';
import {ensureOverlayToken,streamKey} from '../../../lib/overlay-link';
import type {Game} from '../../../lib/stream';
import {accountFromRequest,sameOrigin} from '../../../lib/accounts';

export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function selection(request:Request){const game=new URL(request.url).searchParams.get('game');return game==='valorant'||game==='apex'?game as Game:null;}
async function handle(request:Request,rotate:boolean){
  if(rotate&&!sameOrigin(request))return reply({error:'ページを再読み込みしてください'},403);
  const game=selection(request);if(!game)return reply({error:'ゲームを確認してください'},400);
  try{
    const account=await accountFromRequest(request);if(!account)return reply({error:'ログインしてください'},401);
    const key=streamKey(`acct:${account.id}`,game);
    if(rotate){
      await ensureOverlayToken(key);
      await env.DB!.prepare('UPDATE overlay_links SET token = ? WHERE stream_key = ?').bind(crypto.randomUUID(),key).run();
    }
    return reply({token:await ensureOverlayToken(key)});
  }catch(e){console.error(e);return reply({error:'OBS表示URLを用意できません。再試行してください'},503);}
}
export async function GET(request:Request){return handle(request,false);}
export async function POST(request:Request){return handle(request,true);}
