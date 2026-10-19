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

## セットアップ手順

### 1. Supabase プロジェクト作成

1. <https://supabase.com> で Sign up(GitHubアカウントでOK、クレジットカード不要)
2. **New project** を作成
   - Name: `shunshun-travel`(なんでも)
   - Database Password: 適当に生成して**控える**
   - Region: `Northeast Asia (Tokyo)` を推奨
3. 作成完了まで1〜2分待つ

### 2. データベーステーブルを作成

左メニュー **SQL Editor** で以下を全部貼り付けて Run:

```sql
-- =========================================
--  places テーブル (場所メタデータ)
-- =========================================
create table places (
  id          text primary key,
  name        text not null,
  area        text not null,           -- '国内' | '海外'
  region      text not null,
  cat         text not null,           -- '観光' | '食事' | '宿'
  date        text,                    -- 'YYYY-MM'
  rating      int,
  comment     text,
  map         text,
  site        text,
  lat         double precision,
  lng         double precision,
  photos      text[] default '{}',     -- Storage の public URL 配列
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- updated_at 自動更新
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
create trigger places_updated before update on places
  for each row execute function set_updated_at();

-- =========================================
--  profile テーブル (アバター等のkey-value)
-- =========================================
create table profile (
  key   text primary key,
  value text
);

-- =========================================
--  Row Level Security: 閲覧は誰でも、書込は認証済のみ
-- =========================================
alter table places  enable row level security;
alter table profile enable row level security;

create policy "places: public read"    on places  for select using (true);
create policy "places: auth insert"    on places  for insert with check (auth.role() = 'authenticated');
create policy "places: auth update"    on places  for update using (auth.role() = 'authenticated');
create policy "places: auth delete"    on places  for delete using (auth.role() = 'authenticated');

create policy "profile: public read"   on profile for select using (true);
create policy "profile: auth write"    on profile for all    using (auth.role() = 'authenticated')
                                                  with check (auth.role() = 'authenticated');
```

### 3. Storage バケットを作成

左メニュー **Storage** → **New bucket**

- Name: `place-photos`
- Public bucket: **ON**(画像を公開URLで配信するため)
- Create

続けて Storage の **Policies** タブで、`place-photos` バケットに以下を追加:

```sql
-- 全員が画像を読める(SELECT)
create policy "photos: public read"
  on storage.objects for select using (bucket_id = 'place-photos');

-- 認証ユーザーは画像のアップロード/上書き/削除ができる
create policy "photos: auth write"
  on storage.objects for insert with check (bucket_id = 'place-photos' and auth.role() = 'authenticated');
create policy "photos: auth update"
  on storage.objects for update using (bucket_id = 'place-photos' and auth.role() = 'authenticated');
create policy "photos: auth delete"
  on storage.objects for delete using (bucket_id = 'place-photos' and auth.role() = 'authenticated');
```

### 4. 管理者ユーザーを作成

左メニュー **Authentication → Users → Add user → Create new user**

- Email: 自分のアドレス
- Password: 任意
- **Auto Confirm User: ON**(チェックを入れる。メール確認をスキップ)
- Create user

このメール/パスワードでサイトのログイン画面から入ります。

### 5. URL と anon key を取得

左メニュー **Project Settings → API**

- **Project URL** → `https://xxxxxxx.supabase.co` をコピー
- **anon public** key → `eyJhbGciOi...` の長い文字列をコピー

(注意: `service_role` キーは絶対に公開しないこと。`anon` の方を使う)

### 6. `supabase-client.js` を編集

```js
const SUPABASE_URL      = 'https://xxxxxxx.supabase.co';   // 自分の値に
const SUPABASE_ANON_KEY = 'eyJhbGciOi...';                  // 自分の値に
```

### 7. ローカルで動作確認

ブラウザの ES module は `file://` では動かないので、簡易サーバーで開きます。

```bash
# Python があれば
python -m http.server 8080
# Node があれば
npx serve .
```

`http://localhost:8080/Shunshun%20Travel.html` を開く。

### 8. GitHub Pages にデプロイ

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

GitHub → リポジトリ → **Settings → Pages**
- Source: **Deploy from a branch**
- Branch: `main` / `(root)`
- Save

`https://USERNAME.github.io/REPO/Shunshun%20Travel.html` で公開されます。

### 9. Supabase に公開URLを許可

**Authentication → URL Configuration → Site URL** にGitHub PagesのURLを追加(ログインが正しく動くため)。

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
