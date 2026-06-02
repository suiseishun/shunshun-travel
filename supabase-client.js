/* ============================================================
   Shunshun Travel — Supabase client (shared)
   ------------------------------------------------------------
   1. https://supabase.com で新規プロジェクトを作成
   2. 下の SUPABASE_URL と SUPABASE_ANON_KEY を自分の値に置き換え
      (anon key はフロントに置いて安全。RLSで守る)
   3. README.md の SQL を SQL Editor で実行してテーブル/Storage/RLS を準備
   ============================================================ */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

/* ▼▼▼ ここを書き換え ▼▼▼ */
const SUPABASE_URL      = 'https://dakxikkpcgrcpzylrptc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRha3hpa2twY2dyY3B6eWxycHRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNzM0MzAsImV4cCI6MjA5NTk0OTQzMH0.GsU7SL2pCU0_6H5HCrvprObekSgE8WxixZg1RemOlyU';
/* ▲▲▲ ここを書き換え ▲▲▲ */

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

/* 画像Storageのバケット名 */
export const PHOTO_BUCKET = 'place-photos';

/* ---------- 認証ヘルパー ---------- */
let _user = null;
const _listeners = new Set();

export async function initAuth(){
  const { data } = await supabase.auth.getSession();
  _user = data.session?.user || null;
  supabase.auth.onAuthStateChange((_evt, session) => {
    _user = session?.user || null;
    _listeners.forEach(fn => fn(_user));
  });
  return _user;
}

export function currentUser(){ return _user; }
export function onAuthChange(fn){ _listeners.add(fn); return () => _listeners.delete(fn); }

export async function signIn(email, password){
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut(){
  await supabase.auth.signOut();
}

/* ---------- 場所(places)CRUD ---------- */
export async function fetchPlaces(){
  const { data, error } = await supabase
    .from('places')
    .select('*')
    .order('date', { ascending: false, nullsFirst: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function upsertPlace(place){
  const { data, error } = await supabase
    .from('places')
    .upsert(place)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlace(id){
  const { error } = await supabase.from('places').delete().eq('id', id);
  if (error) throw error;
}

/* ---------- 写真Storage ---------- */
/* ブラウザで画像をWebPに圧縮(無料1GB枠を守るために必須) */
export async function compressImage(file, maxDim = 1600, quality = 0.82){
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width  * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close && bitmap.close();
  return await new Promise(res => canvas.toBlob(res, 'image/webp', quality));
}

/* 圧縮 → アップロード → 公開URLを返す */
export async function uploadPhoto(file){
  const blob = await compressImage(file);
  const path = `${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: 'image/webp', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/* 公開URLからStorage上のパスを取り出して削除 */
export async function deletePhoto(publicUrl){
  if (!publicUrl) return;
  const marker = `/${PHOTO_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx < 0) return;
  const path = publicUrl.slice(idx + marker.length);
  await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}

/* ---------- アバター(profileテーブル) ---------- */
const AVATAR_KEY = 'avatar';
export async function fetchAvatar(){
  const { data } = await supabase
    .from('profile')
    .select('value')
    .eq('key', AVATAR_KEY)
    .maybeSingle();
  return data?.value || null;
}
export async function saveAvatar(url){
  const { error } = await supabase
    .from('profile')
    .upsert({ key: AVATAR_KEY, value: url });
  if (error) throw error;
}
