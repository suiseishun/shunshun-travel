/* ============================================================
   Shunshun Travel — Region page (Supabase版)
   ?view=国内 | 海外 | 食事
   ============================================================ */
import { fetchPlaces } from './supabase-client.js';
import { initAuthUI } from './auth.js';

(() => {
  'use strict';

  const VIEWS = {
    '国内': { en:'Japan',  sub:'国内で訪れた場所を、都道府県ごとにまとめています。', unit:'県', filter:p=>p.area==='国内' },
    '海外': { en:'Abroad', sub:'海外で訪れた場所を、国ごとにまとめています。',       unit:'国', filter:p=>p.area==='海外' },
    '食事': { en:'Food',   sub:'旅先で食べたものを、地域ごとにまとめています。',       unit:'地域', filter:p=>p.cat==='食事' }
  };

  const BLANK='data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

  const $  = s=>document.querySelector(s);
  const $$ = s=>Array.from(document.querySelectorAll(s));
  const esc = s=>(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fmtDate = d=>{ if(!d) return ''; const [y,m]=d.split('-'); return m?`${y}.${m}`:y; };
  const starHTML = r=>{ let h=''; for(let i=1;i<=5;i++) h+= i<=r?'★':'<b>★</b>'; return h; };

  let places = [];

  const params = new URLSearchParams(location.search);
  let view = params.get('view') || '国内';
  if(!VIEWS[view]) view = '国内';
  const cfg = VIEWS[view];
  document.body.classList.add('view-'+view);
  document.title = `${cfg.en} — 地域から探す | Shunshun Travel`;

  function cardHTML(p){
    const n=(p.photos||[]).length;
    const cover = n ? p.photos[0] : '';
    const links=[];
    if(p.map)  links.push(`<a class="linkchip" href="${esc(p.map)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>Map</a>`);
    if(p.site) links.push(`<a class="linkchip" href="${esc(p.site)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>公式</a>`);
    const countBadge = n>1 ? `<div class="photo-count"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15l5-5 4 4 3-3 6 6"/></svg>${n}</div>` : '';
    const slotInner = cover
      ? `<img src="${esc(cover)}" alt="" loading="lazy">`
      : `<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L5 21"/></svg><span>写真なし</span></div>`;
    return `<article class="place reveal cat-${p.cat}" data-id="${p.id}">
      <div class="photo">
        <div class="slot" data-place="${p.id}">${slotInner}</div>
        ${countBadge}
        <div class="badges"><span class="badge area">${esc(p.area)}</span><span class="badge cat cat-${p.cat}">${esc(p.cat)}</span></div>
      </div>
      <div class="body">
        <h3 class="pname">${esc(p.name)}</h3>
        <div class="pmeta"><span class="region-tag">${esc(p.region)}</span><span class="stars">${starHTML(p.rating)}</span><span class="date">${fmtDate(p.date)}</span></div>
        <p class="comment">${esc(p.comment)}</p>
        <div class="links">${links.join('')}</div>
      </div>
    </article>`;
  }

  function render(){
    const list = places.filter(cfg.filter);
    $('#pageTitle').textContent = cfg.en;
    $('#pageSub').textContent = cfg.sub;

    const groups = new Map();
    list.forEach(p=>{ const k=p.region||'（地域未設定）'; if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(p); });
    const arr = [...groups.entries()].map(([name,items])=>{
      items.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      return { name, items, latest:items[0]?.date||'' };
    }).sort((a,b)=>(b.latest||'').localeCompare(a.latest||''));

    $('#pageStats').innerHTML =
      `<div class="ps"><span class="n">${list.length}</span><span class="c">${esc(cfg.en==='Food'?'Places 軒':'Places 場所')}</span></div>
       <div class="ps"><span class="n">${groups.size}</span><span class="c">${esc(cfg.unit)}</span></div>`;

    const wrap = $('#groups');
    if(!list.length){
      wrap.innerHTML = `<div class="empty-state" style="margin-top:30px;">まだ記録がありません。<br><a href="Shunshun%20Travel.html" style="color:var(--terra); text-decoration:underline;">記録一覧</a>の「場所を追加」から登録できます。</div>`;
      return;
    }

    wrap.innerHTML = arr.map(g=>`
      <section class="region-group reveal">
        <div class="group-head">
          <span class="marker"></span>
          <h2 class="gname">${esc(g.name)}</h2>
          <span class="gline"></span>
          <span class="gcount">${g.items.length} ${g.items.length>1?'spots':'spot'}</span>
        </div>
        <div class="place-grid">${g.items.map(cardHTML).join('')}</div>
      </section>`).join('');

    wrap.querySelectorAll('.slot').forEach(slot=>{
      slot.addEventListener('click',()=>{
        const place=places.find(x=>x.id===slot.dataset.place);
        if(place && place.photos && place.photos.length) openLightbox(place,0);
      });
    });
    observeReveals();
  }

  /* ---------- lightbox ---------- */
  let lbPlace=null, lbIdx=0;
  function openLightbox(place,idx){
    lbPlace=place; lbIdx=idx||0; const ids=place.photos||[]; if(!ids.length) return;
    const strip=$('#lbStrip');
    strip.innerHTML=ids.map((url,i)=>`<img data-i="${i}" class="${i===lbIdx?'on':''}" alt="" src="${esc(url)}" loading="lazy">`).join('');
    strip.querySelectorAll('img').forEach(im=>im.addEventListener('click',()=>{ lbIdx=+im.dataset.i; showLb(); }));
    $('#lbPrev').classList.toggle('hide', ids.length<2);
    $('#lbNext').classList.toggle('hide', ids.length<2);
    strip.style.display = ids.length<2 ? 'none':'flex';
    $('#lightbox').classList.add('open');
    showLb();
  }
  function showLb(){
    if(!lbPlace) return; const ids=lbPlace.photos;
    $('#lbImg').src = ids[lbIdx] || BLANK;
    $('#lbCap').textContent=`${lbPlace.name} — ${lbIdx+1} / ${ids.length}`;
    $$('#lbStrip img').forEach(im=>im.classList.toggle('on',+im.dataset.i===lbIdx));
  }
  function lbStep(d){ if(!lbPlace) return; const n=lbPlace.photos.length; lbIdx=(lbIdx+d+n)%n; showLb(); }
  function closeLb(){ $('#lightbox').classList.remove('open'); lbPlace=null; }

  const revealObs = new IntersectionObserver(entries=>{
    entries.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add('in'); revealObs.unobserve(en.target); } });
  }, {rootMargin:'0px 0px -8% 0px', threshold:.06});
  function observeReveals(){ $$('.reveal:not(.in)').forEach(el=>revealObs.observe(el)); }

  async function init(){
    await initAuthUI();
    places = await fetchPlaces();
    render();
    observeReveals();
    $('#lbClose').addEventListener('click',closeLb);
    $('#lbPrev').addEventListener('click',()=>lbStep(-1));
    $('#lbNext').addEventListener('click',()=>lbStep(1));
    $('#lightbox').addEventListener('click',e=>{ if(e.target===$('#lightbox')) closeLb(); });
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape') closeLb();
      if($('#lightbox').classList.contains('open')){ if(e.key==='ArrowLeft') lbStep(-1); if(e.key==='ArrowRight') lbStep(1); }
    });
    setTimeout(()=>document.body.classList.add('loaded'), 60);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
