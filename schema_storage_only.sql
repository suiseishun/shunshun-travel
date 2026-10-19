-- Shunshun Travel — 写真専用Supabaseプロジェクト用スキーマ
-- こちらのプロジェクトには places/profile テーブルは作りません(メインプロジェクト側に残します)。
-- 先に Storage 画面で bucket name = place-photos, Public ON で作成してから、このSQLを実行してください。

create policy "photos: public read"
  on storage.objects for select using (bucket_id = 'place-photos');

create policy "photos: auth write"
  on storage.objects for insert with check (bucket_id = 'place-photos' and auth.role() = 'authenticated');
create policy "photos: auth update"
  on storage.objects for update using (bucket_id = 'place-photos' and auth.role() = 'authenticated');
create policy "photos: auth delete"
  on storage.objects for delete using (bucket_id = 'place-photos' and auth.role() = 'authenticated');
