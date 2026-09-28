import { env } from 'cloudflare:workers';
import { fresh, normalizeStream, reduce, type Action, type Game, type Stream } from '../../../lib/stream';
import {streamKey} from '../../../lib/overlay-link';

export const dynamic = 'force-dynamic';
const headers = {'Cache-Control':'no-store'};
const identity = (request:Request) => request.headers.get('oai-authenticated-user-id');
function scope(request:Request,user:string){
  const selected=new URL(request.url).searchParams.get('game')||'valorant';
  if(selected!=='valorant'&&selected!=='apex')return null;
  const game=selected as Game;
  return {game,key:streamKey(user,game)};
}
async function load(key:string,game:Game){
  await env.DB!.prepare('INSERT OR IGNORE INTO streams (user_id,revision,payload) VALUES (?,0,?)').bind(key,JSON.stringify(fresh(game))).run();
  return env.DB!.prepare('SELECT revision,payload FROM streams WHERE user_id = ?').bind(key).first<{revision:number;payload:string}>();
}
function reply(data:unknown,status=200){return Response.json(data,{status,headers});}
export async function GET(request:Request){
  const user=identity(request);if(!user)return reply({error:'サインインが必要です'},401);
  const selected=scope(request,user);if(!selected)return reply({error:'ゲームを確認してください'},400);
  try{const row=await load(selected.key,selected.game);return reply({stream:normalizeStream(JSON.parse(row!.payload),selected.game),revision:row!.revision});}
  catch(e){console.error(e);return reply({error:'記録を読み込めません。少し待って再試行してください'},503);}
}
export async function POST(request:Request){
  const user=identity(request);if(!user)return reply({error:'サインインが必要です'},401);
  const selected=scope(request,user);if(!selected)return reply({error:'ゲームを確認してください'},400);
  let action:Action;try{action=await request.json() as Action;}catch{return reply({error:'入力を読み取れません'},400);}
  try{
    for(let attempt=0;attempt<8;attempt++){
      const row=await load(selected.key,selected.game);if(!row)throw Error('記録がありません');
      const stream=normalizeStream(JSON.parse(row.payload) as Stream,selected.game);
      let next:Stream;try{next=reduce(stream,action);}catch(e){return reply({error:e instanceof Error?e.message:'入力を確認してください'},400);}
      if(next===stream)return reply({stream,revision:row.revision});
      const result=await env.DB!.prepare('UPDATE streams SET payload = ?, revision = revision + 1 WHERE user_id = ? AND revision = ?').bind(JSON.stringify(next),selected.key,row.revision).run();
      if(result.meta.changes===1)return reply({stream:next,revision:row.revision+1});
    }
    return reply({error:'同時操作が重なりました。もう一度お試しください'},409);
  }catch(e){console.error(e);return reply({error:'記録を保存できません。もう一度お試しください'},503);}
}
