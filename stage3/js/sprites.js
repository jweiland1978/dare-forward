/** Procedural pixel-art sprites, drawn to offscreen canvases at load. */
import { mulberry32 } from './config.js?v=2';

function make(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  fn(g, w, h);
  return c;
}

function R(g, x, y, w, h, c) {
  g.fillStyle = c;
  g.fillRect(x | 0, y | 0, w, h);
}

const P = {
  skin: '#e0b890',
  skinD: '#c49468',
  beret: '#8b1e3a',
  beretD: '#5c1026',
  khaki: '#c4a86a',
  khakiD: '#9a7e48',
  khakiL: '#d4c08a',
  boot: '#3a2a1c',
  pack: '#6a5438',
  rifle: '#3a3228',
  metal: '#8a8a82',
  helm: '#5a6356',
  helmL: '#7a8474',
  uni: '#6d7a64',
  uniD: '#4e5848',
  uniL: '#8a9878',
  pow: '#3d6cb0',
  powD: '#2a4a88',
  powP: '#2a3a68',
  hair: '#2a2018',
  sand: '#c9a66a',
  sandD: '#a88448',
  wood: '#8a6238',
  woodD: '#6a4628',
  woodL: '#b88850',
  barrel: '#c43c28',
  barrelD: '#8a2418',
  stone: '#7a7268',
  stoneD: '#5a544c',
  palm: '#2f8a38',
  palmD: '#1e5c24',
  trunk: '#7a4a28',
  rock: '#8a7a60',
  tuft: '#6a7a38',
};

function soldier(kind, dir, frame) {
  return make(18, 26, (g) => {
    const player = kind === 'player';
    const pow = kind === 'pow';
    const uni = player ? P.khaki : pow ? P.pow : P.uni;
    const uniD = player ? P.khakiD : pow ? P.powD : P.uniD;
    const uniL = player ? P.khakiL : pow ? '#6a92c8' : P.uniL;
    const legOff = frame ? 1 : 0;
    const other = frame ? 0 : 1;

    if (dir === 'down' || dir === 'up') {
      R(g, 5, 21 + (dir === 'down' ? legOff : other), 4, 5, P.boot);
      R(g, 9, 21 + (dir === 'down' ? other : legOff), 4, 5, P.boot);
      R(g, 5, 16, 8, 6, uni);
      R(g, 4, 16, 10, 3, uniD);
      if (player) R(g, 5, 14, 8, 5, P.pack);
      R(g, 5, 9, 8, 7, uniL);
      R(g, 6, 10, 6, 5, uni);
      R(g, 6, 4, 6, 6, P.skin);
      R(g, 7, 6, 4, 3, P.skinD);
      if (player) {
        R(g, 4, 2, 10, 4, P.beret);
        R(g, 4, 1, 8, 2, P.beretD);
        R(g, 12, 2, 3, 3, P.beret);
      } else if (pow) {
        R(g, 6, 3, 6, 3, P.hair);
        R(g, 7, 8, 2, 2, P.skinD);
      } else {
        R(g, 4, 2, 10, 5, P.helm);
        R(g, 5, 1, 8, 2, P.helmL);
        R(g, 3, 5, 12, 2, P.helm);
      }
      if (!pow) {
        if (dir === 'down') {
          R(g, 13, 11, 2, 10, P.rifle);
          R(g, 13, 10, 3, 2, P.metal);
        } else {
          R(g, 3, 11, 2, 8, P.rifle);
        }
      }
    } else {
      const L = dir === 'left';
      const hx = L ? 4 : 6;
      R(g, L ? 6 : 8, 21 + legOff, 4, 5, P.boot);
      R(g, L ? 9 : 5, 21 + other, 4, 5, P.boot);
      R(g, 5, 15, 8, 7, uni);
      R(g, 5, 15, 8, 2, uniD);
      if (player) R(g, 6, 13, 6, 5, P.pack);
      R(g, 5, 9, 8, 7, uniL);
      R(g, hx, 4, 7, 6, P.skin);
      if (player) {
        R(g, hx - 1, 2, 10, 4, P.beret);
        R(g, hx, 1, 8, 2, P.beretD);
      } else if (pow) {
        R(g, hx, 3, 7, 3, P.hair);
      } else {
        R(g, hx - 1, 2, 10, 5, P.helm);
        R(g, hx, 1, 8, 2, P.helmL);
      }
      if (!pow) {
        const rx = L ? 1 : 13;
        R(g, rx, 12, 5, 2, P.rifle);
        R(g, L ? 1 : 16, 11, 2, 2, P.metal);
        R(g, L ? 0 : 16, 10, 2, 6, P.rifle);
      }
    }
  });
}

function sandbag() {
  return make(22, 12, (g) => {
    R(g, 1, 6, 20, 6, '#b08a4a');
    R(g, 2, 7, 8, 4, '#c9a05a');
    R(g, 11, 7, 8, 4, '#a07840');
    R(g, 2, 1, 18, 6, '#c4a060');
    R(g, 3, 2, 7, 4, '#d4b070');
    R(g, 12, 2, 7, 4, '#b89050');
    R(g, 1, 5, 20, 1, '#8a6a38');
  });
}

function crate() {
  return make(14, 14, (g) => {
    R(g, 1, 1, 12, 12, P.wood);
    R(g, 2, 2, 10, 10, P.woodL);
    R(g, 1, 6, 12, 2, P.woodD);
    R(g, 6, 1, 2, 12, P.woodD);
    R(g, 4, 4, 6, 2, '#d4c070');
  });
}

function barrel() {
  return make(12, 16, (g) => {
    R(g, 2, 1, 8, 14, P.barrel);
    R(g, 3, 2, 6, 12, '#e05030');
    R(g, 2, 4, 8, 2, P.barrelD);
    R(g, 2, 10, 8, 2, P.barrelD);
    R(g, 4, 6, 4, 3, '#f0e8c0');
    R(g, 5, 7, 2, 1, P.barrelD);
  });
}

function wallSeg() {
  return make(16, 14, (g) => {
    R(g, 0, 2, 16, 12, P.stone);
    R(g, 0, 2, 16, 1, P.stoneD);
    R(g, 1, 4, 6, 4, '#8a8278');
    R(g, 8, 4, 7, 4, '#6a645c');
    R(g, 1, 9, 7, 4, '#6a645c');
    R(g, 9, 9, 6, 4, '#8a8278');
    R(g, 0, 7, 16, 1, P.stoneD);
  });
}

function palm() {
  return make(28, 36, (g) => {
    R(g, 13, 14, 3, 22, P.trunk);
    R(g, 14, 14, 1, 22, '#9a6238');
    R(g, 12, 12, 4, 4, P.trunk);
    // fronds
    R(g, 13, 6, 3, 8, P.palm);
    R(g, 4, 8, 10, 3, P.palmD);
    R(g, 15, 8, 10, 3, P.palm);
    R(g, 2, 11, 8, 3, P.palm);
    R(g, 18, 11, 8, 3, P.palmD);
    R(g, 8, 3, 5, 4, '#3caa44');
    R(g, 16, 3, 5, 4, P.palmD);
    R(g, 11, 1, 6, 4, P.palm);
    R(g, 6, 14, 4, 2, P.palm);
    R(g, 18, 14, 4, 2, P.palmD);
  });
}

function rock() {
  return make(14, 10, (g) => {
    R(g, 2, 3, 10, 7, P.rock);
    R(g, 4, 1, 7, 8, '#9a8a70');
    R(g, 3, 5, 4, 4, '#6a5e48');
  });
}

function tuft() {
  return make(12, 8, (g) => {
    R(g, 5, 4, 2, 4, '#5a4a28');
    R(g, 2, 2, 3, 4, P.tuft);
    R(g, 6, 1, 3, 5, '#7a8a40');
    R(g, 8, 3, 3, 3, P.tuft);
  });
}

function bridge() {
  return make(16, 12, (g) => {
    R(g, 0, 1, 16, 10, P.woodD);
    for (let i = 0; i < 4; i++) R(g, 1, 2 + i * 2, 14, 2, i % 2 ? P.wood : P.woodL);
    R(g, 0, 0, 16, 1, P.wood);
    R(g, 0, 11, 16, 1, P.wood);
  });
}

function gunnest() {
  return make(26, 20, (g) => {
    R(g, 1, 10, 24, 9, '#b08a4a');
    R(g, 2, 11, 10, 6, '#c9a05a');
    R(g, 13, 11, 10, 6, '#a07840');
    R(g, 3, 4, 8, 8, P.uni);
    R(g, 4, 1, 6, 5, P.helm);
    R(g, 10, 6, 12, 3, P.rifle);
    R(g, 20, 5, 4, 4, P.metal);
  });
}

function pickupIcon(id) {
  return make(12, 12, (g) => {
    R(g, 1, 1, 10, 10, '#1a1810');
    R(g, 2, 2, 8, 8, '#2a2418');
    if (id === 'spread') {
      R(g, 3, 5, 6, 2, '#e0c060');
      R(g, 8, 3, 2, 2, '#e0c060');
      R(g, 8, 7, 2, 2, '#e0c060');
    } else if (id === 'mg') {
      R(g, 2, 5, 8, 2, '#c0c0b0');
      R(g, 3, 4, 4, 4, '#8a8a80');
    } else if (id === 'rocket') {
      R(g, 3, 5, 7, 2, '#d05030');
      R(g, 2, 4, 3, 4, '#e0d0a0');
    } else if (id === 'flame') {
      R(g, 4, 3, 4, 6, '#ff8020');
      R(g, 5, 2, 2, 3, '#ffe060');
    } else if (id === 'grenades') {
      R(g, 3, 3, 3, 6, '#3a6a38');
      R(g, 7, 3, 3, 6, '#3a6a38');
    } else if (id === 'medal') {
      R(g, 4, 3, 4, 6, '#e0c040');
      R(g, 5, 2, 2, 2, '#f0e080');
    } else if (id === 'oneup') {
      R(g, 3, 3, 6, 6, '#e05050');
      R(g, 5, 2, 2, 8, '#e05050');
    } else {
      R(g, 4, 4, 4, 4, '#ccc');
    }
  });
}

function grenadeSpr() {
  return make(6, 8, (g) => {
    R(g, 1, 2, 4, 5, '#3a6a38');
    R(g, 2, 1, 2, 2, '#8a8a70');
    R(g, 2, 3, 2, 3, '#4a8a44');
  });
}

function rocketSpr() {
  return make(8, 4, (g) => {
    R(g, 0, 1, 6, 2, '#c0b8a0');
    R(g, 5, 0, 3, 4, '#d05030');
    R(g, 1, 0, 2, 4, '#8a8478');
  });
}

function waterTile(seed) {
  const rng = mulberry32(seed);
  return make(24, 24, (g) => {
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 24; x++) {
        const n = rng();
        const c = n < 0.25 ? '#1e4a52' : n < 0.6 ? '#2a6a70' : n < 0.85 ? '#34808a' : '#3a90a0';
        R(g, x, y, 1, 1, c);
      }
    }
  });
}

function groundTile(palette, seed) {
  const rng = mulberry32(seed);
  return make(32, 32, (g) => {
    R(g, 0, 0, 32, 32, palette.mid);
    for (let i = 0; i < 18; i++) {
      const x = (rng() * 32) | 0;
      const y = (rng() * 32) | 0;
      const w = 3 + ((rng() * 8) | 0);
      const h = 2 + ((rng() * 5) | 0);
      const n = rng();
      const c = n < 0.35 ? palette.dark : n > 0.7 ? palette.light : palette.streak;
      R(g, x, y, w, h, c);
    }
  });
}

const DIRS = ['down', 'up', 'left', 'right'];
const KINDS = ['player', 'enemy', 'pow'];

export const SPRITES = {
  units: {},
  cover: {},
  pickups: {},
  ground: {},
  ready: false,
};

export function buildSprites(palettes) {
  for (const k of KINDS) {
    SPRITES.units[k] = {};
    for (const d of DIRS) {
      SPRITES.units[k][d] = [soldier(k, d, 0), soldier(k, d, 1)];
    }
  }
  SPRITES.cover.sandbag = sandbag();
  SPRITES.cover.crate = crate();
  SPRITES.cover.barrel = barrel();
  SPRITES.cover.wall = wallSeg();
  SPRITES.cover.palm = palm();
  SPRITES.cover.rock = rock();
  SPRITES.cover.tuft = tuft();
  SPRITES.cover.bridge = bridge();
  SPRITES.cover.gunnest = gunnest();
  SPRITES.grenade = grenadeSpr();
  SPRITES.rocket = rocketSpr();
  SPRITES.water = waterTile(7);
  for (const id of ['spread', 'mg', 'rocket', 'flame', 'grenades', 'medal', 'oneup']) {
    SPRITES.pickups[id] = pickupIcon(id);
  }
  SPRITES.ground = {};
  palettes.forEach((p, i) => {
    SPRITES.ground[i] = [
      groundTile(p, 11 + i * 9),
      groundTile(p, 41 + i * 9),
      groundTile(p, 71 + i * 9),
    ];
  });
  SPRITES.ready = true;
}

export function unitSprite(kind, facingX, facingY, walkT) {
  const dir =
    Math.abs(facingX) > Math.abs(facingY) ? (facingX < 0 ? 'left' : 'right') : facingY < 0 ? 'up' : 'down';
  const frame = ((walkT * 8) | 0) % 2;
  const pack = SPRITES.units[kind] || SPRITES.units.enemy;
  return pack[dir][frame];
}
