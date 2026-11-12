'use strict';
// ---- Interfeys, boshqaruv, ovoz, asosiy sikl ----
const $ = id => document.getElementById(id);
const cv = $('game'), mini = $('mini'), mctx = mini.getContext('2d');
const UI = { selection: [], placing: null, ptx: 0, pty: 0, drag: null, amode: false, sell: false };
let keys = {}, mouse = { x: 0, y: 0, inside: false }, paused = false, running = false, tab = 'b', groups = {}, lastClick = { t: 0, key: null };
const buttons = [];

// ---- Ovoz ----
const Snd = { ac: null, muted: false, last: {}, noise: null };
function audioInit() {
  if (Snd.ac) return;
  try {
    Snd.ac = new (window.AudioContext || window.webkitAudioContext)();
    const b = Snd.ac.createBuffer(1, Snd.ac.sampleRate, Snd.ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    Snd.noise = b;
  } catch (e) { Snd.ac = null; }
}
function noiseHit(dur, freq, type, vol) {
  const ac = Snd.ac, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), t = ac.currentTime;
  s.buffer = Snd.noise; s.loop = true; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(ac.destination); s.start(t, Math.random()); s.stop(t + dur);
}
function tone(f1, f2, dur, type, vol, delay) {
  const ac = Snd.ac, o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + (delay || 0);
  o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
}
function sfx(name, x, y) {
  if (!Snd.ac || Snd.muted || !running) return;
  if (x != null) {
    const sx = (x - y) * 32 - cam.x, sy = (x + y) * 16 - cam.y;
    if (sx < -100 || sx > VW + 100 || sy < -100 || sy > VH + 100 || !G.vis[clamp(y | 0, 0, N - 1) * N + clamp(x | 0, 0, N - 1)]) return;
  }
  const t = performance.now(); if (t - (Snd.last[name] || 0) < 70) return; Snd.last[name] = t;
  switch (name) {
    case 'shot': noiseHit(0.06, 1800, 'highpass', 0.1); break;
    case 'cannon': noiseHit(0.22, 700, 'lowpass', 0.3); tone(130, 40, 0.2, 'sine', 0.3); break;
    case 'rocket': noiseHit(0.35, 1200, 'bandpass', 0.2); break;
    case 'boom': noiseHit(0.6, 380, 'lowpass', 0.55); tone(90, 30, 0.45, 'sine', 0.4); break;
    case 'die': noiseHit(0.12, 900, 'bandpass', 0.12); break;
    case 'click': tone(700, 500, 0.05, 'square', 0.05); break;
    case 'ack': tone(420, 560, 0.07, 'triangle', 0.1); break;
    case 'place': noiseHit(0.25, 300, 'lowpass', 0.4); tone(200, 90, 0.2, 'triangle', 0.2); break;
    case 'ready': tone(520, 520, 0.1, 'triangle', 0.12); tone(780, 780, 0.16, 'triangle', 0.12, 0.11); break;
    case 'error': tone(170, 140, 0.14, 'sawtooth', 0.08); break;
    case 'alert': tone(440, 440, 0.14, 'square', 0.06); tone(330, 330, 0.2, 'square', 0.06, 0.16); break;
  }
}
function toast(text, kind) {
  const box = $('toasts'), el = document.createElement('div');
  el.className = 'toast ' + (kind || ''); el.textContent = text; box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => el.classList.add('out'), 3600); setTimeout(() => el.remove(), 4100);
  if (kind === 'bad') sfx('alert'); else if (kind === 'warn') sfx('error');
}

// ---- O'lcham va kamera ----
function resize() {
  const r = cv.parentElement.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  VW = Math.max(320, r.width | 0); VH = Math.max(240, r.height | 0);
  cv.width = VW * dpr; cv.height = VH * dpr; cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
  ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function centerOn(x, y) { cam.x = (x - y) * 32 - VW / 2; cam.y = (x + y) * 16 - VH / 2; clampCam(); }
function clampCam() { cam.x = clamp(cam.x, -N * 32 - VW / 2, N * 32 - VW / 2); cam.y = clamp(cam.y, -VH / 2, N * 32 - VH / 2); }
function updateCam(dt) {
  let dx = 0, dy = 0; const E = 10;
  if (keys.ArrowLeft) dx--; if (keys.ArrowRight) dx++; if (keys.ArrowUp) dy--; if (keys.ArrowDown) dy++;
  if (mouse.inside && !UI.drag) {
    if (mouse.px < E) dx--; else if (mouse.px > window.innerWidth - E) dx++;
    if (mouse.py < E) dy--; else if (mouse.py > window.innerHeight - E) dy++;
  }
  if (dx || dy) { cam.x += dx * 900 * dt; cam.y += dy * 700 * dt; clampCam(); }
}

// ---- Tanlash ----
function pickAt(sx, sy) {
  let best = null, bd = 18;
  for (const e of G.list) {
    if (e.dead || e.kind !== 'u') continue;
    if (e.owner !== 0 && !G.vis[(e.y | 0) * N + (e.x | 0)]) continue;
    const p = P(e.x, e.y), d = Math.hypot(p[0] - sx, p[1] - 8 - sy);
    if (d < bd) { bd = d; best = e; }
  }
  if (best) return best;
  const w = s2w(sx, sy), tx = Math.floor(w.x), ty = Math.floor(w.y);
  if (!inMap(tx, ty) || !G.exp[ty * N + tx]) return null;
  return G.ents.get(G.occ[ty * N + tx]) || null;
}
function setSel(list) { UI.selection = list; UI.amode = false; cv.classList.remove('amode'); refreshInfo(); }
function command(sx, sy) {
  const w = s2w(sx, sy), units = UI.selection.filter(e => e.kind === 'u' && !e.dead);
  const wx = clamp(w.x, 0.5, N - 0.5), wy = clamp(w.y, 0.5, N - 0.5);
  if (!units.length) {
    const b = UI.selection[0];
    if (b && (b.key === 'barracks' || b.key === 'factory')) { b.rally = { x: wx, y: wy }; G.fx.push({ t: 'ring', x: wx, y: wy, life: 0.5, max: 0.5, col: '#7dffa0' }); sfx('click'); }
    return;
  }
  const t = pickAt(sx, sy);
  if (t && t.owner !== 0) { cmdAttack(units, t); G.fx.push({ t: 'ring', x: t.x, y: t.y, life: 0.5, max: 0.5, col: '#ff5a5a' }); sfx('ack'); return; }
  const harv = units.filter(u => u.def.harvester); let rest = units;
  const tx = wx | 0, ty = wy | 0;
  if (harv.length && t && t.key === 'refinery') { harv.forEach(cmdReturn); rest = units.filter(u => !u.def.harvester); }
  else if (harv.length && G.ore[ty * N + tx] > 0) { harv.forEach(h => cmdHarvest(h, tx, ty)); rest = units.filter(u => !u.def.harvester); }
  if (rest.length) cmdMove(rest, wx, wy, UI.amode);
  G.fx.push({ t: 'ring', x: wx, y: wy, life: 0.5, max: 0.5, col: UI.amode ? '#ffb347' : '#7dffa0' }); sfx('ack');
}

cv.addEventListener('mousedown', e => {
  if (!running || G.over) return;
  audioInit();
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (e.button === 0) {
    if (UI.placing) {
      if (placeFromQueue(G.players[0], UI.ptx, UI.pty)) { UI.placing = null; } else { toast("Bu yerga qurib bo'lmaydi", 'warn'); }
      return;
    }
    if (UI.sell) { const t = pickAt(x, y); if (t && t.kind === 'b' && t.owner === 0) { sellBuilding(t); sfx('place'); } if (!e.shiftKey) setSell(false); return; }
    if (UI.amode) { command(x, y); UI.amode = false; cv.classList.remove('amode'); return; }
    UI.drag = { x0: x, y0: y, x1: x, y1: y, on: false, shift: e.shiftKey };
  } else if (e.button === 2) {
    if (UI.placing) { UI.placing = null; return; }
    if (UI.sell) { setSell(false); return; }
    if (UI.amode) { UI.amode = false; cv.classList.remove('amode'); return; }
    command(x, y);
  }
});
window.addEventListener('mousemove', e => {
  mouse.px = e.clientX; mouse.py = e.clientY; mouse.inside = true;
  const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  if (UI.drag) { UI.drag.x1 = mouse.x; UI.drag.y1 = mouse.y; if (Math.hypot(UI.drag.x1 - UI.drag.x0, UI.drag.y1 - UI.drag.y0) > 6) UI.drag.on = true; }
});
document.addEventListener('mouseleave', () => { mouse.inside = false; });
window.addEventListener('blur', () => { keys = {}; mouse.inside = false; });
window.addEventListener('mouseup', e => {
  if (e.button !== 0 || !UI.drag) return;
  const d = UI.drag; UI.drag = null;
  if (!running) return;
  if (d.on) {
    const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
    let got = G.list.filter(u => { if (u.dead || u.kind !== 'u' || u.owner !== 0) return false; const p = P(u.x, u.y); return p[0] >= x0 && p[0] <= x1 && p[1] - 6 >= y0 && p[1] - 6 <= y1; });
    if (got.some(u => u.def.weapon)) got = got.filter(u => u.def.weapon);
    if (d.shift) got = [...new Set([...UI.selection.filter(u => u.kind === 'u'), ...got])];
    if (got.length || !d.shift) setSel(got);
    if (got.length) sfx('click');
    return;
  }
  const t = pickAt(d.x0, d.y0), tn = performance.now();
  if (t && t.owner === 0) {
    if (t.kind === 'u' && lastClick.key === t.key && tn - lastClick.t < 350) {
      setSel(G.list.filter(u => { if (u.dead || u.owner !== 0 || u.key !== t.key) return false; const p = P(u.x, u.y); return p[0] > 0 && p[0] < VW && p[1] > 0 && p[1] < VH; }));
    } else if (d.shift && t.kind === 'u') {
      const cur = UI.selection.filter(u => u.kind === 'u');
      setSel(cur.includes(t) ? cur.filter(u => u !== t) : [...cur, t]);
    } else setSel([t]);
    lastClick = { t: tn, key: t.key }; sfx('click');
    if (t.kind === 'b' && (t.key === 'barracks' || t.key === 'factory')) { for (const e of G.list) if (e.key === t.key && e.owner === 0) e.primary = false; t.primary = true; }
  } else if (!d.shift) setSel([]);
});
cv.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('contextmenu', e => { if (e.target.closest('#side')) e.preventDefault(); });

function setSell(v) { UI.sell = v; cv.classList.toggle('sell', v); $('bSell').classList.toggle('on', v); if (v) UI.placing = null; }
function togglePause() { if (!running || G.over) return; paused = !paused; $('pause').classList.toggle('show', paused); $('bPause').classList.toggle('on', paused); }
window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (!running) return;
  if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
  const k = e.key.toLowerCase();
  if (k === 'p') togglePause();
  if (paused || G.over) return;
  if (k === 's') { cmdStop(UI.selection); }
  else if (k === 'a') { if (UI.selection.some(u => u.kind === 'u' && u.def.weapon)) { UI.amode = true; cv.classList.add('amode'); } }
  else if (k === 'h' || k === ' ') { const hq = G.list.find(b => b.owner === 0 && b.key === 'hq') || G.list.find(b => b.owner === 0); if (hq) centerOn(hq.x, hq.y); }
  else if (k === 'escape') { UI.placing = null; UI.amode = false; cv.classList.remove('amode'); setSell(false); setSel([]); }
  else if (k === 'delete') { UI.selection.filter(b => b.kind === 'b').forEach(sellBuilding); setSel([]); }
  else if (k === 'q') setTab('b'); else if (k === 'w') setTab('i'); else if (k === 'e') setTab('v');
  else if (/^[0-9]$/.test(k)) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) { groups[k] = UI.selection.filter(u => u.kind === 'u'); toast(k + '-guruh saqlandi'); }
    else if (groups[k]) {
      const g = groups[k].filter(u => !u.dead); groups[k] = g;
      if (g.length) { if (UI.selection.length === g.length && g.every(u => UI.selection.includes(u))) centerOn(g[0].x, g[0].y); setSel(g); }
    }
  }
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

// ---- Mini-xarita ----
let miniTerr = null, miniT = 0;
function drawMini() {
  if (!miniTerr) miniTerr = document.createElement('canvas');
  const W = mini.width, H = mini.height, s = W / (2 * N);
  if (G.tick - miniT > 60 || miniTerr.width !== W) {
    miniT = G.tick; miniTerr.width = W; miniTerr.height = H; const c = miniTerr.getContext('2d');
    const col = ['#3c5a2a', '#1f5a85', '#55524e', '#a8975c'];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x; c.fillStyle = G.ore[i] > 0 ? '#e0b02a' : col[G.terr[i]];
      c.fillRect((x - y + N - 1) * s, (x + y) * s / 2 * 1, s * 2 + 0.5, s + 0.5);
    }
  }
  mctx.fillStyle = '#05070a'; mctx.fillRect(0, 0, W, H); mctx.drawImage(miniTerr, 0, 0);
  for (let i = 0; i < N * N; i++) {
    if (G.vis[i]) continue;
    const x = i % N, y = (i / N) | 0;
    mctx.fillStyle = G.exp[i] ? 'rgba(5,7,10,0.5)' : '#05070a';
    mctx.fillRect((x - y + N - 1) * s, (x + y) * s / 2, s * 2 + 0.5, s + 0.5);
  }
  for (const e of G.list) {
    if (e.dead) continue;
    const ti = (e.y | 0) * N + (e.x | 0);
    if (e.owner !== 0 && !(e.kind === 'b' ? G.exp[ti] : G.vis[ti])) continue;
    mctx.fillStyle = COLORS[e.owner].main; const z = e.kind === 'b' ? e.def.w * s * 1.3 + 1 : 2.5;
    mctx.fillRect((e.x - e.y + N) * s - z / 2, (e.x + e.y) * s / 2 - z / 2, z, z);
  }
  const p = G.players[0];
  if (G.time - p.alertT < 6 && (G.time * 4 | 0) % 2) { mctx.strokeStyle = '#fff'; mctx.lineWidth = 2; mctx.beginPath(); mctx.arc((p.alertX - p.alertY + N) * s, (p.alertX + p.alertY) * s / 2, 8, 0, 7); mctx.stroke(); }
  mctx.strokeStyle = '#fff'; mctx.lineWidth = 1;
  mctx.strokeRect(cam.x / 32 * s + N * s + 0.5, cam.y / 32 * s + 0.5, VW / 32 * s, VH / 32 * s);
}
let miniDrag = false;
function miniGo(e) {
  const r = mini.getBoundingClientRect(), s = r.width / (2 * N), mx = e.clientX - r.left, my = e.clientY - r.top;
  cam.x = (mx - N * s) / s * 32 - VW / 2; cam.y = my / s * 32 - VH / 2; clampCam();
}
mini.addEventListener('mousedown', e => { if (!running) return; if (e.button === 0) { miniDrag = true; miniGo(e); } else if (e.button === 2) {
  const r = mini.getBoundingClientRect(), s = r.width / (2 * N), X = (e.clientX - r.left - N * s) / s, Y = (e.clientY - r.top) / s * 2;
  const units = UI.selection.filter(u => u.kind === 'u'); if (units.length) { cmdMove(units, (X + Y) / 2, (Y - X) / 2, false); sfx('ack'); } } });
window.addEventListener('mousemove', e => { if (miniDrag) miniGo(e); });
window.addEventListener('mouseup', () => { miniDrag = false; });

// ---- Yon panel ----
function buildSide() {
  const grid = $('grid'); grid.innerHTML = ''; buttons.length = 0;
  for (const cat of ['b', 'i', 'v']) for (const key of BUILD_LIST[cat]) {
    const d = DEF(key), el = document.createElement('button');
    el.className = 'item'; el.dataset.cat = cat;
    const ic = makeIcon(key); ic.className = 'icon';
    el.appendChild(ic);
    el.insertAdjacentHTML('beforeend', `<span class="prog"></span><span class="nm">${d.name}</span><span class="cost">${d.cost}</span><span class="cnt"></span><span class="rdy">TAYYOR</span>`);
    const need = d.req.filter(r => r !== 'hq').map(r => BDEF[r].name).join(', ');
    el.title = `${d.name} — ${d.cost}\n${d.desc}` + (need ? `\nKerak: ${need}` : '') + (d.power ? `\nEnergiya: ${d.power > 0 ? '+' : ''}${d.power}` : '');
    el.addEventListener('mousedown', ev => {
      if (!running || paused || G.over) return;
      audioInit(); const p = G.players[0], q = p.q[cat];
      if (ev.button === 2) { if (cancelItem(p, cat, key)) { if (UI.placing === key) UI.placing = null; sfx('click'); } return; }
      if (cat === 'b' && q.items[0] === key) { if (q.ready) { UI.placing = key; setSell(false); sfx('click'); } return; }
      if (!avail(p, key)) { toast(need ? 'Avval kerak: ' + need : "Ishlab chiqaruvchi bino yo'q", 'warn'); return; }
      if (enqueue(p, key)) sfx('click'); else toast(cat === 'b' ? 'Avval joriy qurilishni tugating' : "Navbat to'la", 'warn');
    });
    grid.appendChild(el); buttons.push({ el, key, cat, prog: el.querySelector('.prog'), cnt: el.querySelector('.cnt') });
  }
  setTab('b');
}
function setTab(t) {
  tab = t;
  for (const b of document.querySelectorAll('.tab')) b.classList.toggle('on', b.dataset.tab === t);
  for (const b of buttons) b.el.style.display = b.cat === t ? '' : 'none';
}
let shownCredits = 0;
function refreshSide() {
  const p = G.players[0];
  shownCredits += (p.credits - shownCredits) * 0.3; if (Math.abs(p.credits - shownCredits) < 1) shownCredits = p.credits;
  $('credits').textContent = Math.floor(shownCredits).toLocaleString('ru-RU');
  $('powTxt').textContent = `${p.powerUse} / ${p.powerProd}`;
  const m = Math.max(p.powerProd, p.powerUse, 1);
  $('powProd').style.width = p.powerProd / m * 100 + '%'; $('powUse').style.width = p.powerUse / m * 100 + '%';
  $('power').classList.toggle('low', p.low);
  for (const b of buttons) {
    const q = p.q[b.cat], head = q.items[0] === b.key; let n = 0; for (const k of q.items) if (k === b.key) n++;
    b.el.classList.toggle('locked', !avail(p, b.key));
    b.el.classList.toggle('ready', head && q.ready);
    b.el.classList.toggle('busy', head && !q.ready);
    b.prog.style.height = (head ? (q.ready ? 0 : (1 - q.prog) * 100) : n ? 100 : 0) + '%';
    b.cnt.textContent = n > 1 || (n && !head) ? n : '';
  }
  for (const t of document.querySelectorAll('.tab')) { const q = p.q[t.dataset.tab]; t.classList.toggle('act', q.items.length > 0); t.classList.toggle('rdy', q.ready); }
  refreshInfo();
}
function refreshInfo() {
  UI.selection = UI.selection.filter(e => !e.dead);
  const s = UI.selection, el = $('info');
  if (!s.length) { el.innerHTML = '<span class="dim">Hech narsa tanlanmagan</span>'; return; }
  if (s.length === 1) {
    const e = s[0];
    let x = `<b>${e.def.name}</b><span class="hp"><i style="width:${e.hp / e.max * 100}%"></i></span><span class="dim">${Math.ceil(e.hp)} / ${e.max}`;
    if (e.def.harvester) x += ` · yuk ${Math.round(e.load)}/${e.def.cap}`;
    if (e.primary) x += ' · asosiy';
    el.innerHTML = x + '</span>';
  } else {
    const c = {}; for (const e of s) c[e.def.name] = (c[e.def.name] || 0) + 1;
    el.innerHTML = `<b>${s.length} ta birlik</b><span class="dim">${Object.entries(c).map(([k, v]) => `${k} ×${v}`).join(', ')}</span>`;
  }
}

// ---- Asosiy sikl ----
let lastT = 0, acc = 0, frameN = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  if (!running) return;
  const dt = Math.min(0.1, (ts - lastT) / 1000); lastT = ts;
  if (!paused) {
    acc += dt; let n = 0;
    while (acc >= TICK && n++ < 5) { simTick(); acc -= TICK; }
    if (acc > TICK) acc = 0;
    updateCam(dt);
  }
  if (UI.placing) {
    const q = G.players[0].q.b;
    if (!q.ready || q.items[0] !== UI.placing) UI.placing = null;
    else { const w = s2w(mouse.x, mouse.y), d = BDEF[UI.placing]; UI.ptx = Math.round(w.x - d.w / 2); UI.pty = Math.round(w.y - d.h / 2); }
  }
  UI.selection = UI.selection.filter(e => !e.dead);
  render(UI);
  if (frameN++ % 6 === 0) { refreshSide(); drawMini(); }
  if (G.over && !$('end').classList.contains('show')) endGame();
}
function endGame() {
  const win = G.over === 'win', p = G.players[0], m = Math.floor(G.time / 60), s = Math.floor(G.time % 60);
  $('endTitle').textContent = win ? "G'ALABA!" : "MAG'LUBIYAT";
  $('end').classList.toggle('lose', !win);
  $('endStats').innerHTML = `Vaqt: <b>${m}:${String(s).padStart(2, '0')}</b> &nbsp;·&nbsp; Yo'q qilindi: <b>${p.kills}</b> &nbsp;·&nbsp; Yo'qotildi: <b>${p.lost}</b>`;
  $('end').classList.add('show'); UI.placing = null; setSel([]);
}
function startGame(diff) {
  audioInit(); if (Snd.ac && Snd.ac.state === 'suspended') Snd.ac.resume();
  newGame(diff);
  buildTerrain(); miniTerr = null; miniT = -999;
  UI.selection = []; UI.placing = null; groups = {}; paused = false; shownCredits = G.players[0].credits;
  $('menu').classList.remove('show'); $('end').classList.remove('show'); $('pause').classList.remove('show'); $('bPause').classList.remove('on');
  resize(); const hq = G.list.find(e => e.owner === 0 && e.key === 'hq'); centerOn(hq.x, hq.y);
  running = true; lastT = performance.now(); acc = 0;
  toast("Elektr stansiya quring, so'ng ruda zavodi", 'ok');
}

let diffSel = 1;
for (const b of document.querySelectorAll('.diff')) b.addEventListener('click', () => { diffSel = +b.dataset.d; document.querySelectorAll('.diff').forEach(x => x.classList.toggle('on', x === b)); });
$('start').addEventListener('click', () => startGame(diffSel));
$('again').addEventListener('click', () => { running = false; $('end').classList.remove('show'); $('menu').classList.add('show'); });
for (const t of document.querySelectorAll('.tab')) t.addEventListener('click', () => setTab(t.dataset.tab));
$('bSell').addEventListener('click', () => { if (running) setSell(!UI.sell); });
$('bPause').addEventListener('click', togglePause);
$('bSound').addEventListener('click', () => { Snd.muted = !Snd.muted; $('bSound').classList.toggle('on', Snd.muted); $('bSound').textContent = Snd.muted ? 'Ovoz yoq.' : 'Ovoz'; });
$('bMenu').addEventListener('click', () => { if (running && confirm("O'yinni tugatib, menyuga qaytasizmi?")) { running = false; paused = false; $('pause').classList.remove('show'); $('menu').classList.add('show'); } });
window.addEventListener('resize', () => { resize(); if (G) clampCam(); });
buildSide(); resize(); requestAnimationFrame(frame);
