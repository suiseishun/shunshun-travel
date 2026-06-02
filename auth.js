/* ============================================================
   Shunshun Travel — Auth UI (login modal)
   ------------------------------------------------------------
   ヘッダに「ログイン / ログアウト」ボタンを差し込み、
   未ログイン時に編集系操作をブロックする小さなモジュール。
   ============================================================ */
import { initAuth, currentUser, onAuthChange, signIn, signOut } from './supabase-client.js';

/* ---------- ヘッダにボタンを差し込む ---------- */
function injectHeaderButton(){
  const bar = document.querySelector('header.site .bar');
  if (!bar || document.getElementById('authBtn')) return;
  const btn = document.createElement('button');
  btn.id = 'authBtn';
  btn.className = 'auth-btn';
  btn.type = 'button';
  btn.textContent = 'ログイン';
  btn.addEventListener('click', () => {
    if (currentUser()) signOut();
    else openLoginModal();
  });
  /* 「場所を追加」の左に置く */
  const addBtn = bar.querySelector('.add-btn');
  if (addBtn) bar.insertBefore(btn, addBtn);
  else bar.appendChild(btn);
}

function syncHeader(){
  const btn = document.getElementById('authBtn');
  if (!btn) return;
  const u = currentUser();
  btn.textContent = u ? 'ログアウト' : 'ログイン';
  btn.title = u ? (u.email || '') : '';
  /* 未ログインなら「場所を追加」と編集系ツールを隠す/無効化 */
  document.body.classList.toggle('logged-in', !!u);
}

/* ---------- ログインモーダル ---------- */
function openLoginModal(){
  if (document.getElementById('loginOverlay')) return;
  const wrap = document.createElement('div');
  wrap.id = 'loginOverlay';
  wrap.className = 'overlay open';
  wrap.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" style="max-width:420px;">
      <div class="modal-head">
        <h3>ログイン</h3>
        <button class="x" id="loginClose" aria-label="閉じる">×</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>メールアドレス</label>
          <input type="email" id="loginEmail" autocomplete="email" placeholder="you@example.com">
        </div>
        <div class="field">
          <label>パスワード</label>
          <input type="password" id="loginPass" autocomplete="current-password">
        </div>
        <div class="field" id="loginErr" style="color:var(--terra); font-size:13px; display:none;"></div>
        <p style="font-size:12px; color:var(--ink-faint); margin:4px 0 0;">
          管理者(自分)だけが追加・編集できます。閲覧はログイン不要。
        </p>
      </div>
      <div class="modal-foot">
        <button class="btn-ghost" id="loginCancel">キャンセル</button>
        <button class="btn-solid" id="loginSubmit">ログイン</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  const close = () => wrap.remove();
  wrap.querySelector('#loginClose').addEventListener('click', close);
  wrap.querySelector('#loginCancel').addEventListener('click', close);
  wrap.addEventListener('click', e => { if (e.target === wrap) close(); });

  const submit = async () => {
    const email = wrap.querySelector('#loginEmail').value.trim();
    const pass  = wrap.querySelector('#loginPass').value;
    const err   = wrap.querySelector('#loginErr');
    err.style.display = 'none';
    if (!email || !pass){ err.textContent='メールとパスワードを入力してください'; err.style.display='block'; return; }
    try {
      await signIn(email, pass);
      close();
    } catch (e) {
      err.textContent = 'ログインに失敗しました: ' + (e.message || e);
      err.style.display = 'block';
    }
  };
  wrap.querySelector('#loginSubmit').addEventListener('click', submit);
  wrap.querySelector('#loginPass').addEventListener('keydown', e => { if (e.key==='Enter') submit(); });
  setTimeout(() => wrap.querySelector('#loginEmail').focus(), 60);
}

/* ---------- 編集系操作のガード(他モジュールから利用) ---------- */
export function requireLogin(){
  if (currentUser()) return true;
  openLoginModal();
  return false;
}

/* ---------- 初期化 ---------- */
export async function initAuthUI(){
  injectHeaderButton();
  await initAuth();
  syncHeader();
  onAuthChange(() => syncHeader());
}
