import {headers} from 'next/headers';
import {getAccount} from '../lib/accounts';
import AuthScreen from './auth-screen';
import Control from './control';
import type {Game} from '../lib/stream';

export const dynamic='force-dynamic';
export default async function Home({searchParams}:{searchParams:Promise<{game?:string}>}){
  const params=await searchParams;
  const game:Game=params.game==='apex'?'apex':'valorant';
  try{
    const account=await getAccount((await headers()).get('cookie'));
    if(!account)return <AuthScreen/>;
    return <Control key={`${account.id}:${game}`} userId={account.id} username={account.username} game={game}/>;
  }catch(e){
    console.error(e);
    return <main className="signin-page"><div className="signin-card"><h1>読み込めませんでした</h1><p>少し待ってページを再読み込みしてください。</p></div></main>;
  }
}
