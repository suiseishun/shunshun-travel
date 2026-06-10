# Shunshun Travel — Supabase + GitHub Pages 版

旅行記録サイトを **完全無料** で公開するためのセットアップ手順です。

```
┌──────────────────────┐         ┌──────────────────────┐
│  GitHub Pages        │ ─────▶  │  Supabase            │
│  (HTML/CSS/JS の配信) │         │  ├ Postgres (DB)     │
│  完全無料・無期限      │         │  ├ Storage (写真)    │
└──────────────────────┘         │  └ Auth (ログイン)    │
                                 │  無料プラン           │
                                 └──────────────────────┘
```

| サービス | 用途 | 無料枠 |
|---|---|---|
| GitHub Pages | 静的ホスティング | 無制限 |
| Supabase Postgres | データベース | 500 MB |
| Supabase Storage | 画像保存 | 1 GB(WebP圧縮で5,000枚以上) |
| Supabase Auth | 管理者ログイン | 5万 MAU |

---

## ファイル構成

```
.
├── Shunshun Travel.html   # メインページ
├── region.html            # 地域別ページ
├── app.js                 # メインページのロジック (Supabase版)
├── region.js              # 地域別ページのロジック (Supabase版)
├── supabase-client.js     # Supabase 設定 & API ラッパー  ← URLとKEYを書き換え
├── auth.js                # ログインモーダル
├── styles.css             # 既存のスタイル(変更不要)
├── auth-overrides.css     # ログインUI用の追加スタイル
└── README.md
```
---

## 使い方

- **閲覧**: ログイン不要。誰でも見られる
- **追加・編集・削除**: ヘッダ右上の **ログイン** から自分のメール/パスワードで入る → 「場所を追加」が出てくる

## 既存データの移行(任意)

ローカルで作ったデータを持ち込みたい場合は、ブラウザの DevTools コンソールで:

```js
JSON.parse(localStorage.getItem('shunshun.places.v3'))
```

をコピーし、SQL Editor で1件ずつ INSERT する(写真はIndexedDB内なのでアップロードし直しが必要)。手間が多いので、新しい環境で記録し直すのが楽です。

## トラブルシューティング

| 症状 | 原因 / 対処 |
|---|---|
| `Failed to fetch` / CORS エラー | `SUPABASE_URL` のtypo、または Site URL未登録 |
| ログインしても「場所を追加」が出ない | ブラウザのキャッシュ。Ctrl+Shift+R でハードリロード |
| 写真がアップできない | Storage バケット名 `place-photos`、Public ON、Policies 設定を確認 |
| 7日後アクセスしたら遅い | Supabase無料プロジェクトの一時停止。ダッシュボードで Resume |
| 1GB に近づいてきた | `compressImage()` の `maxDim` を 1200 に下げるか、古い写真を整理 |
