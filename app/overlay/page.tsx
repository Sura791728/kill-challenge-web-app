import Overlay from './control';
import type {Game} from '../../lib/stream';

export const dynamic='force-dynamic';
export default async function OverlayPage({searchParams}:{searchParams:Promise<{game?:string;view?:string;token?:string}>}){
  const params=await searchParams;
  const game:Game=params.game==='apex'?'apex':'valorant';
  const view=params.view==='panels'?'panels':'gauge';
  const token=typeof params.token==='string'?params.token:'';
  if(!token)return <main className="overlay-signin"><p>管理画面からOBS表示URLをコピーしてください。</p><a href="/">管理画面を開く</a></main>;
  return <Overlay game={game} view={view} token={token}/>;
}
