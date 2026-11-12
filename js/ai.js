'use strict';
// ---- Kompyuter raqib ----
const AI_PLAN = [['refinery', 1], ['barracks', 1], ['factory', 1], ['turret', 1], ['refinery', 2], ['radar', 1], ['turret', 2], ['techlab', 1], ['turret', 4], ['refinery', 3]];
function aiInit(p, diff) {
  p.ai = { next: 1, squad: [4, 6, 9][diff], attackAt: [450, 300, 190][diff], speed: [0.85, 1, 1.25][diff], cap: [18, 30, 44][diff], fail: 0, gap: [110, 80, 55][diff] };
  p.income = [0.8, 1, 1.35][diff];
}
function aiFindSpot(p, key, anchor) {
  const d = BDEF[key], enemy = G.list.find(e => e.owner !== p.id && e.key === 'hq') || { x: N / 2, y: N / 2 };
  let ores = null;
  if (key === 'refinery') {
    ores = [];
    for (let i = 0; i < N * N; i++) if (G.ore[i] > 0 && Math.hypot(i % N - anchor.x, ((i / N) | 0) - anchor.y) < 24) ores.push(i);
  }
  const ex = enemy.x - anchor.x, ey = enemy.y - anchor.y, el = Math.hypot(ex, ey) || 1;
  const fx = anchor.x + ex / el * 7, fy = anchor.y + ey / el * 7;
  let best = null, bs = 1e9;
  for (let ty = (anchor.y | 0) - 15; ty <= anchor.y + 15; ty++) for (let tx = (anchor.x | 0) - 15; tx <= anchor.x + 15; tx++) {
    if (!canPlace(p, key, tx, ty, true)) continue;
    const cx = tx + d.w / 2, cy = ty + d.h / 2;
    let s;
    if (ores && ores.length) { s = 1e9; for (const i of ores) { const dd = Math.hypot(i % N + 0.5 - cx, ((i / N) | 0) + 0.5 - cy); if (dd < s) s = dd; } s += Math.hypot(cx - anchor.x, cy - anchor.y) * 0.2; }
    else if (key === 'turret') s = Math.hypot(cx - fx, cy - fy) + Math.random() * 4;
    else s = Math.hypot(cx - anchor.x, cy - anchor.y) + Math.random() * 3;
    if (s < bs) { bs = s; best = { tx, ty }; }
  }
  return best;
}
function aiUpdate(p) {
  const ai = p.ai;
  if (G.time < ai.next) return;
  ai.next = G.time + 1;
  const cnt = {}, army = [], blds = [];
  for (const e of G.list) {
    if (e.dead || e.owner !== p.id) continue;
    cnt[e.key] = (cnt[e.key] || 0) + 1;
    if (e.kind === 'b') blds.push(e); else if (e.def.weapon) army.push(e);
  }
  if (!blds.length) return;
  const hq = blds.find(b => b.key === 'hq'), qb = p.q.b;
  // binolar
  if (qb.ready) {
    const pos = aiFindSpot(p, qb.items[0], hq || blds[0]);
    if (pos) { placeFromQueue(p, pos.tx, pos.ty); ai.fail = 0; }
    else if (++ai.fail > 8) { cancelItem(p, 'b', qb.items[0]); ai.fail = 0; }
  } else if (!qb.items.length && hq) {
    let want = null;
    if (!cnt.power || p.powerProd - p.powerUse < 30) want = 'power';
    else for (const [k, n] of AI_PLAN) if ((cnt[k] || 0) < n && avail(p, k)) { want = k; break; }
    if (want && p.credits >= BDEF[want].cost * 0.3) enqueue(p, want);
  }
  // birliklar
  const harv = cnt.harvester || 0, wantHarv = Math.min((cnt.refinery || 0) * 2, 5);
  if (cnt.barracks && !p.q.i.items.length && army.length < ai.cap && p.credits > 300) enqueue(p, Math.random() < 0.6 ? 'rifle' : 'rocket');
  if (cnt.factory && !p.q.v.items.length) {
    if (harv < wantHarv && cnt.refinery) enqueue(p, 'harvester');
    else if (army.length < ai.cap && p.credits > 800) {
      const opts = ['tank', 'tank', 'scout'];
      if (avail(p, 'artillery')) opts.push('artillery');
      if (avail(p, 'heavy')) opts.push('heavy', 'heavy');
      enqueue(p, opts[(Math.random() * opts.length) | 0]);
    }
  }
  // mudofaa
  const home = army.filter(u => !u.squad);
  if (G.time - p.alertT < 3) {
    const def = home.filter(u => u.order.t === 'idle' && !u.auto);
    if (def.length) cmdMove(def, p.alertX, p.alertY, true);
  }
  // hujum
  const nearest = (x, y) => { let b = null, bd = 1e9; for (const e of G.list) if (!e.dead && e.owner !== p.id) { const d = Math.hypot(e.x - x, e.y - y) + (e.kind === 'b' ? 0 : 6); if (d < bd) { bd = d; b = e; } } return b; };
  if (G.time >= ai.attackAt && home.length >= ai.squad) {
    const t = nearest(home[0].x, home[0].y);
    if (t) {
      const grp = home.slice(0, Math.ceil(ai.squad * 1.5));
      for (const u of grp) u.squad = true;
      cmdMove(grp, t.x, t.y, true);
      ai.attackAt = G.time + ai.gap * (0.8 + Math.random() * 0.5); ai.squad = Math.min(ai.squad + 2, 26);
    }
  }
  const idle = army.filter(u => u.squad && u.order.t === 'idle' && !u.auto);
  if (idle.length) { const t = nearest(idle[0].x, idle[0].y); if (t) cmdMove(idle, t.x, t.y, true); }
}
