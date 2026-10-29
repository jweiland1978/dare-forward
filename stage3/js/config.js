/** Dare Forward — Stage 3 constants. */
export const GAME_TITLE = 'Dare Forward';

export const WORLD_W = 360;
export const TICK_HZ = 60;
export const TICK = 1 / TICK_HZ;
export const PARTICLE_CAP = 1200;
export const SOLDIER_H = 26;

export const STORAGE_BEST = 'df2-best';
export const STORAGE_VOL = 'df2-volume';
export const STORAGE_MUSIC = 'df2-music';
export const STORAGE_DIFF = 'df2-difficulty';

// CSS pixels per world unit. viewW/viewH are chosen in resize() from these.
// Owner approved the Stage 2 sizes on every device; keep them.
// Laptop often hits the WORLD_W cap, so the live scale can sit a bit above the target.
export const TARGET_SCALE = {
  phone: 2.0,
  phoneLand: 1.98,
  ipad: 2.55,
  laptop: 3.1,
};

// Combat multipliers. Shields and loadout apply on the next deploy/restart.
// fireRateMul > 1 means slower shooting. aimError is the full ± spread (radians).
export const DIFFICULTY = {
  easy: {
    enemyMul: 0.7,
    fireRateMul: 1.9,
    bulletSpeedMul: 0.7,
    reactMul: 1.85,
    aimError: 0.58,
    grenadeWarn: 1.15,
    mortarWarn: 1.5,
    lives: 5,
    grenades: 7,
    dropRate: 0.34,
    ambientEveryMul: 1.7,
    respawnShield: 3.4,
    startShield: 3.8,
    bossHp: 0.7,
    bossTele: 1.4,
    bossAdds: 2,
  },
  normal: {
    enemyMul: 1,
    fireRateMul: 1.22,
    bulletSpeedMul: 0.88,
    reactMul: 1.22,
    aimError: 0.36,
    grenadeWarn: 0.72,
    mortarWarn: 1.05,
    lives: 3,
    grenades: 5,
    dropRate: 0.18,
    ambientEveryMul: 1,
    respawnShield: 2.5,
    startShield: 3.0,
    bossHp: 1,
    bossTele: 1.05,
    bossAdds: 2,
  },
  hard: {
    enemyMul: 1.4,
    fireRateMul: 0.9,
    bulletSpeedMul: 1.04,
    reactMul: 0.95,
    reactRand: 0.1,
    aimError: 0.04,
    fireJitter: 0.1,
    grenadeWarn: 0.5,
    mortarWarn: 0.68,
    lives: 3,
    grenades: 4,
    dropRate: 0.1,
    ambientEveryMul: 0.7,
    respawnShield: 1.8,
    startShield: 3.05,
    bossHp: 1.32,
    bossTele: 0.9,
    bossAdds: 3,
  },
};

export function loadDifficulty() {
  try {
    const v = localStorage.getItem(STORAGE_DIFF);
    if (DIFFICULTY[v]) return v;
  } catch {
    /* ignore */
  }
  return 'normal';
}

export function saveDifficulty(id) {
  if (!DIFFICULTY[id]) return;
  try {
    localStorage.setItem(STORAGE_DIFF, id);
  } catch {
    /* ignore */
  }
}

export const PLAYER_SPEED = 82;
export const PLAYER_RADIUS = 7;
export const PLAYER_LIVES = 3;
export const START_GRENADES = 5;
export const GRENADE_RANGE = 110;
export const GRENADE_RADIUS = 38;
export const GRENADE_SELF_RADIUS = 20;
export const INVULN_TIME = 2.0;
export const THROW_CD = 0.55;

export const RANKS = [
  { score: 0, name: 'Private' },
  { score: 800, name: 'Corporal' },
  { score: 2000, name: 'Sergeant' },
  { score: 4500, name: 'Lieutenant' },
  { score: 9000, name: 'Captain' },
  { score: 16000, name: 'Major' },
  { score: 25000, name: 'Colonel' },
  { score: 40000, name: 'General' },
];

export function rankFor(score) {
  let name = RANKS[0].name;
  for (const r of RANKS) if (score >= r.score) name = r.name;
  return name;
}

export const TERRITORY_NAMES = [
  'Oasis Cut',
  'Walled Mile',
  'Blackwater Span',
  'The Redoubt',
  'The Iron Citadel',
];

export const REDUCED_MOTION = (() => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
})();

export function mulberry32(seed) {
  let a = seed | 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function len(x, y) {
  return Math.hypot(x, y) || 1;
}

export function norm(x, y) {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
}

export function dir8(x, y) {
  if (x === 0 && y === 0) return { x: 0, y: -1 };
  const a = Math.atan2(y, x);
  const oct = Math.round(a / (Math.PI / 4));
  const n = ((oct % 8) + 8) % 8;
  const table = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];
  const [dx, dy] = table[n];
  const l = Math.hypot(dx, dy);
  return { x: dx / l, y: dy / l, oct: n };
}

export function facingName(x, y) {
  if (Math.abs(x) > Math.abs(y)) return x < 0 ? 'left' : 'right';
  return y < 0 ? 'up' : 'down';
}

export function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

export function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function nowMs() {
  return performance.now();
}
