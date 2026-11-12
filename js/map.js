'use strict';
// ---- Xarita yaratish (nuqtaviy simmetrik) va yo'l topish ----
function genMap(seed) {
  const rnd = mulberry32(seed);
  const terr = new Uint8Array(N * N), ore = new Uint16Array(N * N);
  const n1 = makeNoise(rnd, 7), n2 = makeNoise(rnd, 15);
  const hs = new Float32Array(N * N), sorted = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, m = (N - 1 - y) * N + (N - 1 - x);
    if (i > m) continue;
    hs[i] = 0.65 * n1(x / N * 7, y / N * 7) + 0.35 * n2(x / N * 15, y / N * 15);
    sorted.push(hs[i]);
  }
  sorted.sort((a, b) => a - b);
  const q = p => sorted[Math.floor(sorted.length * p)];
  const tw = q(0.11), ts = q(0.16), tr = q(0.92);
  for (let i = 0; i < N * N; i++) {
    const m = N * N - 1 - i;
    if (i > m) { terr[i] = terr[m]; continue; }
    const h = hs[i];
    terr[i] = h < tw ? T_WATER : h < ts ? T_SAND : h > tr ? T_ROCK : T_GRASS;
  }
  const set = (x, y, fn) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    const i = y * N + x; fn(i); fn(N * N - 1 - i);
  };
  const base = { x: 11.5, y: N - 11.5 };
  for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++)
    if (dx * dx + dy * dy <= 90) set(base.x + dx, base.y + dy, i => { terr[i] = T_GRASS; });
  const fields = [];
  const addField = (cx, cy, r) => {
    fields.push({ x: cx, y: cy }, { x: N - cx, y: N - cy });
    for (let dy = -r - 1; dy <= r + 1; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) {
      const d = Math.hypot(dx, dy) + (rnd() - 0.5) * 1.2;
      if (d > r) continue;
      const amt = Math.round(350 + (1 - d / r) * 500 + rnd() * 250);
      set(cx + dx, cy + dy, i => { terr[i] = T_GRASS; ore[i] = amt; });
    }
  };
  addField(base.x + 10, base.y + 3, 3.6);
  addField(base.x - 3, base.y - 12, 3.4);
  addField(N / 2, N / 2, 4.5);
  let placed = 0, guard = 0;
  while (placed < 3 && guard++ < 200) {
    const x = 6 + rnd() * (N - 12), y = 6 + rnd() * (N - 12);
    if (Math.hypot(x - base.x, y - base.y) < 20 || Math.hypot(N - x - base.x, N - y - base.y) < 20) continue;
    if (fields.some(f => Math.hypot(f.x - x, f.y - y) < 11)) continue;
    addField(x, y, 3.2); placed++;
  }
  return { terr, ore, fields, seed };
}

function inMap(x, y) { return x >= 0 && y >= 0 && x < N && y < N; }
function passable(x, y) {
  if (x < 0 || y < 0 || x >= N || y >= N) return false;
  const i = y * N + x, t = G.terr[i];
  return t !== T_WATER && t !== T_ROCK && G.occ[i] === 0;
}

// ---- A* ----
const _gs = new Float32Array(N * N), _fs = new Float32Array(N * N), _pr = new Int32Array(N * N);
const _seen = new Uint32Array(N * N), _closed = new Uint32Array(N * N);
let _stamp = 0, pathReached = false;
const _heap = [];
function hpush(n) {
  let i = _heap.length; _heap.push(n);
  while (i > 0) { const p = (i - 1) >> 1; if (_fs[_heap[p]] <= _fs[n]) break; _heap[i] = _heap[p]; i = p; }
  _heap[i] = n;
}
function hpop() {
  const top = _heap[0], last = _heap.pop(), len = _heap.length;
  if (len) {
    let i = 0;
    for (;;) {
      let c = i * 2 + 1; if (c >= len) break;
      if (c + 1 < len && _fs[_heap[c + 1]] < _fs[_heap[c]]) c++;
      if (_fs[_heap[c]] >= _fs[last]) break;
      _heap[i] = _heap[c]; i = c;
    }
    _heap[i] = last;
  }
  return top;
}
function los(ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay), steps = Math.ceil(d * 5) || 1, m = 0.3;
  for (let s = 0; s <= steps; s++) {
    const x = ax + (bx - ax) * s / steps, y = ay + (by - ay) * s / steps;
    if (!passable((x - m) | 0, (y - m) | 0) || !passable((x + m) | 0, (y - m) | 0) ||
      !passable((x - m) | 0, (y + m) | 0) || !passable((x + m) | 0, (y + m) | 0)) return false;
  }
  return true;
}
function findPath(sx, sy, gx, gy, reach) {
  reach = reach || 0;
  gx = clamp(gx, 0.01, N - 0.01); gy = clamp(gy, 0.01, N - 0.01);
  const stx = clamp(sx | 0, 0, N - 1), sty = clamp(sy | 0, 0, N - 1), gtx = gx | 0, gty = gy | 0;
  _stamp++; _heap.length = 0;
  const hfn = (x, y) => { const dx = Math.abs(x + 0.5 - gx), dy = Math.abs(y + 0.5 - gy); return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy); };
  const start = sty * N + stx;
  _gs[start] = 0; _fs[start] = hfn(stx, sty); _pr[start] = -1; _seen[start] = _stamp; hpush(start);
  let best = start, bestH = _fs[start], found = -1;
  while (_heap.length) {
    const cur = hpop();
    if (_closed[cur] === _stamp) continue;
    _closed[cur] = _stamp;
    const cx = cur % N, cy = (cur / N) | 0;
    if (reach > 0 ? Math.hypot(cx + 0.5 - gx, cy + 0.5 - gy) <= reach : (cx === gtx && cy === gty)) { found = cur; break; }
    const hh = hfn(cx, cy);
    if (hh < bestH) { bestH = hh; best = cur; }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (!passable(nx, ny)) continue;
      if (dx && dy && (!passable(cx + dx, cy) || !passable(cx, cy + dy))) continue;
      const n = ny * N + nx;
      if (_closed[n] === _stamp) continue;
      const ng = _gs[cur] + (dx && dy ? 1.4142 : 1);
      if (_seen[n] !== _stamp || ng < _gs[n]) {
        _seen[n] = _stamp; _gs[n] = ng; _fs[n] = ng + hfn(nx, ny); _pr[n] = cur; hpush(n);
      }
    }
  }
  pathReached = found >= 0;
  const pts = [];
  for (let n = found >= 0 ? found : best; n !== start && n >= 0; n = _pr[n]) pts.push({ x: n % N + 0.5, y: ((n / N) | 0) + 0.5 });
  pts.reverse();
  if (found >= 0 && reach === 0 && pts.length) pts[pts.length - 1] = { x: gx, y: gy };
  // yo'lni silliqlash
  const out = []; let ax = sx, ay = sy, idx = 0;
  while (idx < pts.length) {
    let j = Math.min(pts.length - 1, idx + 14);
    while (j > idx && !los(ax, ay, pts[j].x, pts[j].y)) j--;
    out.push(pts[j]); ax = pts[j].x; ay = pts[j].y; idx = j + 1;
  }
  return out;
}
