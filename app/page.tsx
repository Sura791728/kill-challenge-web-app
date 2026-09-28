import {chatGPTSignInPath,getChatGPTUser} from './chatgpt-auth';
import Control from './control';
import type {Game} from '../lib/stream';

export const dynamic='force-dynamic';
export default async function Home({searchParams}:{searchParams:Promise<{game?:string}>}){
  const params=await searchParams;
  const game:Game=params.game==='apex'?'apex':'valorant';
  const user=await getChatGPTUser();
  if(!user)return <main className="signin-page"><div className="signin-card"><span className="eyebrow">STREAM CONTROL</span><h1>キルチャレ管理</h1><p>VALORANTとAPEXのキル、ポイント、パネルを管理。パネルの内容や必要数は自分用に設定できます。</p><a className="signin-button" href={chatGPTSignInPath(`/?game=${game}`)} target="_top">ChatGPTでログインして使う</a><small>記録と設定はログインした利用者ごとに保存されます。</small></div></main>;
  return <Control key={`${user.userId}:${game}`} userId={user.userId} game={game}/>;
}
