/** Data-driven layouts for 4 territories. T1 is fully tuned; T2–T4 are shorter drafts. */
import { WORLD_W, TERRITORY_NAMES } from './config.js?v=1';

export const PALETTES = [
  {
    // Oasis Cut — sand
    mid: '#c4a574',
    dark: '#a88858',
    light: '#d8c090',
    streak: '#b89864',
    water: '#2a6a70',
    fog: '#c4a574',
    hud: '#1a1410',
  },
  {
    // Walled Mile — stone town
    mid: '#8a7a68',
    dark: '#6b5d4d',
    light: '#a49480',
    streak: '#7a6a58',
    water: '#3a4a50',
    fog: '#8a7a68',
    hud: '#161210',
  },
  {
    // Blackwater Span — dark marsh
    mid: '#3d4a3a',
    dark: '#2a3530',
    light: '#4a5a48',
    streak: '#354438',
    water: '#1a3a48',
    fog: '#3d4a3a',
    hud: '#101410',
  },
  {
    // The Redoubt — fortress concrete
    mid: '#6a6a62',
    dark: '#4a4a44',
    light: '#828278',
    streak: '#5a5a54',
    water: '#3a4044',
    fog: '#6a6a62',
    hud: '#141414',
  },
];

function bagLine(cover, x0, x1, y, gap0, gap1) {
  for (let x = x0; x <= x1; x += 22) {
    if (gap0 != null && x >= gap0 && x <= gap1) continue;
    cover.push({ type: 'sandbag', x, y });
  }
}

function wallLine(cover, x0, x1, y) {
  for (let x = x0; x <= x1; x += 16) cover.push({ type: 'wall', x, y });
}

function wallCol(cover, x, y0, y1) {
  for (let y = y0; y <= y1; y += 14) cover.push({ type: 'wall', x, y });
}

function scatter(rng, arr, type, n, x0, x1, y0, y1) {
  for (let i = 0; i < n; i++) {
    arr.push({
      type,
      x: x0 + rng() * (x1 - x0),
      y: y0 + rng() * (y1 - y0),
    });
  }
}

function oasisCut(rng) {
  const length = 3400;
  const cover = [];
  const props = [];
  const water = [];
  const bridges = [];
  const enemies = [];
  const pows = [];
  const pickups = [];

  scatter(rng, props, 'palm', 10, 8, 40, 200, 3300);
  scatter(rng, props, 'palm', 10, 320, 350, 200, 3300);
  scatter(rng, props, 'tuft', 40, 20, 340, 80, 3300);
  scatter(rng, props, 'rock', 16, 30, 330, 80, 3300);
  props.push({ type: 'palm', x: 28, y: 3320 }, { type: 'palm', x: 330, y: 3320 });
  props.push({ type: 'palm', x: 22, y: 120 }, { type: 'palm', x: 336, y: 120 });

  // Start dunes — riflemen
  enemies.push(
    { type: 'rifleman', x: 80, y: 3280 },
    { type: 'rifleman', x: 280, y: 3260 },
    { type: 'rifleman', x: 180, y: 3200 },
  );
  cover.push({ type: 'sandbag', x: 70, y: 3220 }, { type: 'sandbag', x: 270, y: 3220 });
  cover.push({ type: 'crate', x: 200, y: 3100, drop: 'grenades' });

  // Open dunes + POW
  enemies.push(
    { type: 'rifleman', x: 60, y: 2920 },
    { type: 'rifleman', x: 300, y: 2880 },
    { type: 'rifleman', x: 140, y: 2780 },
    { type: 'charger', x: 240, y: 2760 },
  );
  pows.push({ x: 180, y: 2980 });
  cover.push({ type: 'sandbag', x: 50, y: 2840 }, { type: 'sandbag', x: 290, y: 2820 });
  cover.push({ type: 'crate', x: 110, y: 2720, drop: 'mg' });

  // Sandbag line + gun nest
  bagLine(cover, 16, 150, 2480, null, null);
  bagLine(cover, 210, 340, 2480, null, null);
  cover.push({ type: 'sandbag', x: 168, y: 2468 }, { type: 'sandbag', x: 190, y: 2468 });
  enemies.push(
    { type: 'gunnest', x: 180, y: 2448 },
    { type: 'rifleman', x: 70, y: 2420 },
    { type: 'rifleman', x: 290, y: 2420 },
    { type: 'rifleman', x: 120, y: 2360 },
  );
  pickups.push({ type: 'spread', x: 40, y: 2500 });

  // More dunes
  enemies.push(
    { type: 'charger', x: 90, y: 2220 },
    { type: 'charger', x: 270, y: 2180 },
    { type: 'rifleman', x: 180, y: 2140 },
  );
  cover.push({ type: 'crate', x: 300, y: 2200, drop: 'grenades' });

  // Pool / bridge crossing
  water.push({ x: 16, y: 1880, w: 128, h: 110 }, { x: 216, y: 1880, w: 128, h: 110 });
  bridges.push({ x: 144, y: 1880, w: 72, h: 110 });
  cover.push({ type: 'sandbag', x: 150, y: 2004 }, { type: 'sandbag', x: 188, y: 2004 });
  cover.push({ type: 'sandbag', x: 150, y: 1864 }, { type: 'sandbag', x: 188, y: 1864 });
  enemies.push(
    { type: 'rifleman', x: 70, y: 1840 },
    { type: 'rifleman', x: 290, y: 1840 },
    { type: 'rifleman', x: 110, y: 1780 },
    { type: 'grenadier', x: 250, y: 1760 },
  );
  pows.push({ x: 180, y: 2040 });
  props.push({ type: 'palm', x: 30, y: 2040 }, { type: 'palm', x: 328, y: 2040 });

  // Chargers after the water
  enemies.push(
    { type: 'charger', x: 60, y: 1640 },
    { type: 'charger', x: 300, y: 1620 },
    { type: 'rifleman', x: 180, y: 1580 },
    { type: 'rifleman', x: 100, y: 1520 },
  );
  cover.push({ type: 'crate', x: 50, y: 1560, drop: 'rocket' });

  // Barrel-stack ambush
  cover.push(
    { type: 'barrel', x: 160, y: 1360 },
    { type: 'barrel', x: 176, y: 1360 },
    { type: 'barrel', x: 168, y: 1344 },
    { type: 'barrel', x: 200, y: 1372 },
    { type: 'barrel', x: 144, y: 1372 },
    { type: 'barrel', x: 80, y: 1320 },
    { type: 'barrel', x: 260, y: 1310 },
    { type: 'crate', x: 220, y: 1400, drop: 'flame' },
  );
  bagLine(cover, 40, 120, 1420, null, null);
  bagLine(cover, 240, 330, 1420, null, null);
  enemies.push(
    { type: 'grenadier', x: 180, y: 1280 },
    { type: 'rifleman', x: 70, y: 1300 },
    { type: 'rifleman', x: 290, y: 1290 },
    { type: 'charger', x: 120, y: 1240 },
  );

  // Sniper ridge
  cover.push({ type: 'sandbag', x: 80, y: 1080 }, { type: 'sandbag', x: 260, y: 1060 });
  cover.push({ type: 'rock', x: 40, y: 1120 }, { type: 'rock', x: 320, y: 1100 });
  enemies.push(
    { type: 'sniper', x: 90, y: 980 },
    { type: 'sniper', x: 270, y: 960 },
    { type: 'rifleman', x: 180, y: 1040 },
    { type: 'rifleman', x: 50, y: 1020 },
  );
  pows.push({ x: 40, y: 1180 });
  pickups.push({ type: 'medal', x: 320, y: 1000 });

  // Walled compound approach
  wallCol(cover, 40, 520, 820);
  wallCol(cover, 304, 520, 820);
  bagLine(cover, 70, 150, 780, null, null);
  bagLine(cover, 210, 290, 780, null, null);
  enemies.push(
    { type: 'rifleman', x: 90, y: 740 },
    { type: 'rifleman', x: 270, y: 740 },
    { type: 'grenadier', x: 180, y: 680 },
    { type: 'charger', x: 120, y: 620 },
    { type: 'charger', x: 240, y: 600 },
  );
  cover.push({ type: 'crate', x: 180, y: 720, drop: 'oneup' });
  cover.push({ type: 'barrel', x: 60, y: 700 }, { type: 'barrel', x: 292, y: 700 });

  // End garrison + gate
  wallLine(cover, 16, 140, 80);
  wallLine(cover, 220, 340, 80);
  wallCol(cover, 16, 80, 280);
  wallCol(cover, 328, 80, 280);
  bagLine(cover, 50, 140, 260, null, null);
  bagLine(cover, 220, 310, 260, null, null);
  enemies.push(
    { type: 'gunnest', x: 180, y: 228 },
    { type: 'rifleman', x: 80, y: 200 },
    { type: 'rifleman', x: 280, y: 200 },
    { type: 'grenadier', x: 120, y: 140 },
    { type: 'rifleman', x: 240, y: 140 },
    { type: 'sniper', x: 180, y: 60 },
  );
  cover.push({ type: 'barrel', x: 70, y: 300 }, { type: 'barrel', x: 280, y: 300 });
  pickups.push({ type: 'grenades', x: 180, y: 320 });

  return {
    id: 0,
    name: TERRITORY_NAMES[0],
    length,
    palette: PALETTES[0],
    cover,
    props,
    water,
    bridges,
    enemies,
    pows,
    pickups,
    gateY: 90,
    ambient: { every: 220, types: ['rifleman', 'rifleman', 'charger'] },
  };
}

// Draft: Walled Mile — stone alleys, short.
function walledMile(rng) {
  const length = 1600;
  const cover = [];
  const props = [];
  const water = [];
  const bridges = [];
  const enemies = [];
  const pows = [];
  const pickups = [];
  scatter(rng, props, 'tuft', 12, 20, 340, 80, 1500);
  scatter(rng, props, 'rock', 8, 20, 340, 80, 1500);
  wallCol(cover, 48, 200, 1400);
  wallCol(cover, 296, 200, 1400);
  bagLine(cover, 80, 160, 1280, 110, 130);
  bagLine(cover, 200, 280, 1100, null, null);
  wallLine(cover, 70, 160, 900);
  wallLine(cover, 200, 290, 900);
  cover.push({ type: 'crate', x: 180, y: 1220, drop: 'mg' }, { type: 'barrel', x: 100, y: 980 });
  enemies.push(
    { type: 'rifleman', x: 100, y: 1450 },
    { type: 'rifleman', x: 260, y: 1400 },
    { type: 'gunnest', x: 180, y: 1078 },
    { type: 'charger', x: 90, y: 980 },
    { type: 'grenadier', x: 260, y: 860 },
    { type: 'rifleman', x: 140, y: 700 },
    { type: 'sniper', x: 220, y: 520 },
    { type: 'rifleman', x: 100, y: 300 },
    { type: 'gunnest', x: 180, y: 180 },
  );
  pows.push({ x: 180, y: 1500 });
  pickups.push({ type: 'spread', x: 70, y: 600 });
  wallLine(cover, 20, 140, 70);
  wallLine(cover, 220, 340, 70);
  return {
    id: 1,
    name: TERRITORY_NAMES[1],
    length,
    palette: PALETTES[1],
    cover,
    props,
    water,
    bridges,
    enemies,
    pows,
    pickups,
    gateY: 80,
    ambient: { every: 260, types: ['rifleman', 'charger'] },
    draft: true,
  };
}

// Draft: Blackwater Span — marsh + river.
function blackwater(rng) {
  const length = 1600;
  const cover = [];
  const props = [];
  const water = [];
  const bridges = [];
  const enemies = [];
  const pows = [];
  const pickups = [];
  scatter(rng, props, 'tuft', 20, 10, 350, 60, 1500);
  scatter(rng, props, 'palm', 8, 10, 50, 80, 1500);
  scatter(rng, props, 'palm', 8, 310, 350, 80, 1500);
  water.push({ x: 0, y: 1100, w: 150, h: 90 }, { x: 210, y: 1100, w: 150, h: 90 });
  bridges.push({ x: 150, y: 1100, w: 60, h: 90 });
  water.push({ x: 0, y: 560, w: 130, h: 80 }, { x: 200, y: 560, w: 160, h: 80 });
  bridges.push({ x: 130, y: 560, w: 70, h: 80 });
  bagLine(cover, 20, 140, 1220, null, null);
  enemies.push(
    { type: 'rifleman', x: 80, y: 1450 },
    { type: 'rifleman', x: 280, y: 1400 },
    { type: 'grenadier', x: 180, y: 1240 },
    { type: 'rifleman', x: 70, y: 1080 },
    { type: 'rifleman', x: 280, y: 1060 },
    { type: 'charger', x: 180, y: 900 },
    { type: 'sniper', x: 60, y: 740 },
    { type: 'gunnest', x: 180, y: 480 },
    { type: 'rifleman', x: 100, y: 300 },
    { type: 'grenadier', x: 260, y: 220 },
  );
  cover.push({ type: 'crate', x: 40, y: 980, drop: 'rocket' }, { type: 'barrel', x: 300, y: 800 });
  pows.push({ x: 40, y: 1300 });
  pickups.push({ type: 'grenades', x: 300, y: 1280 });
  return {
    id: 2,
    name: TERRITORY_NAMES[2],
    length,
    palette: PALETTES[2],
    cover,
    props,
    water,
    bridges,
    enemies,
    pows,
    pickups,
    gateY: 80,
    ambient: { every: 280, types: ['rifleman', 'charger'] },
    draft: true,
  };
}

// Draft: The Redoubt — fortress concrete.
function redoubt(rng) {
  const length = 1500;
  const cover = [];
  const props = [];
  const water = [];
  const bridges = [];
  const enemies = [];
  const pows = [];
  const pickups = [];
  scatter(rng, props, 'rock', 10, 20, 340, 80, 1400);
  wallCol(cover, 24, 100, 1300);
  wallCol(cover, 320, 100, 1300);
  wallLine(cover, 24, 140, 700);
  wallLine(cover, 220, 320, 700);
  bagLine(cover, 60, 150, 1180, null, null);
  bagLine(cover, 210, 300, 1180, null, null);
  cover.push(
    { type: 'barrel', x: 160, y: 900 },
    { type: 'barrel', x: 176, y: 900 },
    { type: 'barrel', x: 200, y: 920 },
    { type: 'crate', x: 80, y: 1000, drop: 'mg' },
  );
  enemies.push(
    { type: 'rifleman', x: 90, y: 1380 },
    { type: 'rifleman', x: 270, y: 1340 },
    { type: 'gunnest', x: 180, y: 1158 },
    { type: 'charger', x: 80, y: 980 },
    { type: 'charger', x: 280, y: 960 },
    { type: 'grenadier', x: 180, y: 820 },
    { type: 'sniper', x: 80, y: 640 },
    { type: 'sniper', x: 280, y: 620 },
    { type: 'rifleman', x: 140, y: 480 },
    { type: 'gunnest', x: 180, y: 200 },
    { type: 'rifleman', x: 80, y: 160 },
    { type: 'rifleman', x: 280, y: 160 },
  );
  pows.push({ x: 180, y: 1420 });
  pickups.push({ type: 'rocket', x: 40, y: 500 }, { type: 'oneup', x: 320, y: 400 });
  wallLine(cover, 24, 140, 60);
  wallLine(cover, 220, 336, 60);
  return {
    id: 3,
    name: TERRITORY_NAMES[3],
    length,
    palette: PALETTES[3],
    cover,
    props,
    water,
    bridges,
    enemies,
    pows,
    pickups,
    gateY: 80,
    ambient: { every: 240, types: ['rifleman', 'charger', 'grenadier'] },
    draft: true,
  };
}

const BUILDERS = [oasisCut, walledMile, blackwater, redoubt];

export function buildTerritory(index, seed) {
  const rng = typeof seed === 'function' ? seed : (function () {
    let a = (seed || 1) | 0;
    return () => {
      a = (a * 1664525 + 1013904223) >>> 0;
      return a / 4294967296;
    };
  })();
  const t = BUILDERS[index | 0] ? BUILDERS[index | 0](rng) : oasisCut(rng);
  t.width = WORLD_W;
  return t;
}

export { WORLD_W };
