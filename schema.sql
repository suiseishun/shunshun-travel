-- Shunshun Travel — Supabase 復旧用スキーマ
-- SQL Editor に全部貼り付けて Run すれば、テーブル・RLS・Storageポリシーが一括で作成されます。
-- (Storage バケット `place-photos` 自体は先に Storage 画面で作成してから実行してください)

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

-- =========================================
--  Storage: place-photos バケットのポリシー
--  (先に Storage 画面で bucket name = place-photos, Public ON で作成してから実行)
-- =========================================
create policy "photos: public read"
  on storage.objects for select using (bucket_id = 'place-photos');

create policy "photos: auth write"
  on storage.objects for insert with check (bucket_id = 'place-photos' and auth.role() = 'authenticated');
create policy "photos: auth update"
  on storage.objects for update using (bucket_id = 'place-photos' and auth.role() = 'authenticated');
create policy "photos: auth delete"
  on storage.objects for delete using (bucket_id = 'place-photos' and auth.role() = 'authenticated');
