/* ============================================================
   Shunshun Travel — main page (Supabase版)
   - 場所メタデータ: Supabase Postgres (places テーブル)
   - 写真:           Supabase Storage (public URL を photos[] に保持)
   - 認証:           Supabase Auth (管理者のみ追加/編集/削除可能)
   - 地図:           Leaflet / OpenStreetMap
   ============================================================ */
import {
  fetchPlaces, upsertPlace, deletePlace,
  uploadPhoto, deletePhoto,
  fetchAvatar, saveAvatar,
  currentUser, onAuthChange
} from './supabase-client.js';
import { initAuthUI, requireLogin } from './auth.js';

(() => {
  'use strict';

  const REGIONS = [
    { key:'国内', kicker:'Domestic', title:'国内', en:'Japan',  desc:'北海道から九州まで。お気に入りの景色と食を県ごとに。' },
    { key:'海外', kicker:'Overseas', title:'海外', en:'Abroad', desc:'アジアからヨーロッパまで。歩いて出会った街と味の記録。' },
    { key:'食事', kicker:'Ramen & Food', title:'食事', en:'Food', desc:'旅の目的の半分はこれ。ラーメンを中心に、忘れられない一杯を。' }
  ];

  const BLANK='data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

  /* ---------- helpers ---------- */
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => (s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fmtDate = d => { if(!d) return ''; const [y,m]=d.split('-'); return m ? `${y}.${m}` : y; };
  const starHTML = r => { let h=''; for(let i=1;i<=5;i++) h += i<=r ? '★' : '<b>★</b>'; return h; };
  const uid = () => 'x'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);

  function toast(msg){
    const n=$('#saveNote'); $('#saveNoteText').textContent=msg||'保存しました';
    n.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>n.classList.remove('show'),1700);
  }

  /* ---------- in-memory data (Supabaseから取得) ---------- */
  let places = [];

  async function reload(){
    places = await fetchPlaces();
    renderStats(); renderMarkers(); renderRegions(); renderPlaces();
  }

  /* ============================================================
     STATS
     ============================================================ */
  function computeStats(){
    const prefs=new Set(), countries=new Set();
    places.forEach(p=>{ if(p.area==='海外') countries.add(p.region); else prefs.add(p.region); });
    return { countries:countries.size, prefs:prefs.size, spots:places.length };
  }
  function renderStats(){
    const s=computeStats();
    $$('[data-stat]').forEach(el=>{ el.textContent='0'; animateNum(el, s[el.dataset.stat]); });
  }
  function animateNum(el,target){
    const start=performance.now(), dur=900;
    (function tick(t){ const p=Math.min(1,(t-start)/dur), e=1-Math.pow(1-p,3);
      el.textContent=Math.round(target*e); if(p<1) requestAnimationFrame(tick); })(start);
  }

  /* ============================================================
     HERO LEAFLET MAP
     ============================================================ */
  let heroMap=null, heroLayer=null;
  function pinIcon(cat){
    return L.divIcon({ className:'', html:`<div class="map-pin cat-${cat}"><div class="pd"></div></div>`, iconSize:[24,24], iconAnchor:[10,20], popupAnchor:[0,-20] });
  }
  function initHeroMap(){
    heroMap = L.map('leafletMap', { scrollWheelZoom:false, zoomControl:true, attributionControl:true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution:'&copy; OpenStreetMap &copy; CARTO', subdomains:'abcd', maxZoom:19
    }).addTo(heroMap);
    heroLayer = L.layerGroup().addTo(heroMap);
    renderMarkers();
    setTimeout(()=>heroMap.invalidateSize(), 200);
    window.addEventListener('resize', ()=>heroMap && heroMap.invalidateSize());
  }
  function renderMarkers(){
    if(!heroMap) return;
    heroLayer.clearLayers();
    const pts=[];
    places.forEach(p=>{
      if(p.lat==null||p.lng==null) return;
      pts.push([p.lat,p.lng]);
      const m=L.marker([p.lat,p.lng],{icon:pinIcon(p.cat)}).addTo(heroLayer);
      const cover = (p.photos && p.photos[0]) || '';
      const div=document.createElement('div'); div.className='pop';
      div.innerHTML=`<img class="pop-img" alt="" src="${cover||BLANK}" style="${cover?'':'display:none'}">
        <div class="pop-body">
          <p class="pop-name">${esc(p.name)}</p>
          <div class="pop-meta"><span class="pop-region">${esc(p.region)}</span><span class="pop-stars">${'★'.repeat(p.rating||0)}</span></div>
          <a class="pop-link">この旅を見る →</a>
        </div>`;
      div.querySelector('.pop-link').addEventListener('click',()=>{
        heroMap.closePopup(); filterArea=p.area; filterCat='all'; syncControls(); renderPlaces();
        document.getElementById('spots').scrollIntoView();
      });
      m.bindPopup(div,{closeButton:true});
    });
    if(pts.length){ heroMap.fitBounds(pts,{padding:[40,40], maxZoom:6}); }
    else heroMap.setView([30,30],2);
  }

  /* ============================================================
     REGION CARDS
     ============================================================ */
  function renderRegions(){
    const grid=$('#regionGrid');
    grid.innerHTML=REGIONS.map(r=>{
      const subset = r.key==='食事' ? places.filter(p=>p.cat==='食事') : places.filter(p=>p.area===r.key);
      const regs=[...new Set(subset.map(p=>p.region))];
      const shown=regs.slice(0,3), more=regs.length-shown.length;
      const chips=shown.map(c=>`<span class="chip">${esc(c)}</span>`).join('')+(more>0?`<span class="chip terra">+${more}</span>`:'');
      return `<a class="region reveal acc-${r.key}" href="region.html?view=${encodeURIComponent(r.key)}" data-region-filter="${r.key}">
        <div class="rk">${r.kicker}</div>
        <div class="rt">${r.en}<span class="jp">${r.title}</span></div>
        <div class="rc">${esc(r.desc)}</div>
        <div class="chips">${chips||'<span class="chip">まだ記録がありません</span>'}</div>
        <div class="big-num">${subset.length}</div>
      </a>`;
    }).join('');
    observeReveals();
  }

  /* ============================================================
     PLACE GRID
     ============================================================ */
  let filterArea='all', filterCat='all', sortBy='new';

  function currentList(){
    let list=places.slice();
    if(filterArea!=='all') list=list.filter(p=>p.area===filterArea);
    if(filterCat!=='all')  list=list.filter(p=>p.cat===filterCat);
    if(sortBy==='new')         list.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    else if(sortBy==='old')    list.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    else if(sortBy==='rating') list.sort((a,b)=>b.rating-a.rating||(b.date||'').localeCompare(a.date||''));
    return list;
  }

  function renderPlaces(){
    const grid=$('#placeGrid'); const list=currentList();
    if(!list.length){
      grid.innerHTML=`<div class="empty-state">この条件の記録はまだありません。${currentUser()?'<br>右上の「場所を追加」から登録できます。':''}</div>`;
      return;
    }
    grid.innerHTML=list.map(p=>{
      const n=(p.photos||[]).length;
      const cover = n ? p.photos[0] : '';
      const links=[];
      if(p.map)  links.push(`<a class="linkchip" href="${esc(p.map)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>Map</a>`);
      if(p.site) links.push(`<a class="linkchip" href="${esc(p.site)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>公式</a>`);
      const countBadge = n>1 ? `<div class="photo-count"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15l5-5 4 4 3-3 6 6"/></svg>${n}</div>` : '';
      const slotInner = cover
        ? `<img src="${esc(cover)}" alt="" loading="lazy">`
        : `<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L5 21"/></svg><span>写真は「編集」から追加</span></div>`;
      return `<article class="place reveal cat-${p.cat}" data-id="${p.id}">
        <div class="photo">
          <div class="slot" data-place="${p.id}">${slotInner}</div>
          ${countBadge}
          <div class="badges"><span class="badge area">${esc(p.area)}</span><span class="badge cat cat-${p.cat}">${esc(p.cat)}</span></div>
          <div class="card-tools owner-only">
            <button class="tool edit" title="編集"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
            <button class="tool del" title="削除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>
          </div>
        </div>
        <div class="body">
          <h3 class="pname">${esc(p.name)}</h3>
          <div class="pmeta"><span class="region-tag">${esc(p.region)}</span><span class="stars">${starHTML(p.rating)}</span><span class="date">${fmtDate(p.date)}</span></div>
          <p class="comment">${esc(p.comment)}</p>
          <div class="links">${links.join('')}</div>
        </div>
      </article>`;
    }).join('');

    grid.querySelectorAll('.slot').forEach(slot=>{
      slot.addEventListener('click', ()=>{
        const place=places.find(x=>x.id===slot.dataset.place);
        if(place && place.photos && place.photos.length) openLightbox(place,0);
      });
    });
    grid.querySelectorAll('.tool.edit').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); if(requireLogin()) openModal(b.closest('.place').dataset.id); }));
    grid.querySelectorAll('.tool.del').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); if(requireLogin()) removePlace(b.closest('.place').dataset.id); }));
    observeReveals();
  }

  function syncControls(){
    $$('#areaSeg button').forEach(b=>b.classList.toggle('active', b.dataset.area===filterArea));
    $('#catSel').value=filterCat; $('#sortSel').value=sortBy;
  }

  /* ============================================================
     LIGHTBOX
     ============================================================ */
  let lbPlace=null, lbIdx=0;
  function openLightbox(place, idx){
    lbPlace=place; lbIdx=idx||0;
    const ids=place.photos||[]; if(!ids.length) return;
    const strip=$('#lbStrip');
    strip.innerHTML=ids.map((url,i)=>`<img data-i="${i}" class="${i===lbIdx?'on':''}" alt="" src="${esc(url)}" loading="lazy">`).join('');
    strip.querySelectorAll('img').forEach(im=>im.addEventListener('click',()=>{ lbIdx=+im.dataset.i; showLb(); }));
    $('#lbPrev').classList.toggle('hide', ids.length<2);
    $('#lbNext').classList.toggle('hide', ids.length<2);
    $('#lbStrip').style.display = ids.length<2 ? 'none':'flex';
    $('#lightbox').classList.add('open');
    showLb();
  }
  function showLb(){
    if(!lbPlace) return; const ids=lbPlace.photos;
    $('#lbImg').src=ids[lbIdx]||BLANK;
    $('#lbCap').textContent=`${lbPlace.name} — ${lbIdx+1} / ${ids.length}`;
    $$('#lbStrip img').forEach(im=>im.classList.toggle('on', +im.dataset.i===lbIdx));
  }
  function lbStep(d){ if(!lbPlace) return; const n=lbPlace.photos.length; lbIdx=(lbIdx+d+n)%n; showLb(); }
  function closeLb(){ $('#lightbox').classList.remove('open'); lbPlace=null; }

  /* ============================================================
     MODAL (add / edit)
     ============================================================ */
  let editingId=null, formRating=4, formPhotos=[], removedUrls=[], pickMap=null, pickMarker=null, pickLat=null, pickLng=null;

  function setFormRating(r){ formRating=r; $$('#f-rating button').forEach(b=>b.classList.toggle('on',+b.dataset.v<=r)); }

  function renderFormThumbs(){
    const wrap=$('#formThumbs');
    wrap.innerHTML=formPhotos.map((ph,i)=>`<div class="thumb" data-i="${i}">
      <img src="${esc(ph.url)}" alt="">${i===0?'<span class="cover-tag">カバー</span>':''}
      <button class="rm" title="削除">×</button>${ph.uploading?'<span class="cover-tag" style="left:auto;right:6px;top:6px;">UP…</span>':''}</div>`).join('');
    wrap.querySelectorAll('.rm').forEach(b=>b.addEventListener('click',e=>{
      e.stopPropagation(); const i=+b.closest('.thumb').dataset.i;
      const removed=formPhotos.splice(i,1)[0];
      if(removed && !removed.isNew) removedUrls.push(removed.url);
      else if(removed && removed.isNew) deletePhoto(removed.url).catch(()=>{});
      renderFormThumbs();
    }));
    wrap.querySelectorAll('.thumb img').forEach(im=>im.addEventListener('click',()=>{
      const i=+im.closest('.thumb').dataset.i; if(i>0){ const [m]=formPhotos.splice(i,1); formPhotos.unshift(m); renderFormThumbs(); }
    }));
  }

  async function addFormPhotos(files){
    for(const f of files){
      if(!f || !f.type.startsWith('image/')) continue;
      const tmp = { url:'', isNew:true, uploading:true };
      formPhotos.push(tmp); renderFormThumbs();
      try {
        const url = await uploadPhoto(f);
        tmp.url = url; tmp.uploading = false;
      } catch (e) {
        const i = formPhotos.indexOf(tmp); if(i>=0) formPhotos.splice(i,1);
        alert('アップロードに失敗しました: ' + (e.message || e));
      }
      renderFormThumbs();
    }
  }

  function initPickMap(){
    pickMap=L.map('pickMap',{scrollWheelZoom:false, zoomControl:true});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{attribution:'&copy; OpenStreetMap &copy; CARTO', subdomains:'abcd', maxZoom:19}).addTo(pickMap);
    pickMap.on('click', e=>{ setPick(e.latlng.lat, e.latlng.lng); });
  }
  function setPick(lat,lng){
    pickLat=lat; pickLng=lng;
    if(pickMarker) pickMarker.setLatLng([lat,lng]);
    else pickMarker=L.marker([lat,lng],{icon:pinIcon('観光')}).addTo(pickMap);
    $('#pickHint').textContent=`— 指定済み（${lat.toFixed(2)}, ${lng.toFixed(2)}）`;
  }

  function openModal(id){
    editingId=id||null; removedUrls=[]; formPhotos=[];
    $('#modalTitle').textContent=id?'記録を編集':'場所を追加';
    const p=id?places.find(x=>x.id===id):null;
    $('#f-name').value=p?p.name:''; $('#f-area').value=p?p.area:'国内';
    $('#f-region').value=p?p.region:''; $('#f-cat').value=p?p.cat:'観光';
    $('#f-date').value=p?p.date:''; $('#f-comment').value=p?p.comment:'';
    $('#f-map').value=p?(p.map||''):''; $('#f-site').value=p?(p.site||''):'';
    setFormRating(p?p.rating:4);
    pickLat=p?p.lat:null; pickLng=p?p.lng:null;

    $('#overlay').classList.add('open');

    setTimeout(()=>{
      if(!pickMap) initPickMap();
      pickMap.invalidateSize();
      if(pickMarker){ pickMap.removeLayer(pickMarker); pickMarker=null; }
      if(pickLat!=null){ setPick(pickLat,pickLng); pickMap.setView([pickLat,pickLng],5); }
      else { pickMap.setView([36,138],3); $('#pickHint').textContent='— 地図をクリックして指定'; }
    },120);

    if(p && p.photos && p.photos.length){
      formPhotos = p.photos.map(url => ({ url, isNew:false }));
    }
    renderFormThumbs();

    setTimeout(()=>$('#f-name').focus(),60);
  }
  function closeModal(){ $('#overlay').classList.remove('open'); }

  async function saveModal(){
    const name=$('#f-name').value.trim();
    if(!name){ $('#f-name').focus(); $('#f-name').style.borderColor='var(--terra)'; return; }
    if(formPhotos.some(p=>p.uploading)){ alert('写真のアップロード中です。完了までお待ちください。'); return; }

    const payload = {
      id: editingId || uid(),
      name,
      area: $('#f-area').value,
      region: $('#f-region').value.trim() || '（地域未設定）',
      cat: $('#f-cat').value,
      date: $('#f-date').value || null,
      rating: formRating,
      comment: $('#f-comment').value.trim(),
      map: $('#f-map').value.trim(),
      site: $('#f-site').value.trim(),
      lat: pickLat,
      lng: pickLng,
      photos: formPhotos.map(p=>p.url).filter(Boolean)
    };

    try {
      await upsertPlace(payload);
      for(const url of removedUrls){ await deletePhoto(url).catch(()=>{}); }
      toast(editingId ? '記録を更新しました' : '場所を追加しました');
      closeModal();
      await reload();
    } catch (e) {
      alert('保存に失敗しました: ' + (e.message || e));
    }
  }

  async function removePlace(id){
    const p=places.find(x=>x.id===id);
    if(!p || !confirm(`「${p.name}」の記録を削除しますか？`)) return;
    try {
      await deletePlace(id);
      for(const url of (p.photos||[])){ await deletePhoto(url).catch(()=>{}); }
      toast('削除しました');
      await reload();
    } catch (e) {
      alert('削除に失敗しました: ' + (e.message || e));
    }
  }

  /* ============================================================
     AVATAR
     ============================================================ */
  async function initAvatar(){
    const slot=$('.avatar .slot');
    async function paint(){
      const url=await fetchAvatar();
      slot.innerHTML = url
        ? `<img src="${esc(url)}" alt=""><div class="change owner-only">差し替え</div>`
        : `<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg><span>顔写真</span></div>`;
    }
    async function set(file){
      if(!file || !file.type.startsWith('image/')) return;
      if(!requireLogin()) return;
      try {
        const url = await uploadPhoto(file);
        await saveAvatar(url);
        toast('プロフィール写真を保存');
        paint();
      } catch (e) { alert('失敗: '+(e.message||e)); }
    }
    slot.addEventListener('click',()=>{
      if(!currentUser()) return;
      const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
      inp.onchange=()=>set(inp.files[0]); inp.click();
    });
    ['dragenter','dragover'].forEach(ev=>slot.addEventListener(ev,e=>{e.preventDefault(); slot.classList.add('drag');}));
    ['dragleave','dragend'].forEach(ev=>slot.addEventListener(ev,()=>slot.classList.remove('drag')));
    slot.addEventListener('drop',e=>{ e.preventDefault(); slot.classList.remove('drag'); const f=e.dataTransfer.files[0]; if(f) set(f); });
    paint();
    onAuthChange(paint);
  }

  /* ============================================================
     INIT
     ============================================================ */

   function extractLatLng(url){
        if(!url) return null;
        // 例: https://www.google.com/maps/place/.../@35.123,139.456,17z
        let m = url.match(/@([-\d.]+),([-\d.]+)[,z/m]/);
        if(m) return { lat:parseFloat(m[1]), lng:parseFloat(m[2]) };
        // 例: https://www.google.com/maps?q=35.123,139.456
        m = url.match(/[?&]q=([-\d.]+),([-\d.]+)/);
        if(m) return { lat:parseFloat(m[1]), lng:parseFloat(m[2]) };
        // 例: https://www.google.com/maps?ll=35.123,139.456
        m = url.match(/[?&]ll=([-\d.]+),([-\d.]+)/);
        if(m) return { lat:parseFloat(m[1]), lng:parseFloat(m[2]) };
        return null;
      } 
   
  function wireUI(){
    $('#openAdd').addEventListener('click',()=>{ if(requireLogin()) openModal(null); });
    $('#closeModal').addEventListener('click',closeModal);
    $('#cancelModal').addEventListener('click',closeModal);
    $('#overlay').addEventListener('click',e=>{ if(e.target===$('#overlay')) closeModal(); });
    $('#saveModal').addEventListener('click',saveModal);
    function tryAutoPin(){
     const url = $('#f-map').value;
     if(!url) return;
     let coords = null;
     let m = url.match(/@([-\d.]+),([-\d.]+)[,z\/m]/);
     if(m) coords = { lat:parseFloat(m[1]), lng:parseFloat(m[2]) };
     if(!coords){ m = url.match(/[?&]q=([-\d.]+),([-\d.]+)/); if(m) coords = { lat:parseFloat(m[1]), lng:parseFloat(m[2]) }; }
     if(!coords){ m = url.match(/[?&]ll=([-\d.]+),([-\d.]+)/); if(m) coords = { lat:parseFloat(m[1]), lng:parseFloat(m[2]) }; }
     if(!coords) return;
     if(!pickMap) initPickMap();
     setPick(coords.lat, coords.lng);
     setTimeout(()=>{ pickMap.invalidateSize(); pickMap.setView([coords.lat, coords.lng], 10); }, 130);
   }
    $('#f-map').addEventListener('change', tryAutoPin);
    $('#f-map').addEventListener('paste', ()=>setTimeout(tryAutoPin, 60));
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'){ closeModal(); closeLb(); }
      if($('#lightbox').classList.contains('open')){ if(e.key==='ArrowLeft') lbStep(-1); if(e.key==='ArrowRight') lbStep(1); }
    });
    $$('#f-rating button').forEach(b=>b.addEventListener('click',()=>setFormRating(+b.dataset.v)));
    $('#f-name').addEventListener('input',e=>e.target.style.borderColor='');

    const drop=$('#photoDrop');
    drop.addEventListener('click',()=>{
      if(!requireLogin()) return;
      const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.multiple=true;
      inp.onchange=()=>addFormPhotos(inp.files); inp.click();
    });
    ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault(); drop.classList.add('drag');}));
    ['dragleave','dragend'].forEach(ev=>drop.addEventListener(ev,()=>drop.classList.remove('drag')));
    drop.addEventListener('drop',e=>{ e.preventDefault(); drop.classList.remove('drag'); if(requireLogin()) addFormPhotos(e.dataTransfer.files); });

    $$('#areaSeg button').forEach(b=>b.addEventListener('click',()=>{ filterArea=b.dataset.area; syncControls(); renderPlaces(); }));
    $('#catSel').addEventListener('change',e=>{ filterCat=e.target.value; renderPlaces(); });
    $('#sortSel').addEventListener('change',e=>{ sortBy=e.target.value; renderPlaces(); });

    $('#lbClose').addEventListener('click',closeLb);
    $('#lbPrev').addEventListener('click',()=>lbStep(-1));
    $('#lbNext').addEventListener('click',()=>lbStep(1));
    $('#lightbox').addEventListener('click',e=>{ if(e.target===$('#lightbox')) closeLb(); });

    const navlinks=$$('nav.main a');
    const obs=new IntersectionObserver(entries=>entries.forEach(en=>{
      if(en.isIntersecting) navlinks.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+en.target.id));
    }),{rootMargin:'-45% 0px -50% 0px'});
    ['regions','spots','about'].forEach(id=>{ const s=document.getElementById(id); if(s) obs.observe(s); });
  }

  const revealObs = new IntersectionObserver(entries=>{
    entries.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add('in'); revealObs.unobserve(en.target); } });
  }, {rootMargin:'0px 0px -8% 0px', threshold:.08});
  function observeReveals(){ $$('.reveal:not(.in)').forEach(el=>revealObs.observe(el)); }

  async function init(){
    await initAuthUI();
    wireUI();
    if(window.L) initHeroMap();
    initAvatar();
    onAuthChange(()=>{ renderPlaces(); });   /* 編集ツール表示の切り替え */
    await reload();
    observeReveals();
    setTimeout(()=>document.body.classList.add('loaded'), 60);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
