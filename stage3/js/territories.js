/** Data-driven layouts. Four marches plus the short Iron Citadel approach. */
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
  {
    // The Iron Citadel — ash and iron
    mid: '#4a4038',
    dark: '#2a2420',
    light: '#6a5e54',
    streak: '#3a322c',
    water: '#2a3038',
    fog: '#4a4038',
    hud: '#100c0a',
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
  enemies.push(
    { type: 'mortar', x: 64, y: 1660 },
    { type: 'flamer', x: 292, y: 1480 },
    { type: 'truck', x: 180, y: 2088 },
    { type: 'jeep', x: 40, y: 1020 },
  );
  pows.push({ x: 46, y: 1390 });

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
    extractions: [
      { x: 308, y: 2080, r: 30 },
      { x: 180, y: 130, r: 42 },
    ],
    gateY: 90,
    ambient: { every: 220, types: ['rifleman', 'rifleman', 'charger', 'flamer'] },
  };
}

function building(cover, x, y, w, h) {
  cover.push({ type: 'building', x, y, w, h });
}

function walledMile(rng) {
  const length = 3400;
  const cover = [];
  const props = [];
  const water = [];
  const bridges = [];
  const enemies = [];
  const pows = [];
  const pickups = [];
  scatter(rng, props, 'tuft', 14, 140, 230, 200, 3300);
  scatter(rng, props, 'rock', 8, 140, 220, 400, 3200);

  // South plaza — open enough to deploy, then the street closes in.
  building(cover, 68, 3140, 116, 120);
  building(cover, 292, 3140, 116, 120);
  bagLine(cover, 130, 168, 3220, null, null);
  bagLine(cover, 200, 240, 3220, null, null);
  enemies.push(
    { type: 'rifleman', x: 150, y: 3180 },
    { type: 'rifleman', x: 220, y: 3160 },
    { type: 'rifleman', x: 180, y: 3080 },
    { type: 'charger', x: 250, y: 3040 },
  );
  pows.push({ x: 180, y: 3280 });
  cover.push({ type: 'crate', x: 160, y: 3060, drop: 'grenades' });

  // First street, rooftop snipers on the south parapets.
  building(cover, 68, 2860, 116, 150);
  building(cover, 292, 2860, 116, 150);
  enemies.push(
    { type: 'sniper', x: 100, y: 2942, elevated: true },
    { type: 'sniper', x: 250, y: 2942, elevated: true },
    { type: 'rifleman', x: 150, y: 2800 },
    { type: 'rifleman', x: 210, y: 2760 },
  );
  cover.push({ type: 'barrel', x: 150, y: 2820 }, { type: 'crate', x: 210, y: 2700, drop: 'mg' });

  // Alley gap with crates and barrels.
  building(cover, 68, 2520, 116, 140);
  building(cover, 292, 2520, 116, 140);
  cover.push(
    { type: 'crate', x: 150, y: 2600 },
    { type: 'barrel', x: 168, y: 2588 },
    { type: 'barrel', x: 184, y: 2604 },
    { type: 'barrel', x: 200, y: 2588 },
  );
  enemies.push(
    { type: 'rifleman', x: 140, y: 2480 },
    { type: 'grenadier', x: 220, y: 2460 },
    { type: 'charger', x: 180, y: 2400 },
    { type: 'sniper', x: 90, y: 2596, elevated: true },
  );
  pows.push({ x: 200, y: 2660 });

  // Market square ambush.
  bagLine(cover, 40, 120, 2140, null, null);
  bagLine(cover, 240, 330, 2140, null, null);
  bagLine(cover, 50, 130, 1880, null, null);
  bagLine(cover, 230, 320, 1880, null, null);
  cover.push(
    { type: 'crate', x: 80, y: 2020, drop: 'spread' },
    { type: 'crate', x: 280, y: 1980, drop: 'flame' },
    { type: 'barrel', x: 160, y: 1960 },
    { type: 'barrel', x: 176, y: 1972 },
    { type: 'barrel', x: 200, y: 1960 },
  );
  enemies.push(
    { type: 'rifleman', x: 70, y: 2080 },
    { type: 'rifleman', x: 290, y: 2060 },
    { type: 'rifleman', x: 120, y: 1940 },
    { type: 'grenadier', x: 240, y: 1920 },
    { type: 'flamer', x: 180, y: 1860 },
    { type: 'charger', x: 100, y: 1800 },
    { type: 'charger', x: 260, y: 1780 },
  );
  pows.push({ x: 180, y: 2088 });
  pickups.push({ type: 'rocket', x: 40, y: 1960 });

  // North street, mortar court, truck.
  building(cover, 68, 1560, 116, 160);
  building(cover, 292, 1560, 116, 160);
  building(cover, 68, 1240, 116, 140);
  building(cover, 292, 1240, 116, 140);
  enemies.push(
    { type: 'sniper', x: 110, y: 1648, elevated: true },
    { type: 'sniper', x: 250, y: 1648, elevated: true },
    { type: 'mortar', x: 160, y: 1480 },
    { type: 'rifleman', x: 210, y: 1420 },
    { type: 'truck', x: 180, y: 1360 },
    { type: 'rifleman', x: 150, y: 1180 },
    { type: 'flamer', x: 220, y: 1120 },
    { type: 'sniper', x: 96, y: 1316, elevated: true },
  );
  cover.push({ type: 'crate', x: 200, y: 1500, drop: 'oneup' }, { type: 'barrel', x: 150, y: 1200 });

  // Town gate.
  building(cover, 70, 520, 120, 160);
  building(cover, 290, 520, 120, 160);
  building(cover, 70, 220, 110, 120);
  building(cover, 290, 220, 110, 120);
  wallLine(cover, 16, 130, 80);
  wallLine(cover, 230, 344, 80);
  bagLine(cover, 140, 170, 360, null, null);
  bagLine(cover, 200, 230, 360, null, null);
  enemies.push(
    { type: 'sniper', x: 100, y: 288, elevated: true },
    { type: 'sniper', x: 260, y: 288, elevated: true },
    { type: 'gunnest', x: 180, y: 240 },
    { type: 'rifleman', x: 140, y: 180 },
    { type: 'rifleman', x: 220, y: 170 },
    { type: 'grenadier', x: 180, y: 120 },
  );
  pows.push({ x: 180, y: 460 });
  pickups.push({ type: 'grenades', x: 180, y: 300 });
  cover.push({ type: 'barrel', x: 150, y: 400 }, { type: 'barrel', x: 210, y: 400 });

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
    extractions: [
      { x: 180, y: 2000, r: 36 },
      { x: 180, y: 120, r: 40 },
    ],
    gateY: 90,
    ambient: { every: 240, types: ['rifleman', 'rifleman', 'charger', 'flamer'] },
  };
}

function blackwater(rng) {
  const length = 3400;
  const cover = [];
  const props = [];
  const water = [];
  const bridges = [];
  const enemies = [];
  const pows = [];
  const pickups = [];
  const mud = [];
  scatter(rng, props, 'tuft', 36, 16, 344, 80, 3300);
  scatter(rng, props, 'palm', 8, 12, 70, 200, 3300);
  scatter(rng, props, 'palm', 8, 290, 348, 200, 3300);

  enemies.push(
    { type: 'rifleman', x: 80, y: 3240 },
    { type: 'rifleman', x: 280, y: 3200 },
    { type: 'charger', x: 180, y: 3120 },
  );
  pows.push({ x: 180, y: 3300 });
  cover.push({ type: 'sandbag', x: 70, y: 3180 }, { type: 'sandbag', x: 280, y: 3160 });

  // First creek and plank bridge.
  water.push({ x: 0, y: 2920, w: 130, h: 90 }, { x: 230, y: 2920, w: 130, h: 90 });
  bridges.push({ x: 130, y: 2920, w: 100, h: 90 });
  bagLine(cover, 140, 180, 3030, null, null);
  bagLine(cover, 190, 230, 3030, null, null);
  enemies.push(
    { type: 'rifleman', x: 80, y: 2880 },
    { type: 'rifleman', x: 280, y: 2860 },
    { type: 'grenadier', x: 180, y: 2780 },
  );
  mud.push({ x: 30, y: 2700, w: 110, h: 70 }, { x: 230, y: 2580, w: 110, h: 60 });

  // Reed marsh and a pontoon.
  water.push({ x: 0, y: 2360, w: 150, h: 80 }, { x: 230, y: 2360, w: 130, h: 80 });
  bridges.push({ x: 150, y: 2360, w: 80, h: 80 });
  cover.push({ type: 'crate', x: 60, y: 2480, drop: 'mg' }, { type: 'barrel', x: 300, y: 2460 });
  enemies.push(
    { type: 'flamer', x: 90, y: 2520 },
    { type: 'rifleman', x: 200, y: 2280 },
    { type: 'rifleman', x: 300, y: 2240 },
    { type: 'mortar', x: 50, y: 2200 },
    { type: 'charger', x: 180, y: 2100 },
  );
  pows.push({ x: 300, y: 2500 });
  pickups.push({ type: 'spread', x: 40, y: 2300 });

  // The long bridge. Player holds near the north end while squads push down it.
  water.push({ x: 0, y: 1520, w: 360, h: 300 });
  bridges.push({ x: 140, y: 1520, w: 90, h: 300 });
  bridges.push({ x: 24, y: 1680, w: 46, h: 36 }, { x: 290, y: 1600, w: 46, h: 36 });
  bagLine(cover, 148, 168, 1808, null, null);
  bagLine(cover, 202, 224, 1808, null, null);
  enemies.push(
    { type: 'rifleman', x: 160, y: 1760 },
    { type: 'rifleman', x: 210, y: 1740 },
    { type: 'grenadier', x: 180, y: 1680 },
    { type: 'mortar', x: 70, y: 1460 },
    { type: 'mortar', x: 300, y: 1440 },
  );
  pows.push({ x: 180, y: 1860 });

  // Far bank after the hold.
  enemies.push(
    { type: 'truck', x: 180, y: 1360 },
    { type: 'rifleman', x: 80, y: 1280 },
    { type: 'flamer', x: 260, y: 1220 },
    { type: 'charger', x: 160, y: 1100 },
    { type: 'sniper', x: 40, y: 980 },
    { type: 'rifleman', x: 200, y: 860 },
  );
  cover.push({ type: 'crate', x: 40, y: 1100, drop: 'rocket' }, { type: 'barrel', x: 300, y: 900 });
  mud.push({ x: 180, y: 1000, w: 120, h: 50 });
  water.push({ x: 0, y: 620, w: 120, h: 70 }, { x: 220, y: 620, w: 140, h: 70 });
  bridges.push({ x: 120, y: 620, w: 100, h: 70 });
  enemies.push(
    { type: 'rifleman', x: 80, y: 560 },
    { type: 'rifleman', x: 280, y: 540 },
    { type: 'gunnest', x: 180, y: 360 },
    { type: 'grenadier', x: 120, y: 240 },
    { type: 'rifleman', x: 240, y: 180 },
  );
  pows.push({ x: 180, y: 480 });
  pickups.push({ type: 'grenades', x: 300, y: 400 }, { type: 'medal', x: 40, y: 280 });
  bagLine(cover, 40, 140, 200, null, null);
  bagLine(cover, 220, 320, 200, null, null);

  return {
    id: 2,
    name: TERRITORY_NAMES[2],
    length,
    palette: PALETTES[2],
    cover,
    props,
    water,
    bridges,
    mud,
    enemies,
    pows,
    pickups,
    extractions: [
      { x: 180, y: 2100, r: 34 },
      { x: 180, y: 120, r: 40 },
    ],
    hold: {
      triggerY: 1760,
      x0: 140,
      x1: 230,
      lineY: 1588,
      duration: 24,
      banner: 'HOLD THE BRIDGE',
    },
    gateY: 90,
    ambient: { every: 250, types: ['rifleman', 'charger', 'flamer'] },
  };
}

function redoubt(rng) {
  const length = 3300;
  const cover = [];
  const props = [];
  const water = [];
  const bridges = [];
  const enemies = [];
  const pows = [];
  const pickups = [];
  scatter(rng, props, 'rock', 16, 20, 340, 80, 3200);

  function traps(y) {
    for (let x = 36; x <= 330; x += 28) {
      if (x > 150 && x < 214) continue;
      cover.push({ type: 'tanktrap', x, y });
    }
  }
  function bunkerAt(x, y) {
    cover.push({ type: 'bunker', x, y, w: 40, h: 30 });
    enemies.push({ type: 'bunker', x, y: y - 2 });
  }

  enemies.push(
    { type: 'rifleman', x: 90, y: 3180 },
    { type: 'rifleman', x: 270, y: 3140 },
    { type: 'charger', x: 180, y: 3060 },
  );
  pows.push({ x: 180, y: 3240 });
  bagLine(cover, 40, 140, 3100, null, null);
  bagLine(cover, 220, 320, 3100, null, null);

  traps(2920);
  cover.push({ type: 'wire', x: 90, y: 2840, w: 70, h: 18 }, { type: 'wire', x: 270, y: 2840, w: 70, h: 18 });
  bunkerAt(100, 2740);
  bunkerAt(260, 2700);
  enemies.push(
    { type: 'rifleman', x: 180, y: 2660 },
    { type: 'grenadier', x: 140, y: 2580 },
    { type: 'mortar', x: 50, y: 2500 },
  );
  cover.push({ type: 'crate', x: 180, y: 2600, drop: 'rocket' });

  // Trench line.
  bagLine(cover, 24, 140, 2320, null, null);
  bagLine(cover, 220, 336, 2320, null, null);
  bagLine(cover, 40, 150, 2200, null, null);
  bagLine(cover, 210, 320, 2200, null, null);
  enemies.push(
    { type: 'rifleman', x: 80, y: 2260 },
    { type: 'rifleman', x: 180, y: 2240 },
    { type: 'rifleman', x: 280, y: 2220 },
    { type: 'flamer', x: 200, y: 2140 },
    { type: 'charger', x: 100, y: 2080 },
  );
  pows.push({ x: 40, y: 2360 });
  traps(2000);
  cover.push({ type: 'wire', x: 180, y: 1920, w: 90, h: 16 });

  bunkerAt(180, 1840);
  enemies.push(
    { type: 'mortar', x: 60, y: 1760 },
    { type: 'mortar', x: 300, y: 1720 },
    { type: 'jeep', x: 40, y: 1600 },
    { type: 'rifleman', x: 140, y: 1500 },
    { type: 'grenadier', x: 240, y: 1460 },
  );
  cover.push(
    { type: 'barrel', x: 160, y: 1540 },
    { type: 'barrel', x: 176, y: 1552 },
    { type: 'barrel', x: 196, y: 1540 },
    { type: 'crate', x: 300, y: 1580, drop: 'mg' },
  );
  pows.push({ x: 300, y: 1640 });
  pickups.push({ type: 'flame', x: 40, y: 1480 });

  wallCol(cover, 28, 900, 1400);
  wallCol(cover, 332, 900, 1400);
  traps(1280);
  bunkerAt(90, 1180);
  bunkerAt(270, 1140);
  enemies.push(
    { type: 'rifleman', x: 180, y: 1080 },
    { type: 'sniper', x: 50, y: 980 },
    { type: 'sniper', x: 310, y: 960 },
    { type: 'truck', x: 180, y: 900 },
    { type: 'flamer', x: 120, y: 780 },
    { type: 'charger', x: 240, y: 720 },
  );
  cover.push({ type: 'wire', x: 180, y: 860, w: 100, h: 18 });
  cover.push({ type: 'crate', x: 180, y: 640, drop: 'oneup' });

  // Fortress gate.
  wallLine(cover, 20, 130, 70);
  wallLine(cover, 230, 340, 70);
  wallCol(cover, 20, 70, 280);
  wallCol(cover, 340, 70, 280);
  bunkerAt(110, 240);
  bunkerAt(250, 240);
  bagLine(cover, 140, 170, 300, null, null);
  bagLine(cover, 200, 230, 300, null, null);
  traps(360);
  enemies.push(
    { type: 'gunnest', x: 180, y: 180 },
    { type: 'rifleman', x: 150, y: 140 },
    { type: 'rifleman', x: 210, y: 130 },
    { type: 'mortar', x: 180, y: 400 },
  );
  pows.push({ x: 180, y: 480 });
  pickups.push({ type: 'rocket', x: 40, y: 200 }, { type: 'grenades', x: 320, y: 200 });

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
    extractions: [
      { x: 180, y: 2100, r: 34 },
      { x: 180, y: 110, r: 42 },
    ],
    gateY: 80,
    ambient: { every: 230, types: ['rifleman', 'charger', 'grenadier', 'flamer'] },
  };
}

function ironCitadel() {
  const length = 1480;
  const cover = [];
  const props = [];
  const enemies = [];
  const pickups = [];

  wallCol(cover, 28, 460, 1420);
  wallCol(cover, 332, 460, 1420);
  props.push({ type: 'rock', x: 48, y: 1400 }, { type: 'rock', x: 312, y: 1390 });

  enemies.push(
    { type: 'rifleman', x: 110, y: 1320 },
    { type: 'rifleman', x: 250, y: 1280 },
    { type: 'charger', x: 180, y: 1220 },
  );
  cover.push({ type: 'crate', x: 80, y: 1240, drop: 'grenades' });
  cover.push({ type: 'sandbag', x: 200, y: 1260 });

  bagLine(cover, 60, 140, 1080, null, null);
  bagLine(cover, 220, 300, 1080, null, null);
  enemies.push(
    { type: 'gunnest', x: 180, y: 1048 },
    { type: 'rifleman', x: 90, y: 980 },
    { type: 'rifleman', x: 280, y: 960 },
  );
  cover.push({ type: 'crate', x: 300, y: 1000, drop: 'mg' });

  enemies.push(
    { type: 'mortar', x: 70, y: 820 },
    { type: 'rifleman', x: 200, y: 760 },
    { type: 'charger', x: 300, y: 700 },
  );
  pickups.push({ type: 'rocket', x: 180, y: 860 });
  cover.push({ type: 'crate', x: 300, y: 640, drop: 'grenades' });
  cover.push({ type: 'barrel', x: 60, y: 600 });

  // Checkpoint gate, then an open court for the war machine.
  wallLine(cover, 28, 130, 430);
  wallLine(cover, 230, 332, 430);
  cover.push({ type: 'sandbag', x: 160, y: 470 }, { type: 'sandbag', x: 200, y: 470 });

  return {
    id: 4,
    name: TERRITORY_NAMES[4],
    length,
    palette: PALETTES[4],
    cover,
    props,
    water: [],
    bridges: [],
    mud: [],
    enemies,
    pows: [],
    pickups,
    extractions: [],
    gateY: -80,
    bossArena: { triggerY: 300, checkpointY: 480 },
    ambient: { every: 5000, types: ['rifleman'] },
  };
}

const BUILDERS = [oasisCut, walledMile, blackwater, redoubt, ironCitadel];

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
