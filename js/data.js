'use strict';
// ---- Konstantalar va o'yin ma'lumotlari ----
const TW = 64, TH = 32, N = 64, TICK = 1 / 30;
const T_GRASS = 0, T_WATER = 1, T_ROCK = 2, T_SAND = 3;
const BUILD_TIME_K = 0.011; // 1 kredit uchun soniya

// zarar turi -> nishon sinfiga ko'paytuvchi
const DMG = {
  bullet: { inf: 1, veh: 0.3, bld: 0.2 },
  shell: { inf: 0.45, veh: 1, bld: 0.75 },
  rocket: { inf: 0.35, veh: 1.15, bld: 1 },
  he: { inf: 1, veh: 0.7, bld: 1.3 },
};

const COLORS = [
  { main: '#2f86ff', dark: '#1b4fa3', light: '#9cc8ff', hull: '#6f7f8f' },
  { main: '#e5383b', dark: '#8f1d1f', light: '#ffa3a5', hull: '#8a7166' },
];

const BDEF = {
  hq: { name: "Qo'mondonlik markazi", w: 3, h: 3, hp: 3000, cost: 3000, power: 20, sight: 9, req: [], desc: 'Bino qurish imkonini beradi.' },
  power: { name: 'Elektr stansiya', w: 2, h: 2, hp: 750, cost: 600, power: 100, sight: 5, req: ['hq'], desc: 'Bazani energiya bilan ta\'minlaydi.' },
  refinery: { name: 'Ruda zavodi', w: 3, h: 3, hp: 1200, cost: 2000, power: -40, sight: 6, req: ['power'], desc: 'Rudani mablag\'ga aylantiradi. Bepul yig\'uvchi bilan keladi.' },
  barracks: { name: 'Kazarma', w: 2, h: 2, hp: 900, cost: 500, power: -10, sight: 5, req: ['power'], desc: 'Piyoda askarlarni tayyorlaydi.' },
  factory: { name: 'Harbiy zavod', w: 3, h: 3, hp: 1500, cost: 2000, power: -30, sight: 5, req: ['refinery', 'barracks'], desc: 'Texnika ishlab chiqaradi.' },
  radar: { name: 'Radar', w: 2, h: 2, hp: 900, cost: 1000, power: -40, sight: 14, req: ['refinery'], desc: 'Keng hududni ko\'rsatadi. Artilleriyani ochadi.' },
  turret: { name: 'Mudofaa minorasi', w: 1, h: 1, hp: 650, cost: 600, power: -20, sight: 8, req: ['barracks'], desc: 'Bazani himoya qiluvchi to\'p.',
    weapon: { range: 7, dmg: 70, rof: 1.4, type: 'shell', proj: 'shell', speed: 18 } },
  techlab: { name: 'Texnologiya markazi', w: 2, h: 2, hp: 1000, cost: 2000, power: -60, sight: 5, req: ['factory', 'radar'], desc: 'Og\'ir tankni ochadi.' },
};

const UDEF = {
  rifle: { name: 'Otuvchi', cat: 'i', cls: 'inf', hp: 100, cost: 100, speed: 2.1, sight: 6, r: 0.2, req: ['barracks'], desc: 'Piyodalarga qarshi arzon askar.',
    weapon: { range: 4.5, dmg: 14, rof: 0.55, type: 'bullet', proj: 'bullet' } },
  rocket: { name: 'Raketachi', cat: 'i', cls: 'inf', hp: 90, cost: 300, speed: 1.9, sight: 7, r: 0.2, req: ['barracks'], desc: 'Texnika va binolarga qarshi kuchli.',
    weapon: { range: 6, dmg: 50, rof: 2.2, type: 'rocket', proj: 'rocket', speed: 9 } },
  harvester: { name: "Ruda yig'uvchi", cat: 'v', cls: 'veh', hp: 800, cost: 1400, speed: 2.2, sight: 4, r: 0.44, req: ['factory', 'refinery'], harvester: true, cap: 600, desc: 'Ruda yig\'ib zavodga tashiydi.' },
  scout: { name: 'Razvedka mashinasi', cat: 'v', cls: 'veh', hp: 260, cost: 500, speed: 4.4, sight: 9, r: 0.32, req: ['factory'], desc: 'Tez, piyodalarga qarshi pulemyot.',
    weapon: { range: 4.5, dmg: 11, rof: 0.22, type: 'bullet', proj: 'bullet' } },
  tank: { name: 'Tank', cat: 'v', cls: 'veh', hp: 520, cost: 800, speed: 2.8, sight: 7, r: 0.38, req: ['factory'], desc: 'Asosiy jangovar tank.',
    weapon: { range: 5.5, dmg: 60, rof: 1.7, type: 'shell', proj: 'shell', speed: 16 } },
  artillery: { name: 'Artilleriya', cat: 'v', cls: 'veh', hp: 240, cost: 1200, speed: 2.0, sight: 7, r: 0.38, req: ['factory', 'radar'], desc: 'Uzoqdan maydon bo\'ylab zarba. Yaqinda ojiz.',
    weapon: { range: 11, min: 3, dmg: 150, rof: 4.5, type: 'he', proj: 'arty', speed: 8, splash: 1.6 } },
  heavy: { name: "Og'ir tank", cat: 'v', cls: 'veh', hp: 980, cost: 1500, speed: 2.0, sight: 7, r: 0.44, req: ['factory', 'techlab'], desc: 'Qalin zirh, qo\'sh to\'p.',
    weapon: { range: 6, dmg: 110, rof: 2.1, type: 'shell', proj: 'shell', speed: 16 } },
};
for (const k in BDEF) { BDEF[k].key = k; BDEF[k].kind = 'b'; BDEF[k].cls = 'bld'; BDEF[k].cat = 'b'; }
for (const k in UDEF) { UDEF[k].key = k; UDEF[k].kind = 'u'; }
const DEF = k => BDEF[k] || UDEF[k];

const BUILD_LIST = {
  b: ['power', 'refinery', 'barracks', 'factory', 'radar', 'turret', 'techlab'],
  i: ['rifle', 'rocket'],
  v: ['harvester', 'scout', 'tank', 'artillery', 'heavy'],
};
const PRODUCER = { b: 'hq', i: 'barracks', v: 'factory' };

// ---- Yordamchi funksiyalar ----
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash2(i, k) {
  let h = (Math.imul(i, 374761393) + Math.imul(k, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function angDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
function turnTo(a, b, step) { const d = angDiff(a, b); return Math.abs(d) <= step ? b : a + Math.sign(d) * step; }
function makeNoise(rnd, size) {
  const g = new Float32Array((size + 1) * (size + 1));
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  return (x, y) => {
    x = clamp(x, 0, size - 0.001); y = clamp(y, 0, size - 0.001);
    const xi = x | 0, yi = y | 0; let fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = g[yi * (size + 1) + xi], b = g[yi * (size + 1) + xi + 1], c = g[(yi + 1) * (size + 1) + xi], d = g[(yi + 1) * (size + 1) + xi + 1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}
