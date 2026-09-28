# キルチャレ管理

VALORANTとAPEXの配信向けキルチャレンジ管理アプリです。利用者ごと、ゲームごとに記録と設定を保存します。

## 主な機能

- キルとパネルの加算・取り消し、元に戻す・やり直す
- パネルの名前・目標数、ポイント換算、ギフト、ランク倍率の設定
- ランダムスターベイビー（小170 BC・中3,000 BC・大25,000 BC）の個数入力
- OBS用キルゲージ・パネル表示と表示URLの再発行
- VALORANTとAPEXそれぞれの記録

## 動作環境

このソースはChatGPT Sitesの認証とCloudflare D1を使用します。GitHub Pagesにそのまま配置してもログインや記録の保存は動きません。公開中のアプリ: https://valorant-kill-challenge-control.blue-sloth-0287.chatgpt.site

このリポジトリには利用者の記録、認証情報、稼働中サイトの管理IDを含めていません。自分用に配備する場合は新しいSitesプロジェクトとD1を用意してください。

## 検証

```sh
node --experimental-strip-types tests/stream.test.mjs
```

ソースコードの閲覧用公開です。ライセンスは指定していません。
