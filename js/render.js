'use strict';
// ---- Izometrik chizish ----
let ctx = null, cam = { x: 0, y: 0 }, VW = 800, VH = 600, now = 0;
const _shade = {};
function shade(hex, f) {
  const k = hex + f; if (_shade[k]) return _shade[k];
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255;
  if (f <= 1) { r *= f; g *= f; b *= f; } else { const t = f - 1; r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; }
  return _shade[k] = `rgb(${r | 0},${g | 0},${b | 0})`;
}
const P = (x, y, z) => [(x - y) * 32 - cam.x, (x + y) * 16 - (z || 0) - cam.y];
function s2w(sx, sy) { const X = (sx + cam.x) / 32, Y = (sy + cam.y) / 16; return { x: (X + Y) / 2, y: (Y - X) / 2 }; }
function poly(pts, fill) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
function prism(pts, z0, z1, col, topCol) {
  let cx = 0, cy = 0; const n = pts.length;
  for (const p of pts) { cx += p[0]; cy += p[1]; } cx /= n; cy /= n;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy;
    if (mx + my <= 0.0001) continue;
    poly([P(a[0], a[1], z0), P(b[0], b[1], z0), P(b[0], b[1], z1), P(a[0], a[1], z1)], shade(col, my > mx ? 0.82 : 0.6));
  }
  poly(pts.map(p => P(p[0], p[1], z1)), topCol || col);
}
const box = (x0, y0, x1, y1, z0, z1, col, top) => prism([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1, col, top);
function rrect(cx, cy, hl, hw, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [[cx + c * hl - s * hw, cy + s * hl + c * hw], [cx - c * hl - s * hw, cy - s * hl + c * hw], [cx - c * hl + s * hw, cy - s * hl - c * hw], [cx + c * hl + s * hw, cy + s * hl - c * hw]];
}
function cyl(x, y, r, z0, z1, col) {
  const a = P(x, y, z0), b = P(x, y, z1), rx = r * 45.25, ry = r * 22.6;
  const g = ctx.createLinearGradient(a[0] - rx, 0, a[0] + rx, 0);
  g.addColorStop(0, shade(col, 0.9)); g.addColorStop(0.5, shade(col, 0.72)); g.addColorStop(1, shade(col, 0.5));
  ctx.fillStyle = g; ctx.beginPath();
  ctx.ellipse(a[0], a[1], rx, ry, 0, 0, Math.PI); ctx.lineTo(b[0] - rx, b[1]); ctx.lineTo(b[0] + rx, b[1]); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(b[0], b[1], rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}
function line3(x0, y0, z0, x1, y1, z1, col, w) {
  const a = P(x0, y0, z0), b = P(x1, y1, z1);
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
}
function barrel(x, y, a, len, z, z2, w) {
  line3(x, y, z, x + Math.cos(a) * len, y + Math.sin(a) * len, z2 == null ? z : z2, '#23272d', w || 3);
}

// ---- Relyef (oldindan chiziladi) ----
let terrCv = null; const TPAD = 48;
function buildTerrain() {
  terrCv = document.createElement('canvas'); terrCv.width = N * TW; terrCv.height = N * TH + TPAD + 8;
  const c = terrCv.getContext('2d'), ox = N * TW / 2, oy = TPAD, rnd = mulberry32(G.terr[77] * 31 + 7), nz = makeNoise(rnd, 10);
  const dia = (cx, cy, e) => { c.beginPath(); c.moveTo(cx, cy - e); c.lineTo(cx + 32 + e * 2, cy + 16); c.lineTo(cx, cy + 32 + e); c.lineTo(cx - 32 - e * 2, cy + 16); c.closePath(); c.fill(); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const t = G.terr[y * N + x], cx = (x - y) * 32 + ox, cy = (x + y) * 16 + oy;
    const v = nz(x / N * 10, y / N * 10) + (rnd() - 0.5) * 0.22;
    c.fillStyle = t === T_GRASS ? `hsl(${88 + v * 22},${30 + v * 8}%,${23 + v * 9}%)` : t === T_SAND ? `hsl(44,36%,${50 + v * 8}%)` :
      t === T_WATER ? `hsl(203,58%,${25 + v * 7}%)` : `hsl(30,9%,${32 + v * 7}%)`;
    dia(cx, cy, 0.6);
    if (t === T_GRASS || t === T_SAND) {
      c.fillStyle = t === T_GRASS ? 'rgba(20,40,12,0.35)' : 'rgba(110,90,40,0.3)';
      for (let k = 0; k < 4; k++) { const u = rnd(), w = rnd(); c.fillRect(cx + (u - w) * 28, cy + (u + w) * 14 + 2, 2, 1.5); }
    } else if (t === T_WATER) {
      c.strokeStyle = 'rgba(190,225,255,0.16)'; c.lineWidth = 1;
      for (let k = 0; k < 2; k++) { const px = cx + (rnd() - 0.5) * 30, py = cy + 8 + rnd() * 16; c.beginPath(); c.moveTo(px - 5, py); c.quadraticCurveTo(px, py - 2, px + 5, py); c.stroke(); }
    }
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (G.terr[y * N + x] !== T_ROCK) continue;
    const cx = (x - y) * 32 + ox, cy = (x + y) * 16 + oy + 16;
    for (let k = 0; k < 2; k++) {
      const bx = cx + (rnd() - 0.5) * 26, by = cy + (rnd() - 0.5) * 12, r = 9 + rnd() * 9, h = 6 + rnd() * 12, pts = [];
      for (let a = 0; a < 7; a++) { const an = a / 7 * 6.283, rr = r * (0.75 + rnd() * 0.4); pts.push([Math.cos(an) * rr, Math.sin(an) * rr * 0.55]); }
      const blob = (dy, sc, col) => { c.fillStyle = col; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(bx + p[0] * sc, by + dy + p[1] * sc) : c.moveTo(bx + p[0] * sc, by + dy + p[1] * sc)); c.closePath(); c.fill(); };
      blob(2, 1.1, 'rgba(0,0,0,0.25)'); blob(0, 1, '#4d4a47');
      c.fillStyle = '#5d5a56'; c.fillRect(bx - r * 0.7, by - h, r * 1.4, h);
      blob(-h, 0.82, '#8b8780'); blob(-h - 1, 0.5, '#a39f97');
    }
  }
}

// ---- Binolar ----
function drawBuilding(e, alpha) {
  const d = e.def, x = e.tx, y = e.ty, w = d.w, h = d.h, c = COLORS[e.owner], k = clamp((now - e.born) / 0.7, 0.05, 1);
  const B = (x0, y0, x1, y1, z0, z1, col, top) => box(x + x0, y + y0, x + x1, y + y1, z0 * k, z1 * k, col, top);
  const wall = '#9aa1ab', dk = '#6b7078';
  B(0.04, 0.04, w - 0.04, h - 0.04, 0, 4, '#5d636b');
  switch (e.key) {
    case 'hq':
      B(0.3, 0.3, 2.7, 1.9, 4, 34, wall); B(1.5, 0.5, 2.5, 1.7, 34, 38, c.dark, c.main);
      B(0.5, 0.5, 1.3, 1.3, 34, 62, c.main); B(0.3, 1.9, 1.7, 2.7, 4, 22, '#868d97'); B(0.45, 2.05, 1.55, 2.55, 22, 25, c.dark);
      line3(x + 0.9, y + 0.9, 62 * k, x + 0.9, y + 0.9, 86 * k, '#30343a', 2);
      if (k === 1 && (now * 2 | 0) % 2) { const p = P(x + 0.9, y + 0.9, 87); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(p[0], p[1], 2.5, 0, 7); ctx.fill(); }
      break;
    case 'power':
      B(0.2, 0.2, 1.05, 1.8, 4, 22, wall); B(0.3, 0.3, 0.95, 1.7, 22, 25, c.dark, c.main);
      cyl(x + 1.5, y + 0.6, 0.3, 4 * k, 36 * k, '#c3c8cf'); cyl(x + 1.5, y + 1.42, 0.3, 4 * k, 36 * k, '#c3c8cf');
      if (k === 1) for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
        const t = (now * 0.5 + j / 3 + i * 0.17) % 1, p = P(x + 1.5, y + 0.6 + i * 0.82, 38 + t * 30);
        ctx.fillStyle = `rgba(235,240,245,${0.35 * (1 - t)})`; ctx.beginPath(); ctx.arc(p[0] + Math.sin(t * 5 + i) * 3, p[1], 5 + t * 7, 0, 7); ctx.fill();
      }
      break;
    case 'refinery':
      B(0.2, 0.2, 1.8, 1.6, 4, 30, wall); B(0.3, 0.3, 1.7, 1.5, 30, 33, c.dark, c.main); B(0.4, 0.4, 0.7, 0.7, 33, 54, dk);
      cyl(x + 2.35, y + 0.85, 0.38, 4 * k, 40 * k, '#d1a92c');
      poly([P(x + 0.4, y + 1.9, 4.2), P(x + 2.6, y + 1.9, 4.2), P(x + 2.6, y + 2.8, 4.2), P(x + 0.4, y + 2.8, 4.2)], '#3a3f46');
      ctx.strokeStyle = '#e6b422'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath();
      [[0.5, 2.0], [2.5, 2.0], [2.5, 2.7], [0.5, 2.7], [0.5, 2.0]].forEach((q, i) => { const p = P(x + q[0], y + q[1], 4.4); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
      ctx.stroke(); ctx.setLineDash([]);
      break;
    case 'barracks':
      B(0.2, 0.2, 1.8, 1.8, 4, 18, '#8d9480'); B(0.2, 0.55, 1.8, 1.45, 18, 25, c.dark, c.main);
      poly([P(x + 0.8, y + 1.8, 4 * k), P(x + 1.2, y + 1.8, 4 * k), P(x + 1.2, y + 1.8, 15 * k), P(x + 0.8, y + 1.8, 15 * k)], '#2a2e33');
      line3(x + 1.65, y + 1.65, 4 * k, x + 1.65, y + 1.65, 42 * k, '#30343a', 1.5);
      { const p = P(x + 1.65, y + 1.65, 42 * k), wv = Math.sin(now * 4) * 2; poly([p, [p[0] + 13, p[1] + 3 + wv], [p[0], p[1] + 9]], c.main); }
      break;
    case 'factory':
      B(0.2, 0.2, 2.8, 2.1, 4, 30, wall);
      for (let i = 0; i < 4; i++) B(0.35 + i * 0.62, 0.3, 0.75 + i * 0.62, 2.0, 30, 33, c.dark, c.main);
      poly([P(x + 0.9, y + 2.1, 4 * k), P(x + 2.1, y + 2.1, 4 * k), P(x + 2.1, y + 2.1, 23 * k), P(x + 0.9, y + 2.1, 23 * k)], '#22262b');
      for (let i = 1; i < 4; i++) line3(x + 0.9, y + 2.1, (4 + i * 5) * k, x + 2.1, y + 2.1, (4 + i * 5) * k, '#3a4048', 1);
      poly([P(x + 0.8, y + 2.15, 4.2), P(x + 2.2, y + 2.15, 4.2), P(x + 2.2, y + 2.85, 4.2), P(x + 0.8, y + 2.85, 4.2)], '#3a3f46');
      break;
    case 'radar': {
      B(0.3, 0.3, 1.7, 1.7, 4, 16, wall); B(0.45, 0.45, 1.55, 1.55, 16, 18, c.dark, c.main);
      line3(x + 1, y + 1, 18 * k, x + 1, y + 1, 40 * k, '#30343a', 3);
      const p = P(x + 1, y + 1, 44 * k), cs = Math.cos(now * 1.6);
      ctx.fillStyle = cs > 0 ? '#dfe3e8' : '#9aa1ab'; ctx.beginPath(); ctx.ellipse(p[0], p[1], Math.abs(cs) * 16 + 3, 15, 0, 0, 7); ctx.fill();
      ctx.fillStyle = c.main; ctx.beginPath(); ctx.arc(p[0] + cs * 5, p[1], 3, 0, 7); ctx.fill();
      break;
    }
    case 'turret': {
      const oct = []; for (let i = 0; i < 8; i++) oct.push([e.x + Math.cos(i * 0.785 + 0.39) * 0.4, e.y + Math.sin(i * 0.785 + 0.39) * 0.4]);
      prism(oct, 0, 11 * k, '#7a808a');
      barrel(e.x, e.y, e.aim, 0.62, 16 * k, 16 * k, 4);
      prism(rrect(e.x, e.y, 0.24, 0.2, e.aim), 11 * k, 20 * k, c.dark, c.main);
      if (e.flash > 0) { const p = P(e.x + Math.cos(e.aim) * 0.7, e.y + Math.sin(e.aim) * 0.7, 16); ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(p[0], p[1], 6, 0, 7); ctx.fill(); }
      break;
    }
    case 'techlab': {
      B(0.2, 0.2, 1.8, 1.8, 4, 20, '#aab1bb'); B(0.3, 0.3, 1.7, 1.7, 20, 22, c.dark, c.main);
      const p = P(x + 1, y + 1, 22 * k), g = ctx.createRadialGradient(p[0] - 7, p[1] - 14, 2, p[0], p[1] - 6, 26);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, c.light); g.addColorStop(1, c.dark);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p[0], p[1], 24, 12, 0, 0, Math.PI); ctx.ellipse(p[0], p[1], 24, 24 * k, 0, Math.PI, Math.PI * 2); ctx.fill();
      break;
    }
  }
}

// ---- Birliklar ----
function drawUnit(u) {
  const d = u.def, c = COLORS[u.owner], x = u.x, y = u.y, s = P(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(s[0], s[1] + 1, d.r * 44, d.r * 22, 0, 0, 7); ctx.fill();
  if (d.cls === 'inf') {
    const bob = u.moving ? Math.abs(Math.sin(now * 12 + u.id)) * 1.5 : 0, sx = s[0], sy = s[1] - bob;
    const vx = Math.cos(u.aim) - Math.sin(u.aim), vy = (Math.cos(u.aim) + Math.sin(u.aim)) / 2, vl = Math.hypot(vx, vy) || 1;
    ctx.fillStyle = '#2b2f36'; ctx.fillRect(sx - 2.5, sy - 5, 2, 5); ctx.fillRect(sx + 0.5, sy - 5, 2, 5);
    ctx.fillStyle = c.main; ctx.fillRect(sx - 3, sy - 12, 6, 7.5);
    ctx.fillStyle = '#e3b98f'; ctx.beginPath(); ctx.arc(sx, sy - 14.5, 2.6, 0, 7); ctx.fill();
    ctx.fillStyle = c.dark; ctx.beginPath(); ctx.arc(sx, sy - 15, 2.8, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = u.key === 'rocket' ? '#59616b' : '#1c1f24'; ctx.lineWidth = u.key === 'rocket' ? 3 : 1.6; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(sx - vx / vl * 2, sy - 10 - vy / vl * 2); ctx.lineTo(sx + vx / vl * 8, sy - 10 + vy / vl * 8); ctx.stroke();
    if (u.flash > 0) { ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(sx + vx / vl * 10, sy - 10 + vy / vl * 10, 3, 0, 7); ctx.fill(); }
    return;
  }
  const a = u.dir, ca = Math.cos(a), sa = Math.sin(a);
  if (u.key === 'harvester') {
    prism(rrect(x, y, 0.46, 0.3, a), 0, 5, '#30343a');
    prism(rrect(x - ca * 0.1, y - sa * 0.1, 0.33, 0.27, a), 5, 17, '#c9a227', u.load > 0 ? shade('#f2c230', 0.6 + 0.4 * u.load / d.cap) : '#8f7a2e');
    prism(rrect(x + ca * 0.32, y + sa * 0.32, 0.11, 0.24, a), 5, 14, c.dark, c.main);
    return;
  }
  const S = { scout: [0.3, 0.19, 0.12, 0.1, 0.4], tank: [0.37, 0.26, 0.17, 0.14, 0.52], heavy: [0.45, 0.32, 0.21, 0.18, 0.6], artillery: [0.4, 0.25, 0.15, 0.13, 0.75] }[u.key];
  prism(rrect(x, y, S[0], S[1], a), 0, 4, u.key === 'scout' ? '#25282d' : '#33373d');
  prism(rrect(x, y, S[0] * 0.92, S[1] * 0.76, a), 4, 9, c.hull);
  const ta = u.aim, tx = x - ca * 0.04, ty = y - sa * 0.04;
  const drawBarrels = () => {
    if (u.key === 'heavy') { const ox = -Math.sin(ta) * 0.07, oy = Math.cos(ta) * 0.07; barrel(tx + ox, ty + oy, ta, S[4], 12); barrel(tx - ox, ty - oy, ta, S[4], 12); }
    else if (u.key === 'artillery') barrel(tx, ty, ta, S[4], 11, 24, 3.5);
    else barrel(tx, ty, ta, S[4], 12, 12, u.key === 'scout' ? 2 : 3);
  };
  const front = Math.cos(ta) + Math.sin(ta) > 0;
  if (!front) drawBarrels();
  prism(rrect(tx, ty, S[2], S[3], ta), 9, 14, c.dark, c.main);
  if (front) drawBarrels();
  if (u.flash > 0) { const p = P(tx + Math.cos(ta) * (S[4] + 0.08), ty + Math.sin(ta) * (S[4] + 0.08), u.key === 'artillery' ? 25 : 12); ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(p[0], p[1], u.key === 'scout' ? 3 : 6, 0, 7); ctx.fill(); }
}
function hpBar(e, sel) {
  const big = e.kind === 'b', w = big ? e.def.w * 22 : e.def.cls === 'inf' ? 16 : 26, p = P(e.x, e.y, big ? 30 + e.def.w * 12 : e.def.cls === 'inf' ? 22 : 24), f = clamp(e.hp / e.max, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(p[0] - w / 2 - 1, p[1] - 1, w + 2, 5);
  ctx.fillStyle = f > 0.5 ? '#4ade80' : f > 0.25 ? '#facc15' : '#ef4444'; ctx.fillRect(p[0] - w / 2, p[1], w * f, 3);
  if (sel && e.def.harvester) { ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(p[0] - w / 2 - 1, p[1] + 4, w + 2, 4); ctx.fillStyle = '#f2c230'; ctx.fillRect(p[0] - w / 2, p[1] + 5, w * e.load / e.def.cap, 2); }
}

// ---- Asosiy kadr ----
let fogCv = null, fogCx = null;
function render(ui) {
  now = G.time;
  ctx.fillStyle = '#07090c'; ctx.fillRect(0, 0, VW, VH);
  const sx0 = Math.max(0, cam.x + N * 32), sy0 = Math.max(0, cam.y + TPAD);
  ctx.drawImage(terrCv, sx0, sy0, VW, VH, sx0 - cam.x - N * 32, sy0 - cam.y - TPAD, VW, VH);
  const onScr = (x, y, m) => { const sx = (x - y) * 32 - cam.x, sy = (x + y) * 16 - cam.y; return sx > -m && sx < VW + m && sy > -m && sy < VH + m; };
  // ruda
  for (let i = 0; i < N * N; i++) {
    const a = G.ore[i]; if (a <= 0 || !G.exp[i]) continue;
    const x = i % N, y = (i / N) | 0; if (!onScr(x + 0.5, y + 0.5, 40)) continue;
    const n = 2 + Math.min(4, (a / 220) | 0);
    for (let k = 0; k < n; k++) {
      const u = 0.15 + hash2(i, k) * 0.7, v = 0.15 + hash2(i, k + 9) * 0.7, p = P(x + u, y + v), hgt = 4 + hash2(i, k + 20) * 5;
      poly([[p[0] - 3.5, p[1]], [p[0], p[1] - hgt], [p[0] + 3.5, p[1]], [p[0], p[1] + 2.5]], '#c9951a');
      poly([[p[0] - 3.5, p[1]], [p[0], p[1] - hgt], [p[0], p[1] + 2.5]], '#f7d154');
    }
  }
  // joylashtirish ko'rinishi
  if (ui.placing) {
    const d = BDEF[ui.placing], ok = canPlace(G.players[0], ui.placing, ui.ptx, ui.pty);
    for (let yy = 0; yy < d.h; yy++) for (let xx = 0; xx < d.w; xx++) {
      const x = ui.ptx + xx, y = ui.pty + yy, i = y * N + x;
      const good = ok && inMap(x, y) && passable(x, y) && !G.ore[i];
      poly([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], good ? 'rgba(74,222,128,0.5)' : 'rgba(239,68,68,0.55)');
    }
  }
  // tanlash belgisi
  for (const e of ui.selection) {
    ctx.strokeStyle = '#7dffa0'; ctx.lineWidth = 1.5;
    if (e.kind === 'u') { const p = P(e.x, e.y); ctx.beginPath(); ctx.ellipse(p[0], p[1], e.def.r * 52 + 3, e.def.r * 26 + 2, 0, 0, 7); ctx.stroke(); }
    else {
      const q = [P(e.tx, e.ty), P(e.tx + e.def.w, e.ty), P(e.tx + e.def.w, e.ty + e.def.h), P(e.tx, e.ty + e.def.h)];
      ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.stroke();
      if (e.rally) { const a = P(e.x, e.y), b = P(e.rally.x, e.rally.y); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#7dffa0'; ctx.beginPath(); ctx.arc(b[0], b[1], 4, 0, 7); ctx.fill(); }
    }
  }
  // obyektlar
  const vis = [];
  for (const e of G.list) {
    if (e.dead) continue;
    const ti = (e.y | 0) * N + (e.x | 0);
    if (e.owner !== 0 && !(e.kind === 'b' ? G.exp[ti] : G.vis[ti])) continue;
    if (!onScr(e.x, e.y, 140)) continue;
    vis.push(e);
  }
  vis.sort((a, b) => (a.x + a.y) - (b.x + b.y));
  for (const e of vis) e.kind === 'b' ? drawBuilding(e) : drawUnit(e);
  if (ui.placing) { ctx.globalAlpha = 0.55; drawBuilding({ key: ui.placing, def: BDEF[ui.placing], tx: ui.ptx, ty: ui.pty, x: ui.ptx + BDEF[ui.placing].w / 2, y: ui.pty + BDEF[ui.placing].h / 2, owner: 0, born: -9, aim: 0, flash: 0 }); ctx.globalAlpha = 1; }
  // snaryadlar
  for (const p of G.proj) {
    if (!G.vis[(p.y | 0) * N + (p.x | 0)]) continue;
    const s = P(p.x, p.y, p.z);
    if (p.w.proj === 'arty') { const g = P(p.x, p.y); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(g[0], g[1], 4, 2, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = p.w.proj === 'rocket' ? '#ffb347' : '#ffe9a6'; ctx.beginPath(); ctx.arc(s[0], s[1], p.w.proj === 'arty' ? 3.5 : 2.5, 0, 7); ctx.fill();
  }
  // effektlar
  for (const f of G.fx) {
    if (f.life <= 0) continue;
    const t = 1 - f.life / f.max;
    if (f.t === 'ring') { const p = P(f.x, f.y); ctx.strokeStyle = f.col; ctx.globalAlpha = 1 - t; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p[0], p[1], 6 + t * 16, 3 + t * 8, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; continue; }
    if (!G.vis[(clamp(f.y | 0, 0, N - 1)) * N + clamp(f.x | 0, 0, N - 1)]) continue;
    if (f.t === 'tracer') { const a = P(f.x, f.y, 10), b = P(f.x2, f.y2, 8); ctx.strokeStyle = 'rgba(255,236,160,0.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    else if (f.t === 'boom') {
      const p = P(f.x, f.y, f.z), r = f.size * (0.3 + t * 0.9);
      ctx.globalAlpha = Math.max(0, 1 - t); ctx.fillStyle = t < 0.35 ? '#fff3c4' : t < 0.65 ? '#ff9f2e' : '#5a524a';
      ctx.beginPath(); ctx.arc(p[0], p[1] - t * f.size * 0.5, r, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffcf5c'; ctx.globalAlpha = Math.max(0, 0.8 - t * 1.6); ctx.beginPath(); ctx.arc(p[0], p[1], r * 0.6, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    } else if (f.t === 'smoke') { const p = P(f.x, f.y, f.z); ctx.fillStyle = `rgba(60,60,64,${0.45 * (1 - t)})`; ctx.beginPath(); ctx.arc(p[0], p[1], f.size * (0.6 + t), 0, 7); ctx.fill(); }
  }
  // tuman
  if (!fogCv) { fogCv = document.createElement('canvas'); fogCx = fogCv.getContext('2d'); }
  if (fogCv.width !== Math.ceil(VW / 2) || fogCv.height !== Math.ceil(VH / 2)) { fogCv.width = Math.ceil(VW / 2); fogCv.height = Math.ceil(VH / 2); }
  const fill = (c2, arr, sc) => {
    c2.beginPath();
    for (let i = 0; i < N * N; i++) {
      if (arr[i]) continue;
      const x = i % N, y = (i / N) | 0, cx = ((x - y) * 32 - cam.x) * sc, cy = ((x + y) * 16 - cam.y) * sc;
      if (cx < -40 || cx > VW * sc + 40 || cy < -40 || cy > VH * sc + 8) continue;
      if (sc === 1 && (x === 0 || y === 0)) c2.rect(cx - 35, cy - 34, 70, 50);
      c2.moveTo(cx, cy - 1.5 * sc); c2.lineTo(cx + 35 * sc, cy + 16 * sc); c2.lineTo(cx, cy + 33.5 * sc); c2.lineTo(cx - 35 * sc, cy + 16 * sc); c2.closePath();
    }
    c2.fill();
  };
  fogCx.clearRect(0, 0, fogCv.width, fogCv.height); fogCx.fillStyle = '#000'; fill(fogCx, G.vis, 0.5);
  ctx.globalAlpha = 0.45; ctx.drawImage(fogCv, 0, 0, VW, VH); ctx.globalAlpha = 1;
  ctx.fillStyle = '#05070a'; fill(ctx, G.exp, 1);
  // sog'liq chiziqlari
  for (const e of vis) { const sel = ui.selection.includes(e); if (sel || e.hp < e.max && now - e.hitT < 4) hpBar(e, sel); }
  if (ui.drag && ui.drag.on) { const d = ui.drag; ctx.strokeStyle = '#7dffa0'; ctx.fillStyle = 'rgba(125,255,160,0.1)'; ctx.lineWidth = 1; ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0); ctx.strokeRect(d.x0 + 0.5, d.y0 + 0.5, d.x1 - d.x0, d.y1 - d.y0); }
}

function makeIcon(key) {
  const cv = document.createElement('canvas'); cv.width = 144; cv.height = 108;
  const old = [ctx, cam, now]; ctx = cv.getContext('2d'); now = 0;
  const d = DEF(key);
  if (d.kind === 'b') {
    const sc = d.w === 3 ? 0.62 : d.w === 2 ? 0.9 : 1.9;
    ctx.scale(sc, sc); cam = { x: -72 / sc, y: -(d.w === 1 ? 60 : d.w === 2 ? 66 : 74) / sc + d.w * 16 };
    drawBuilding({ key, def: d, tx: 0, ty: 0, x: d.w / 2, y: d.h / 2, owner: 0, born: -9, aim: 0.6, flash: 0 });
  } else {
    const sc = d.cls === 'inf' ? 3.6 : 2.5; ctx.scale(sc, sc); cam = { x: -72 / sc, y: -(d.cls === 'inf' ? 80 : 64) / sc };
    drawUnit({ key, def: d, x: 0, y: 0, dir: 0.5, aim: 0.5, owner: 0, id: 1, moving: false, flash: 0, load: 300 });
  }
  [ctx, cam, now] = old;
  return cv;
}
