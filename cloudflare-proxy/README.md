# CloudflareのURLで開く

このWorkerは既存のキルチャレ管理サイトへの入口です。アカウントと記録は現在のSites側に残るので、新しいURLで再度ログインすると同じデータを使えます。URLは `<worker名>.<Cloudflareアカウントのサブドメイン>.workers.dev` になります。既存サイトを停止すると、この入口も動作しません。

## 配置

1. Cloudflareの「Workers & Pages」でGitHubリポジトリ `Sura791728/kill-challenge-web-app` を接続します。
2. Worker名は `kill-challenge-web-app`、ルートディレクトリは `cloudflare-proxy`、デプロイコマンドは `npm run deploy` にします。
3. 新URLの登録・ログイン・集計・OBS表示を確認します。既存のOBS URLは新URLのものへ差し替えます。

URLを完全にSitesから独立させる場合は、アプリ本体とD1データベースの移行が別途必要です。

## 確認

```sh
node --experimental-strip-types --test test/proxy.test.mjs
```
