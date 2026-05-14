// Injects UI and trail into every page. Uses browser storage for emojis and enabled state.
(() => {
  const MAX = 50;
  const STYLE_ID = 'emoji-trail-style';
  const CONTAINER_ID = 'emoji-trail-container';

  // Avoid injecting twice
  if (window.__EMOJI_TRAIL_INJECTED) return;
  window.__EMOJI_TRAIL_INJECTED = true;

  // styles
  const css = `
:root{--max-size:48px;--min-size:18px;--gap:20px}
.emoji-trail-control{position:fixed;top:10px;left:10px;z-index:2147483646;display:flex;gap:8px;align-items:center;background:rgba(0,0,0,0.28);padding:6px;border-radius:8px;backdrop-filter:blur(4px)}
.emoji-trail-input{min-width:220px;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.03);color:inherit}
.emoji-trail-btn{padding:6px 8px;border-radius:6px;border:none;background:#06b6d4;color:#042a2e;cursor:pointer}
.emoji-trail-toggle{padding:6px 8px;border-radius:6px;border:none;background:#94a3b8;color:#061827;cursor:pointer}
.emoji-trail-node{position:fixed;transform:translate(-50%,-50%);pointer-events:none;will-change:transform,opacity;user-select:none;z-index:2147483645;line-height:1;text-align:center}
.hide-cursor{cursor:none !important}
`;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);

  // container
  const container = document.createElement('div');
  container.id = CONTAINER_ID;
  container.style.all = 'initial';
  document.documentElement.appendChild(container);

  // control UI
  const control = document.createElement('div');
  control.className = 'emoji-trail-control';
  control.innerHTML = `
    <input class="emoji-trail-input" id="emojiInput" placeholder="Add emojis (Enter to add)" />
    <button class="emoji-trail-btn" id="addBtn">Add</button>
    <button class="emoji-trail-btn" id="toggleBtn">Enable</button>
    <button class="emoji-trail-toggle" id="clearBtn">Clear</button>
    <div id="count" style="color:#e2e8f0;font-size:13px">0/50</div>
  `;
  container.appendChild(control);

  // state
  let emojis = [];
  let active = false;
  let trailNodes = [];
  let pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let lastTime = 0;

  // helpers
  function splitGraphemes(str){
    if (!str) return [];
    if (typeof Intl !== 'undefined' && Intl.Segmenter){
      return Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(str), s=>s.segment).filter(Boolean);
    }
    return Array.from(str).filter(Boolean);
  }
  function sanitizeAndExtract(s){
    return splitGraphemes(s).filter(ch => /\p{Extended_Pictographic}/u.test(ch) || /\p{Emoji_Presentation}/u.test(ch) || /\p{Emoji_Component}/u.test(ch));
  }
  function renderCount(){ document.getElementById('count').textContent = emojis.length + '/50'; }

  // UI refs
  const input = control.querySelector('#emojiInput');
  const addBtn = control.querySelector('#addBtn');
  const toggleBtn = control.querySelector('#toggleBtn');
  const clearBtn = control.querySelector('#clearBtn');

  addBtn.addEventListener('click', () => {
    const vals = sanitizeAndExtract(input.value || '');
    if (!vals.length){ input.value=''; input.focus(); return; }
    for (const v of vals){ if (emojis.length >= MAX) break; emojis.push(v); }
    input.value = ''; renderCount(); saveState();
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter'){ e.preventDefault(); addBtn.click(); } });

  clearBtn.addEventListener('click', ()=> {
    stopTrail();
    emojis = [];
    renderCount();
    cleanupNodes();
    saveState();
  });

  toggleBtn.addEventListener('click', ()=> {
    if (!active) startTrail(); else stopTrail();
    saveState();
  });

  // storage
  const storage = (typeof browser !== 'undefined' ? browser.storage : chrome.storage);
  function saveState(){
    try {
      storage.local.set({ emojiTrail_emojis: emojis, emojiTrail_active: active });
    } catch (e){ /* ignore */ }
  }
  function loadState(){
    try {
      storage.local.get(['emojiTrail_emojis','emojiTrail_active'], (res) => {
        if (!res) return;
        if (Array.isArray(res.emojiTrail_emojis)) emojis = res.emojiTrail_emojis.slice(0, MAX);
        if (typeof res.emojiTrail_active === 'boolean') {
          if (res.emojiTrail_active) startTrail();
        }
        renderCount();
      });
    } catch (e) { /* ignore */ }
  }

  // nodes
  function ensureNodes(n){
    while (trailNodes.length < n){
      const el = document.createElement('div');
      el.className = 'emoji-trail-node';
      el.style.opacity = '0';
      document.body.appendChild(el);
      trailNodes.push(el);
    }
    for (let i=0;i<trailNodes.length;i++){
      trailNodes[i].style.display = i < n ? 'block' : 'none';
    }
  }
  function cleanupNodes(){ trailNodes.forEach(n=>n.remove()); trailNodes = []; }

  // start/stop
  function startTrail(){
    if (!emojis.length) { toggleBtn.textContent = 'Enable'; return; }
    if (active) return;
    active = true;
    document.documentElement.classList.add('hide-cursor');
    toggleBtn.textContent = 'Disable';
    ensureNodes(emojis.length);
    for (let i=0;i<trailNodes.length;i++){
      trailNodes[i].textContent = emojis[i % emojis.length];
      const size = 48, min=18;
      const t = 1 - (i / Math.max(1, trailNodes.length-1));
      const fontSize = Math.round(min + (size - min) * t);
      trailNodes[i].style.fontSize = fontSize + 'px';
    }
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }
  function stopTrail(){
    if (!active) return;
    active = false;
    document.documentElement.classList.remove('hide-cursor');
    toggleBtn.textContent = 'Enable';
    trailNodes.forEach(n=> n.style.opacity = '0');
  }

  // pointer
  function setPointer(x,y){ pointer.x = x; pointer.y = y; }
  window.addEventListener('mousemove', e => setPointer(e.clientX, e.clientY));
  window.addEventListener('touchmove', e => { if (e.touches && e.touches[0]) setPointer(e.touches[0].clientX, e.touches[0].clientY); }, {passive:true});
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') stopTrail(); });

  // animation
  function loop(now){
    if (!active) return;
    if (!loop.positions || loop.positions.length !== trailNodes.length){
      loop.positions = Array.from({length: trailNodes.length}, ()=>({x:pointer.x,y:pointer.y}));
    }
    const pos = loop.positions;
    pos[0].x += (pointer.x - pos[0].x) * 0.36;
    pos[0].y += (pointer.y - pos[0].y) * 0.36;
    const gap = 20;
    for (let i=1;i<pos.length;i++){
      const dx = pos[i-1].x - pos[i].x;
      const dy = pos[i-1].y - pos[i].y;
      const dist = Math.hypot(dx,dy) || 0.0001;
      const targetDist = gap;
      const diff = dist - targetDist;
      pos[i].x += (dx/dist) * diff * 0.5;
      pos[i].y += (dy/dist) * diff * 0.5;
    }
    for (let i=0;i<trailNodes.length;i++){
      const n = trailNodes[i];
      const p = pos[i];
      n.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%,-50%)`;
      n.style.opacity = (1 - (i / Math.max(1, trailNodes.length))) * 0.98;
    }
    requestAnimationFrame(loop);
  }

  // prevent interfering with page interactions: allow inputs to work by focusing control input
  input.addEventListener('focus', (e) => e.stopPropagation());

  // load saved state
  loadState();

  // expose for debugging
  window.__emojiTrail = { start: startTrail, stop: stopTrail, add: (s) => { emojis.push(...sanitizeAndExtract(s).slice(0, MAX - emojis.length)); renderCount(); saveState(); } };

})();
// Injects UI and trail into every page. Uses browser storage for emojis and enabled state.
(() => {
  const MAX = 50;
  const STYLE_ID = 'emoji-trail-style';
  const CONTAINER_ID = 'emoji-trail-container';

  // Avoid injecting twice
  if (window.__EMOJI_TRAIL_INJECTED) return;
  window.__EMOJI_TRAIL_INJECTED = true;

  // styles
  const css = `
:root{--max-size:48px;--min-size:18px;--gap:20px}
.emoji-trail-control{position:fixed;top:10px;left:10px;z-index:2147483646;display:flex;gap:8px;align-items:center;background:rgba(0,0,0,0.28);padding:6px;border-radius:8px;backdrop-filter:blur(4px)}
.emoji-trail-input{min-width:220px;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.03);color:inherit}
.emoji-trail-btn{padding:6px 8px;border-radius:6px;border:none;background:#06b6d4;color:#042a2e;cursor:pointer}
.emoji-trail-toggle{padding:6px 8px;border-radius:6px;border:none;background:#94a3b8;color:#061827;cursor:pointer}
.emoji-trail-node{position:fixed;transform:translate(-50%,-50%);pointer-events:none;will-change:transform,opacity;user-select:none;z-index:2147483645;line-height:1;text-align:center}
.hide-cursor{cursor:none !important}
`;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);

  // container
  const container = document.createElement('div');
  container.id = CONTAINER_ID;
  container.style.all = 'initial';
  document.documentElement.appendChild(container);

  // control UI
  const control = document.createElement('div');
  control.className = 'emoji-trail-control';
  control.innerHTML = `
    <input class="emoji-trail-input" id="emojiInput" placeholder="Add emojis (Enter to add)" />
    <button class="emoji-trail-btn" id="addBtn">Add</button>
    <button class="emoji-trail-btn" id="toggleBtn">Enable</button>
    <button class="emoji-trail-toggle" id="clearBtn">Clear</button>
    <div id="count" style="color:#e2e8f0;font-size:13px">0/50</div>
  `;
  container.appendChild(control);

  // state
  let emojis = [];
  let active = false;
  let trailNodes = [];
  let pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let lastTime = 0;

  // helpers
  function splitGraphemes(str){
    if (!str) return [];
    if (typeof Intl !== 'undefined' && Intl.Segmenter){
      return Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(str), s=>s.segment).filter(Boolean);
    }
    return Array.from(str).filter(Boolean);
  }
  function sanitizeAndExtract(s){
    return splitGraphemes(s).filter(ch => /\p{Extended_Pictographic}/u.test(ch) || /\p{Emoji_Presentation}/u.test(ch) || /\p{Emoji_Component}/u.test(ch));
  }
  function renderCount(){ document.getElementById('count').textContent = emojis.length + '/50'; }

  // UI refs
  const input = control.querySelector('#emojiInput');
  const addBtn = control.querySelector('#addBtn');
  const toggleBtn = control.querySelector('#toggleBtn');
  const clearBtn = control.querySelector('#clearBtn');

  addBtn.addEventListener('click', () => {
    const vals = sanitizeAndExtract(input.value || '');
    if (!vals.length){ input.value=''; input.focus(); return; }
    for (const v of vals){ if (emojis.length >= MAX) break; emojis.push(v); }
    input.value = ''; renderCount(); saveState();
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter'){ e.preventDefault(); addBtn.click(); } });

  clearBtn.addEventListener('click', ()=> {
    stopTrail();
    emojis = [];
    renderCount();
    cleanupNodes();
    saveState();
  });

  toggleBtn.addEventListener('click', ()=> {
    if (!active) startTrail(); else stopTrail();
    saveState();
  });

  // storage
  const storage = (typeof browser !== 'undefined' ? browser.storage : chrome.storage);
  function saveState(){
    try {
      storage.local.set({ emojiTrail_emojis: emojis, emojiTrail_active: active });
    } catch (e){ /* ignore */ }
  }
  function loadState(){
    try {
      storage.local.get(['emojiTrail_emojis','emojiTrail_active'], (res) => {
        if (!res) return;
        if (Array.isArray(res.emojiTrail_emojis)) emojis = res.emojiTrail_emojis.slice(0, MAX);
        if (typeof res.emojiTrail_active === 'boolean') {
          if (res.emojiTrail_active) startTrail();
        }
        renderCount();
      });
    } catch (e) { /* ignore */ }
  }

  // nodes
  function ensureNodes(n){
    while (trailNodes.length < n){
      const el = document.createElement('div');
      el.className = 'emoji-trail-node';
      el.style.opacity = '0';
      document.body.appendChild(el);
      trailNodes.push(el);
    }
    for (let i=0;i<trailNodes.length;i++){
      trailNodes[i].style.display = i < n ? 'block' : 'none';
    }
  }
  function cleanupNodes(){ trailNodes.forEach(n=>n.remove()); trailNodes = []; }

  // start/stop
  function startTrail(){
    if (!emojis.length) { toggleBtn.textContent = 'Enable'; return; }
    if (active) return;
    active = true;
    document.documentElement.classList.add('hide-cursor');
    toggleBtn.textContent = 'Disable';
    ensureNodes(emojis.length);
    for (let i=0;i<trailNodes.length;i++){
      trailNodes[i].textContent = emojis[i % emojis.length];
      const size = 48, min=18;
      const t = 1 - (i / Math.max(1, trailNodes.length-1));
      const fontSize = Math.round(min + (size - min) * t);
      trailNodes[i].style.fontSize = fontSize + 'px';
    }
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }
  function stopTrail(){
    if (!active) return;
    active = false;
    document.documentElement.classList.remove('hide-cursor');
    toggleBtn.textContent = 'Enable';
    trailNodes.forEach(n=> n.style.opacity = '0');
  }

  // pointer
  function setPointer(x,y){ pointer.x = x; pointer.y = y; }
  window.addEventListener('mousemove', e => setPointer(e.clientX, e.clientY));
  window.addEventListener('touchmove', e => { if (e.touches && e.touches[0]) setPointer(e.touches[0].clientX, e.touches[0].clientY); }, {passive:true});
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') stopTrail(); });

  // animation
  function loop(now){
    if (!active) return;
    if (!loop.positions || loop.positions.length !== trailNodes.length){
      loop.positions = Array.from({length: trailNodes.length}, ()=>({x:pointer.x,y:pointer.y}));
    }
    const pos = loop.positions;
    pos[0].x += (pointer.x - pos[0].x) * 0.36;
    pos[0].y += (pointer.y - pos[0].y) * 0.36;
    const gap = 20;
    for (let i=1;i<pos.length;i++){
      const dx = pos[i-1].x - pos[i].x;
      const dy = pos[i-1].y - pos[i].y;
      const dist = Math.hypot(dx,dy) || 0.0001;
      const targetDist = gap;
      const diff = dist - targetDist;
      pos[i].x += (dx/dist) * diff * 0.5;
      pos[i].y += (dy/dist) * diff * 0.5;
    }
    for (let i=0;i<trailNodes.length;i++){
      const n = trailNodes[i];
      const p = pos[i];
      n.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%,-50%)`;
      n.style.opacity = (1 - (i / Math.max(1, trailNodes.length))) * 0.98;
    }
    requestAnimationFrame(loop);
  }

  // prevent interfering with page interactions: allow inputs to work by focusing control input
  input.addEventListener('focus', (e) => e.stopPropagation());

  // load saved state
  loadState();

  // expose for debugging
  window.__emojiTrail = { start: startTrail, stop: stopTrail, add: (s) => { emojis.push(...sanitizeAndExtract(s).slice(0, MAX - emojis.length)); renderCount(); saveState(); } };

})();
