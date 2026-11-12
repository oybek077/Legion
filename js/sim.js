'use strict';
// ---- O'yin simulyatsiyasi ----
let G = null;
const mkQ = () => ({ items: [], prog: 0, paid: 0, ready: false });
function mkPlayer(id, isAI) {
  return { id, isAI, credits: 5000, powerProd: 0, powerUse: 0, low: false, q: { b: mkQ(), i: mkQ(), v: mkQ() },
    alertT: -99, alertX: 0, alertY: 0, ai: null, income: 1, kills: 0, lost: 0, stall: 0 };
}
function notify(pid, text, kind) { if (pid === 0 && !G.players[0].isAI && typeof toast === 'function') toast(text, kind); }
function snd(name, x, y) { if (typeof sfx === 'function') sfx(name, x, y); }

function newGame(diff) {
  for (let tries = 0; tries < 50; tries++) {
    const m = genMap((Math.random() * 2147483647) | 0);
    G = { time: 0, tick: 0, ents: new Map(), list: [], nextId: 1, players: [], proj: [], fx: [], over: null, diff,
      terr: m.terr, ore: m.ore, fields: m.fields, occ: new Int32Array(N * N), vis: new Uint8Array(N * N), exp: new Uint8Array(N * N), dirty: false };
    let ok = true;
    for (const f of [{ x: N - 11.5, y: 13.5 }, ...m.fields]) { findPath(11.5, N - 8.5, f.x, f.y, 1.5); if (!pathReached) { ok = false; break; } }
    if (ok) break;
  }
  G.players = [mkPlayer(0, false), mkPlayer(1, true)];
  addBuilding(0, 'hq', 10, N - 13); addBuilding(1, 'hq', N - 13, 10);
  const st = [['rifle', 14.5, N - 9.5], ['rifle', 15.5, N - 10.5], ['rifle', 14.5, N - 11.5], ['tank', 15.5, N - 12.5]];
  for (const [k, x, y] of st) { addUnit(0, k, x, y); const u = addUnit(1, k, N - x, N - y); u.dir = u.aim = Math.PI; }
  aiInit(G.players[1], diff);
  updateVision();
}

function mkEnt(kind, key, owner, x, y) {
  const def = DEF(key);
  const e = { id: G.nextId++, kind, key, def, owner, x, y, tx: 0, ty: 0, hp: def.hp, max: def.hp, dir: 0, aim: 0, cd: 0,
    order: { t: 'idle' }, path: null, pi: 0, auto: 0, scan: Math.random() * 0.3, chase: 0, pathFor: null, stuck: 0,
    hitT: -99, born: G.time, moving: false, flash: 0, dead: false };
  G.ents.set(e.id, e); G.list.push(e);
  return e;
}
function addUnit(owner, key, x, y) {
  const u = mkEnt('u', key, owner, x, y);
  if (u.def.harvester) { u.hs = 'seek'; u.load = 0; u.oreT = null; u.timer = 0; u.hint = null; }
  return u;
}
function addBuilding(owner, key, tx, ty) {
  const d = BDEF[key];
  const b = mkEnt('b', key, owner, tx + d.w / 2, ty + d.h / 2);
  b.tx = tx; b.ty = ty; b.rally = null;
  for (let y = ty; y < ty + d.h; y++) for (let x = tx; x < tx + d.w; x++) G.occ[y * N + x] = b.id;
  recalcPower(G.players[owner]);
  if (key === 'refinery') { const p = nearestFree(tx + 1.5, ty + 3.5); addUnit(owner, 'harvester', p.x, p.y); }
  return b;
}
function recalcPower(p) {
  let prod = 0, use = 0;
  for (const e of G.list) if (!e.dead && e.owner === p.id && e.kind === 'b') { if (e.def.power > 0) prod += e.def.power; else use -= e.def.power; }
  const was = p.low;
  p.powerProd = prod; p.powerUse = use; p.low = use > prod;
  if (p.low && !was) notify(p.id, 'Energiya yetishmayapti!', 'warn');
}
function hasB(p, key) { for (const e of G.list) if (!e.dead && e.owner === p.id && e.key === key) return true; return false; }
function avail(p, key) {
  const d = DEF(key);
  if (!hasB(p, PRODUCER[d.cat])) return false;
  for (const r of d.req) if (!hasB(p, r)) return false;
  return true;
}
function distTo(e, x, y) {
  if (e.kind === 'b') {
    const dx = Math.max(Math.abs(x - e.x) - e.def.w / 2, 0), dy = Math.max(Math.abs(y - e.y) - e.def.h / 2, 0);
    return Math.hypot(dx, dy);
  }
  return Math.hypot(x - e.x, y - e.y);
}
function nearestFree(x, y) {
  const cx = clamp(x | 0, 0, N - 1), cy = clamp(y | 0, 0, N - 1);
  for (let r = 0; r < 14; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    if (passable(cx + dx, cy + dy)) return { x: cx + dx + 0.5, y: cy + dy + 0.5 };
  }
  return { x: cx + 0.5, y: cy + 0.5 };
}
function spreadTiles(x, y, n) {
  const res = [], cx = clamp(x | 0, 0, N - 1), cy = clamp(y | 0, 0, N - 1);
  for (let r = 0; r < 14 && res.length < n; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    if (passable(cx + dx, cy + dy)) res.push({ x: cx + dx + 0.5, y: cy + dy + 0.5 });
  }
  return res;
}

// ---- Joylashtirish ----
function canPlace(p, key, tx, ty, ring) {
  const d = BDEF[key];
  if (tx < 0 || ty < 0 || tx + d.w > N || ty + d.h > N) return false;
  for (let y = ty; y < ty + d.h; y++) for (let x = tx; x < tx + d.w; x++) {
    const i = y * N + x, t = G.terr[i];
    if (t === T_WATER || t === T_ROCK || G.ore[i] > 0 || G.occ[i]) return false;
  }
  if (ring) for (let y = ty - 1; y <= ty + d.h; y++) for (let x = tx - 1; x <= tx + d.w; x++) if (!passable(x, y)) return false;
  let near = false;
  for (const e of G.list) {
    if (e.dead) continue;
    if (e.kind === 'u') { if (e.x > tx - 0.3 && e.x < tx + d.w + 0.3 && e.y > ty - 0.3 && e.y < ty + d.h + 0.3) return false; continue; }
    if (e.owner !== p.id) continue;
    const dx = Math.max(e.tx - (tx + d.w), tx - (e.tx + e.def.w), 0), dy = Math.max(e.ty - (ty + d.h), ty - (e.ty + e.def.h), 0);
    if (Math.max(dx, dy) <= 2) near = true;
  }
  return near;
}
function placeFromQueue(p, tx, ty) {
  const q = p.q.b;
  if (!q.ready || !canPlace(p, q.items[0], tx, ty)) return false;
  const b = addBuilding(p.id, q.items.shift(), tx, ty);
  q.ready = false; q.prog = 0; q.paid = 0;
  snd('place', b.x, b.y);
  return true;
}

// ---- Ishlab chiqarish ----
function enqueue(p, key) {
  const d = DEF(key), q = p.q[d.cat];
  if (!avail(p, key)) return false;
  if (d.cat === 'b' ? q.items.length >= 1 : q.items.length >= 9) return false;
  q.items.push(key);
  return true;
}
function cancelItem(p, cat, key) {
  const q = p.q[cat];
  let idx = q.items.lastIndexOf(key);
  if (idx < 0) return false;
  if (idx === 0) { p.credits += q.ready ? DEF(key).cost : q.paid; q.prog = 0; q.paid = 0; q.ready = false; }
  q.items.splice(idx, 1);
  return true;
}
function producer(p, cat) {
  let first = null;
  for (const e of G.list) if (!e.dead && e.owner === p.id && e.key === PRODUCER[cat]) { if (e.primary) return e; if (!first) first = e; }
  return first;
}
function updProduction(p, dt) {
  for (const cat of ['b', 'i', 'v']) {
    const q = p.q[cat];
    if (!q.items.length || q.ready) continue;
    const src = producer(p, cat);
    if (!src) { while (q.items.length) cancelItem(p, cat, q.items[0]); continue; }
    const d = DEF(q.items[0]);
    let dp = dt / (d.cost * BUILD_TIME_K) * (p.low ? 0.5 : 1) * (p.ai ? p.ai.speed : 1);
    dp = Math.min(dp, 1 - q.prog);
    let cost = dp * d.cost;
    if (cost > p.credits) {
      dp = p.credits / d.cost; cost = p.credits;
      p.stall += dt; if (p.stall > 4 && dp === 0) { p.stall = -20; notify(p.id, "Mablag' yetarli emas", 'warn'); }
    } else if (p.stall > 0) p.stall = 0;
    p.credits -= cost; q.paid += cost; q.prog += dp;
    if (q.prog >= 0.9999) {
      if (cat === 'b') { q.ready = true; notify(p.id, d.name + ' tayyor — joylashtiring', 'ok'); if (p.id === 0) snd('ready'); }
      else {
        q.items.shift(); q.prog = 0; q.paid = 0;
        const s = nearestFree(src.x, src.ty + src.def.h + 0.5);
        const u = addUnit(p.id, d.key, s.x, s.y); u.dir = u.aim = Math.PI / 2;
        const r = src.rally || { x: src.x + (Math.random() - 0.5) * 3, y: src.ty + src.def.h + 2.2 };
        if (!u.def.harvester) { const t = nearestFree(r.x, r.y); u.order = { t: 'move', x: t.x, y: t.y }; goTo(u, t.x, t.y, 0); }
        if (p.id === 0) snd('ready');
      }
    }
  }
}

// ---- Harakat ----
function goTo(u, x, y, reach) {
  u.goal = { x, y, reach: reach || 0 };
  u.path = findPath(u.x, u.y, x, y, reach || 0); u.pi = 0; u.bestD = 1e9; u.noProg = 0; u.stuck = 0;
}
function follow(u, dt) {
  if (!u.path || u.pi >= u.path.length) return true;
  const wp = u.path[u.pi], dx = wp.x - u.x, dy = wp.y - u.y, d = Math.hypot(dx, dy), step = u.def.speed * dt;
  const last = u.pi === u.path.length - 1;
  if (d <= step) { if (passable(wp.x | 0, wp.y | 0)) { u.x = wp.x; u.y = wp.y; } u.pi++; return u.pi >= u.path.length; }
  if (last) {
    if (d < u.bestD - 0.02) { u.bestD = d; u.noProg = 0; } else u.noProg += dt;
    if (u.noProg > 0.8 && d < 2) { u.pi++; return true; }
  }
  u.dir = turnTo(u.dir, Math.atan2(dy, dx), dt * 7);
  u.moving = true;
  const nx = u.x + dx / d * step, ny = u.y + dy / d * step;
  if (passable(nx | 0, ny | 0)) { u.x = nx; u.y = ny; u.stuck = 0; }
  else { u.stuck += dt; if (u.stuck > 0.3) goTo(u, u.goal.x, u.goal.y, u.goal.reach); }
  return false;
}
function separate() {
  const us = G.units;
  for (let i = 0; i < us.length; i++) {
    const a = us[i];
    for (let j = i + 1; j < us.length; j++) {
      const b = us[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      const rr = a.def.r + b.def.r;
      if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
      let d = Math.hypot(dx, dy);
      if (d >= rr) continue;
      if (d < 0.001) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d = Math.hypot(dx, dy); }
      const push = (rr - d) * 0.5, wa = a.fixed ? 0 : b.fixed ? 1 : 0.5, wb = b.fixed ? 0 : a.fixed ? 1 : 0.5;
      const ux = dx / d * push, uy = dy / d * push;
      nudge(a, -ux * wa, -uy * wa); nudge(b, ux * wb, uy * wb);
    }
  }
}
function nudge(u, dx, dy) {
  if (!dx && !dy) return;
  const nx = u.x + dx, ny = u.y + dy;
  if (passable(nx | 0, ny | 0)) { u.x = nx; u.y = ny; }
  else if (passable(nx | 0, u.y | 0)) u.x = nx;
  else if (passable(u.x | 0, ny | 0)) u.y = ny;
}

// ---- Buyruqlar ----
function setMove(u, x, y, am) {
  u.auto = 0;
  if (u.def.harvester) { u.hs = 'manual'; goTo(u, x, y, 0); return; }
  if (am) { u.order = { t: 'amove', x, y }; u.pathFor = null; u.path = null; }
  else { u.order = { t: 'move', x, y }; u.pathFor = 'move'; goTo(u, x, y, 0); }
}
function cmdMove(units, x, y, am) {
  const mob = units.filter(u => !u.dead && u.kind === 'u');
  x = clamp(x, 0.5, N - 0.5); y = clamp(y, 0.5, N - 0.5);
  if (mob.length === 1 && passable(x | 0, y | 0)) { setMove(mob[0], x, y, am); return; }
  const ts = spreadTiles(x, y, mob.length);
  mob.forEach((u, i) => { const t = ts[i] || ts[0] || { x, y }; setMove(u, t.x, t.y, am); });
}
function cmdAttack(units, t) {
  for (const u of units) if (!u.dead && u.kind === 'u' && u.def.weapon) { u.order = { t: 'attack', id: t.id }; u.pathFor = null; u.path = null; u.auto = 0; }
}
function cmdStop(units) {
  for (const u of units) if (u.kind === 'u') { u.order = { t: 'idle' }; u.path = null; u.pathFor = null; u.auto = 0; if (u.def.harvester) u.hs = 'idle'; }
}
function cmdHarvest(u, tx, ty) { u.hs = 'seek'; u.hint = { x: tx + 0.5, y: ty + 0.5 }; }
function cmdReturn(u) { u.hs = 'ret'; }

// ---- Jang ----
function acquire(u, radius) {
  const w = u.def.weapon; let best = null, bs = 1e9;
  for (const e of G.list) {
    if (e.dead || e.owner === u.owner) continue;
    const d = distTo(e, u.x, u.y);
    if (d > radius || (w.min && d < w.min)) continue;
    const s = d + (e.kind === 'b' && !e.def.weapon ? 3 : 0);
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}
function fire(u, t) {
  const w = u.def.weapon; u.cd = w.rof; u.flash = 0.09;
  const mx = u.x + Math.cos(u.aim) * 0.45, my = u.y + Math.sin(u.aim) * 0.45;
  if (w.proj === 'bullet') {
    G.fx.push({ t: 'tracer', x: mx, y: my, x2: t.x + (Math.random() - 0.5) * 0.3, y2: t.y + (Math.random() - 0.5) * 0.3, life: 0.07, max: 0.07 });
    snd('shot', u.x, u.y);
    damage(t, w.dmg, w.type, u);
  } else {
    G.proj.push({ x: mx, y: my, sx: mx, sy: my, tx: t.x, ty: t.y, tid: t.id, w, owner: u.owner, src: u.id, z: 0 });
    snd(w.proj === 'rocket' ? 'rocket' : 'cannon', u.x, u.y);
  }
}
function damage(e, amt, type, src) {
  if (e.dead) return;
  e.hp -= amt * DMG[type][e.def.cls]; e.hitT = G.time;
  const p = G.players[e.owner];
  if (e.kind === 'b' || e.def.harvester) {
    if (G.time - p.alertT > 20) notify(p.id, e.kind === 'b' ? 'Bazamiz hujum ostida!' : "Ruda yig'uvchi hujum ostida!", 'bad');
    p.alertT = G.time; p.alertX = e.x; p.alertY = e.y;
  }
  if (src && e.kind === 'u' && e.def.weapon && e.order.t === 'idle' && !e.auto) e.auto = src.id;
  if (e.hp <= 0) { kill(e); if (src) G.players[src.owner].kills++; }
}
function kill(e, quiet) {
  if (e.dead) return;
  e.dead = true; G.ents.delete(e.id); G.dirty = true;
  if (e.kind === 'b') {
    const d = e.def;
    for (let y = e.ty; y < e.ty + d.h; y++) for (let x = e.tx; x < e.tx + d.w; x++) G.occ[y * N + x] = 0;
    recalcPower(G.players[e.owner]);
  }
  if (!quiet) {
    G.players[e.owner].lost++;
    const big = e.kind === 'b';
    G.fx.push({ t: 'boom', x: e.x, y: e.y, z: 6, life: big ? 0.9 : 0.5, max: big ? 0.9 : 0.5, size: big ? 26 * e.def.w : e.def.cls === 'inf' ? 7 : 18 });
    if (big) for (let i = 0; i < 4; i++) G.fx.push({ t: 'boom', x: e.x + (Math.random() - 0.5) * e.def.w, y: e.y + (Math.random() - 0.5) * e.def.h, z: 10, life: 0.5 + Math.random() * 0.5, max: 1, size: 20 });
    snd(e.def.cls === 'inf' ? 'die' : 'boom', e.x, e.y);
  }
}
function sellBuilding(e) {
  if (e.dead || e.kind !== 'b') return;
  G.players[e.owner].credits += Math.round(e.def.cost * 0.5 * e.hp / e.max);
  kill(e, true);
}
function updProj(dt) {
  for (const p of G.proj) {
    const w = p.w, t = G.ents.get(p.tid);
    if (t && w.proj !== 'arty') { p.tx = t.x; p.ty = t.y; }
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), step = w.speed * dt;
    if (w.proj === 'arty') { const tot = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 1; p.z = Math.sin(Math.PI * (1 - d / tot)) * tot * 9; }
    else p.z = 10;
    if (w.proj === 'rocket' && Math.random() < 0.6) G.fx.push({ t: 'smoke', x: p.x, y: p.y, z: 10, life: 0.35, max: 0.35, size: 3 });
    if (d <= step) {
      p.done = true;
      if (w.splash) {
        for (const e of G.list) {
          if (e.dead || e.owner === p.owner) continue;
          const dd = distTo(e, p.tx, p.ty);
          if (dd < w.splash) damage(e, w.dmg * (1 - 0.6 * dd / w.splash), w.type, G.ents.get(p.src) || { owner: p.owner, id: 0 });
        }
      } else if (t) damage(t, w.dmg, w.type, G.ents.get(p.src) || { owner: p.owner, id: 0 });
      G.fx.push({ t: 'boom', x: p.tx, y: p.ty, z: w.splash ? 2 : 8, life: 0.3, max: 0.3, size: w.splash ? 22 : 9 });
      if (w.splash) snd('boom', p.tx, p.ty);
    } else { p.x += dx / d * step; p.y += dy / d * step; p.ang = Math.atan2(dy, dx); }
  }
  if (G.proj.some(p => p.done)) G.proj = G.proj.filter(p => !p.done);
}

function updUnit(u, dt) {
  const d = u.def, w = d.weapon;
  u.moving = false; u.fixed = false;
  if (u.cd > 0) u.cd -= dt;
  if (u.flash > 0) u.flash -= dt;
  if (d.harvester) { updHarv(u, dt); u.aim = u.dir; return; }
  const o = u.order;
  if (o.t === 'move') { if (follow(u, dt)) u.order = { t: 'idle' }; u.aim = turnTo(u.aim, u.dir, dt * 6); return; }
  let tgt = null;
  if (o.t === 'attack') {
    tgt = G.ents.get(o.id);
    if (!tgt) { u.order = { t: 'idle' }; u.path = null; u.pathFor = null; return; }
  } else {
    tgt = u.auto ? G.ents.get(u.auto) : null;
    if (!tgt) u.auto = 0;
    u.scan -= dt;
    if (u.scan <= 0) {
      u.scan = 0.3 + Math.random() * 0.1;
      const a = acquire(u, o.t === 'amove' ? d.sight + 1 : w.range + 1.5);
      if (a) { tgt = a; u.auto = a.id; }
      else if (tgt && distTo(tgt, u.x, u.y) > d.sight + 4) { tgt = null; u.auto = 0; }
    }
  }
  if (tgt) {
    const dd = distTo(tgt, u.x, u.y);
    if (dd <= w.range && !(w.min && dd < w.min)) {
      const a = Math.atan2(tgt.y - u.y, tgt.x - u.x);
      u.aim = turnTo(u.aim, a, dt * 9);
      if (d.cls === 'inf') u.dir = u.aim;
      if (u.cd <= 0 && Math.abs(angDiff(u.aim, a)) < 0.2) fire(u, tgt);
      u.path = null; u.pathFor = null;
    } else if (!(w.min && dd < w.min)) {
      u.chase -= dt;
      if (u.pathFor !== 'chase' || u.chase <= 0 || !u.path) {
        const extra = tgt.kind === 'b' ? Math.min(tgt.def.w, tgt.def.h) / 2 : 0;
        goTo(u, tgt.x, tgt.y, Math.max(1, w.range - 0.7 + extra)); u.pathFor = 'chase'; u.chase = 0.8;
      }
      follow(u, dt); u.aim = turnTo(u.aim, u.dir, dt * 6);
    }
    return;
  }
  if (o.t === 'amove') {
    if (u.pathFor !== 'amove') { goTo(u, o.x, o.y, 0); u.pathFor = 'amove'; }
    if (follow(u, dt)) { u.order = { t: 'idle' }; u.pathFor = null; }
    u.aim = turnTo(u.aim, u.dir, dt * 6);
  } else if (u.pathFor === 'chase') { u.path = null; u.pathFor = null; }
}

// ---- Ruda yig'uvchi ----
function findOre(x, y, bad) {
  let best = -1, bd = 1e9;
  for (let i = 0; i < N * N; i++) {
    if (G.ore[i] <= 0 || (bad && bad.has(i))) continue;
    const dx = (i % N) + 0.5 - x, dy = ((i / N) | 0) + 0.5 - y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
function updHarv(u, dt) {
  const p = G.players[u.owner], cap = u.def.cap;
  switch (u.hs) {
    case 'seek': {
      if (u.load >= cap) { u.hs = 'ret'; break; }
      const h = u.hint || u; u.hint = null;
      const i = findOre(h.x, h.y, u.bad);
      if (i < 0) { u.hs = u.load > 0 ? 'ret' : 'wait'; u.timer = 3; break; }
      u.oreT = i; goTo(u, i % N + 0.5, ((i / N) | 0) + 0.5, 0); u.hs = 'toOre';
      break;
    }
    case 'toOre':
      if (G.ore[u.oreT] <= 0) { u.hs = 'seek'; break; }
      if (follow(u, dt)) {
        if (Math.hypot(u.oreT % N + 0.5 - u.x, ((u.oreT / N) | 0) + 0.5 - u.y) > 1.8) { (u.bad || (u.bad = new Set())).add(u.oreT); u.hs = 'seek'; }
        else u.hs = 'mine';
      }
      break;
    case 'mine': {
      u.fixed = true;
      const take = Math.min(100 * dt, G.ore[u.oreT], cap - u.load);
      G.ore[u.oreT] = Math.max(0, G.ore[u.oreT] - take); u.load += take;
      if (G.ore[u.oreT] < 1) G.ore[u.oreT] = 0;
      if (u.load >= cap - 0.01) u.hs = 'ret'; else if (G.ore[u.oreT] <= 0) u.hs = 'seek';
      break;
    }
    case 'ret': {
      let ref = null, bd = 1e9;
      for (const e of G.list) if (!e.dead && e.owner === u.owner && e.key === 'refinery') { const d = distTo(e, u.x, u.y); if (d < bd) { bd = d; ref = e; } }
      if (!ref) { u.hs = 'wait'; u.timer = 2; break; }
      u.ref = ref.id; const dk = nearestFree(ref.tx + 1.5, ref.ty + 3.5); goTo(u, dk.x, dk.y, 0); u.hs = 'toRef';
      break;
    }
    case 'toRef': {
      const ref = G.ents.get(u.ref);
      if (!ref) { u.hs = 'ret'; break; }
      if (follow(u, dt) || distTo(ref, u.x, u.y) < 0.9 && u.pi >= u.path.length - 1) { u.hs = 'unload'; }
      break;
    }
    case 'unload': {
      u.fixed = true;
      if (!G.ents.get(u.ref)) { u.hs = 'ret'; break; }
      const give = Math.min(300 * dt, u.load); u.load -= give; p.credits += give * p.income;
      if (u.load <= 0.01) { u.load = 0; u.hs = 'seek'; if (u.oreT != null) u.hint = { x: u.oreT % N + 0.5, y: ((u.oreT / N) | 0) + 0.5 }; }
      break;
    }
    case 'manual': if (follow(u, dt)) u.hs = 'idle'; break;
    case 'wait': u.timer -= dt; if (u.timer <= 0) u.hs = u.load > 0 && hasB(p, 'refinery') ? 'ret' : 'seek'; break;
  }
}

function updBuilding(b, dt) {
  if (b.hp < b.max * 0.5 && Math.random() < (b.hp < b.max * 0.25 ? 0.25 : 0.1))
    G.fx.push({ t: 'smoke', x: b.x + (hash2(b.id, 1) - 0.5) * b.def.w * 0.6, y: b.y + (hash2(b.id, 2) - 0.5) * b.def.h * 0.6, z: 24, life: 1.2, max: 1.2, size: 7, rise: 26 });
  const w = b.def.weapon;
  if (!w) return;
  if (b.cd > 0) b.cd -= dt;
  if (b.flash > 0) b.flash -= dt;
  if (G.players[b.owner].low) return;
  let t = b.auto ? G.ents.get(b.auto) : null;
  b.scan -= dt;
  if (b.scan <= 0 || !t) { b.scan = 0.3; t = acquire(b, w.range); b.auto = t ? t.id : 0; }
  if (t && distTo(t, b.x, b.y) <= w.range) {
    const a = Math.atan2(t.y - b.y, t.x - b.x);
    b.aim = turnTo(b.aim, a, dt * 6);
    if (b.cd <= 0 && Math.abs(angDiff(b.aim, a)) < 0.2) fire(b, t);
  }
}

function updateVision() {
  const vis = G.vis, ex = G.exp;
  if (G.over) { vis.fill(1); ex.fill(1); return; }
  vis.fill(0);
  for (const e of G.list) {
    if (e.dead || e.owner !== 0) continue;
    const r = e.def.sight + (e.kind === 'b' ? 1 : 0), cx = e.x | 0, cy = e.y | 0, r2 = r * r;
    for (let dy = -r; dy <= r; dy++) {
      const y = cy + dy; if (y < 0 || y >= N) continue;
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx; if (x < 0 || x >= N || dx * dx + dy * dy > r2) continue;
        vis[y * N + x] = 1; ex[y * N + x] = 1;
      }
    }
  }
}

function simTick() {
  const dt = TICK; G.time += dt; G.tick++;
  G.units = G.list.filter(e => !e.dead && e.kind === 'u');
  for (const p of G.players) { updProduction(p, dt); if (p.ai) aiUpdate(p); }
  for (let i = 0; i < G.list.length; i++) { const e = G.list[i]; if (e.dead) continue; if (e.kind === 'u') updUnit(e, dt); else updBuilding(e, dt); }
  G.units = G.list.filter(e => !e.dead && e.kind === 'u');
  separate();
  updProj(dt);
  for (const f of G.fx) { f.life -= dt; if (f.rise) f.z += f.rise * dt; }
  if (G.fx.length && G.tick % 5 === 0) G.fx = G.fx.filter(f => f.life > 0);
  if (G.dirty) { G.list = G.list.filter(e => !e.dead); G.dirty = false; }
  if (G.tick % 6 === 0) updateVision();
  if (G.tick % 15 === 0 && !G.over) {
    const has = [false, false];
    for (const e of G.list) if (e.kind === 'b') has[e.owner] = true;
    if (!has[0]) G.over = 'lose'; else if (!has[1]) G.over = 'win';
    if (G.over) updateVision();
  }
}
