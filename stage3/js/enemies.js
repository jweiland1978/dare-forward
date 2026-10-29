/** Enemy types + state-machine AI. Data-driven. */
import { dist2, norm, clamp, WORLD_W } from './config.js?v=1';

export const ENEMY_TYPES = {
  rifleman: {
    id: 'rifleman',
    hp: 1,
    speed: 42,
    score: 100,
    radius: 7,
    behavior: 'rifleman',
    fireRate: 0.55,
    bulletSpeed: 150,
    range: 170,
    color: 'enemy',
  },
  charger: {
    id: 'charger',
    hp: 1,
    speed: 96,
    score: 150,
    radius: 7,
    behavior: 'charger',
    fireRate: 0.38,
    bulletSpeed: 140,
    range: 130,
    color: 'enemy',
  },
  grenadier: {
    id: 'grenadier',
    hp: 1,
    speed: 38,
    score: 200,
    radius: 7,
    behavior: 'grenadier',
    fireRate: 2.4,
    range: 200,
    color: 'enemy',
  },
  gunnest: {
    id: 'gunnest',
    hp: 3,
    speed: 0,
    score: 400,
    radius: 9,
    behavior: 'gunnest',
    fireRate: 0.09,
    bulletSpeed: 190,
    range: 220,
    color: 'enemy',
    stationary: true,
  },
  sniper: {
    id: 'sniper',
    hp: 1,
    speed: 18,
    score: 300,
    radius: 7,
    behavior: 'sniper',
    fireRate: 2.6,
    bulletSpeed: 420,
    range: 280,
    color: 'enemy',
  },
  mortar: {
    id: 'mortar',
    hp: 3,
    speed: 0,
    score: 350,
    radius: 10,
    behavior: 'mortar',
    fireRate: 2.8,
    range: 260,
    color: 'enemy',
    stationary: true,
  },
  truck: {
    id: 'truck',
    hp: 8,
    speed: 72,
    score: 400,
    radius: 14,
    behavior: 'truck',
    color: 'enemy',
  },
  jeep: {
    id: 'jeep',
    hp: 5,
    speed: 118,
    score: 350,
    radius: 11,
    behavior: 'jeep',
    fireRate: 0.42,
    bulletSpeed: 200,
    range: 200,
    color: 'enemy',
  },
  flamer: {
    id: 'flamer',
    hp: 3,
    speed: 40,
    score: 250,
    radius: 8,
    behavior: 'flamer',
    fireRate: 0.14,
    range: 60,
    color: 'enemy',
  },
  bunker: {
    id: 'bunker',
    hp: 6,
    speed: 0,
    score: 500,
    radius: 10,
    behavior: 'bunker',
    fireRate: 0.11,
    bulletSpeed: 200,
    range: 230,
    color: 'enemy',
    stationary: true,
  },
};

function fmul(api) {
  return api.diff ? api.diff.fireRateMul : 1;
}
function bmul(api, speed) {
  return speed * (api.diff ? api.diff.bulletSpeedMul : 1);
}

const REACT_MIN = 1.3;
const REACT_RAND = 0.8;
export const ENEMY_TYPE_IDS = Object.keys(ENEMY_TYPES);

function losBlocked(api, x0, y0, x1, y1, ignore) {
  return api.coverBlocksLos(x0, y0, x1, y1, ignore);
}

function nearestCover(api, e) {
  let best = null;
  let bestD = 70 * 70;
  for (const c of api.cover) {
    if (!c.alive || !c.blocksWalk) continue;
    if (c.type !== 'sandbag' && c.type !== 'wall' && c.type !== 'crate') continue;
    const d = dist2(e.x, e.y, c.x, c.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function moveToward(e, tx, ty, speed, dt, api) {
  const n = norm(tx - e.x, ty - e.y);
  e.vx = n.x * speed;
  e.vy = n.y * speed;
  api.tryMove(e, e.vx * dt, e.vy * dt);
  e.facingX = n.x;
  e.facingY = n.y;
  e.walkT += dt;
}

function facePlayer(e, p) {
  const n = norm(p.x - e.x, p.y - e.y);
  e.facingX = n.x;
  e.facingY = n.y;
}

function inView(e, api) {
  const camX = api.camX || 0;
  const viewW = api.viewW || 360;
  const m = 18;
  const top = e.type === 'sniper' ? api.camY - 72 : api.camY - 8;
  return (
    e.x > camX - m &&
    e.x < camX + viewW + m &&
    e.y > top &&
    e.y < api.camY + api.viewH + 30
  );
}

const BEHAVIORS = {
  rifleman(e, api, dt) {
    const p = api.player;
    if (!p.alive || !inView(e, api)) {
      e.state = 'patrol';
      return;
    }
    const d2 = dist2(e.x, e.y, p.x, p.y);
    const agr = api.aggression;
    e.cd = (e.cd || 0) - dt;
    e.stateT = (e.stateT || 0) - dt;

    if (!e.state) e.state = 'patrol';

    if (e.state === 'patrol') {
      if (!e.px) {
        e.px = e.x + (api.rng() * 50 - 25);
        e.py = e.y + (api.rng() * 20 - 6);
      }
      moveToward(e, e.px, e.py, e.def.speed * 0.7, dt, api);
      if (dist2(e.x, e.y, e.px, e.py) < 80 || e.stateT <= 0) {
        e.px = clamp(e.x + (api.rng() * 70 - 35), 16, WORLD_W - 16);
        e.py = e.y + (api.rng() * 24 - 10);
        e.stateT = 1.2 + api.rng();
      }
      if (d2 < 180 * 180) {
        const cov = nearestCover(api, e);
        if (cov) {
          e.cover = cov;
          e.state = 'takeCover';
          e.stateT = 2;
        } else if (d2 < e.def.range * e.def.range) {
          e.state = 'fire';
          e.shots = 1 + ((api.rng() * 3) | 0);
          if (api.diff && api.diff.enemyMul >= 1.25) e.shots = 4;
          e.stateT = 1.2;
        }
      }
    } else if (e.state === 'takeCover') {
      const c = e.cover;
      if (!c || !c.alive) {
        e.state = 'patrol';
        return;
      }
      const side = e.x < c.x ? -1 : 1;
      const tx = c.x + side * (c.w * 0.5 + 10);
      const ty = c.y + 4;
      moveToward(e, tx, ty, e.def.speed, dt, api);
      if (dist2(e.x, e.y, tx, ty) < 100 || e.stateT <= 0) {
        e.state = 'peek';
        e.stateT = 0.35;
      }
    } else if (e.state === 'peek') {
      const c = e.cover;
      facePlayer(e, p);
      e.vx = e.vy = 0;
      if (c && c.alive) {
        const side = e.x < c.x ? -1 : 1;
        const tx = c.x + side * (c.w * 0.5 + 14);
        const ty = c.y + 8;
        moveToward(e, tx, ty, e.def.speed * 0.8, dt, api);
      }
      if (e.stateT <= 0) {
        e.state = 'fire';
        e.shots = 1 + ((api.rng() * (2 + agr)) | 0);
        e.stateT = 1.4;
      }
    } else if (e.state === 'fire') {
      facePlayer(e, p);
      e.vx = e.vy = 0;
      if (e.cd <= 0 && e.shots > 0) {
        const blocked = losBlocked(api, e.x, e.y, p.x, p.y, e);
        if (!blocked) {
          const n = norm(p.x - e.x, p.y - e.y);
          api.spawnEnemyBullet(e.x + n.x * 10, e.y + n.y * 10, n.x, n.y, bmul(api, e.def.bulletSpeed));
          api.sfx('rifle');
          e.shots--;
          const jit = api.diff && api.diff.fireJitter != null ? api.diff.fireJitter : null;
          const spread = jit == null ? 0.7 + api.rng() * 0.4 : 1 - jit * 0.5 + api.rng() * jit;
          e.cd = e.def.fireRate * fmul(api) * spread;
        } else {
          e.state = 'relocate';
          e.stateT = 1.2;
        }
      }
      if (e.shots <= 0) {
        e.state = 'relocate';
        e.stateT = 0.8 + api.rng();
      }
    } else if (e.state === 'relocate') {
      if (!e.rx) {
        e.rx = clamp(e.x + (api.rng() * 90 - 45), 18, WORLD_W - 18);
        e.ry = e.y + (api.rng() < 0.5 ? -28 : 18);
      }
      moveToward(e, e.rx, e.ry, e.def.speed, dt, api);
      if (dist2(e.x, e.y, e.rx, e.ry) < 80 || e.stateT <= 0) {
        e.rx = e.ry = 0;
        e.state = 'patrol';
        e.stateT = 1;
      }
    }
  },

  charger(e, api, dt) {
    const p = api.player;
    if (!p.alive) return;
    e.cd = (e.cd || 0) - dt;
    e.zig = (e.zig || 0) + dt * (4 + api.aggression);
    const n = norm(p.x - e.x, p.y - e.y);
    const px = -n.y;
    const py = n.x;
    const zig = Math.sin(e.zig) * 0.7;
    const spd = e.def.speed * (0.85 + api.aggression * 0.15);
    e.vx = (n.x + px * zig) * spd;
    e.vy = (n.y + py * zig) * spd;
    api.tryMove(e, e.vx * dt, e.vy * dt);
    e.facingX = n.x;
    e.facingY = n.y;
    e.walkT += dt * 1.6;
    const d2 = dist2(e.x, e.y, p.x, p.y);
    if (e.cd <= 0 && d2 < e.def.range * e.def.range && inView(e, api)) {
      e.burst = (e.burst || 0) + 1;
      api.spawnEnemyBullet(e.x + n.x * 10, e.y + n.y * 10, n.x, n.y, bmul(api, e.def.bulletSpeed));
      api.sfx('rifle');
      if (e.burst >= 2) {
        e.burst = 0;
        e.cd = 0.85 * fmul(api);
      } else e.cd = 0.12 * fmul(api);
    }
  },

  grenadier(e, api, dt) {
    const p = api.player;
    if (!p.alive) return;
    e.cd = (e.cd || 0) - dt;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    const ideal = 110;
    facePlayer(e, p);
    if (d < 80) {
      const n = norm(e.x - p.x, e.y - p.y);
      api.tryMove(e, n.x * e.def.speed * dt, n.y * e.def.speed * dt);
      e.walkT += dt;
    } else if (d > 140) {
      moveToward(e, p.x, p.y, e.def.speed * 0.7, dt, api);
    } else {
      e.vx = e.vy = 0;
    }
    if (e.cd <= 0 && inView(e, api) && d < e.def.range) {
      const n = norm(p.x - e.x, p.y - e.y);
      const lead = 18;
      api.spawnEnemyGrenade(e.x, e.y, p.x + p.vx * 0.15 + n.x * lead, p.y + p.vy * 0.15 + n.y * lead);
      api.sfx('throw');
      e.cd = e.def.fireRate * fmul(api) * (1 - api.aggression * 0.12);
    }
  },

  gunnest(e, api, dt) {
    const p = api.player;
    e.vx = e.vy = 0;
    e.facingX = 0;
    e.facingY = 1;
    if (!p.alive || !inView(e, api)) return;
    e.cd = (e.cd || 0) - dt;
    e.sweepT = (e.sweepT || 0) + dt;
    e.pauseT = e.pauseT == null ? 0 : e.pauseT - dt;
    const base = Math.atan2(1, 0);
    const sweep = Math.sin(e.sweepT * 1.3) * 0.55;
    const ang = base + sweep;
    const dx = Math.sin(ang);
    const dy = Math.cos(ang);
    e.facingX = dx;
    e.facingY = dy;
    if (e.pauseT > 0) return;
    if (e.cd <= 0) {
      e.burst = (e.burst || 0) + 1;
      const muzzleX = e.x + dx * 8;
      const muzzleY = e.y + dy * 22;
      api.spawnEnemyBullet(muzzleX, muzzleY, dx, dy, bmul(api, e.def.bulletSpeed), { fromNest: true, owner: e });
      api.sfx('mg');
      e.cd = e.def.fireRate * fmul(api);
      if (e.burst >= 8 + (api.aggression * 4) | 0) {
        e.burst = 0;
        e.pauseT = 0.85;
      }
    }
  },

  sniper(e, api, dt) {
    const p = api.player;
    if (!p.alive) return;
    e.cd = (e.cd || 0) - dt;
    e.vx = e.vy = 0;
    facePlayer(e, p);
    const d2 = dist2(e.x, e.y, p.x, p.y);
    if (!inView(e, api) || d2 > e.def.range * e.def.range) {
      e.laser = 0;
      e.state = 'idle';
      return;
    }
    if (!e.state || e.state === 'idle') {
      if (e.cd <= 0) {
        e.state = 'laser';
        e.laser = 0.8;
        api.sfx('blip');
      }
    } else if (e.state === 'laser') {
      e.laser -= dt;
      e.laserX = p.x;
      e.laserY = p.y;
      if (e.laser <= 0) {
        const n = norm(p.x - e.x, p.y - e.y);
        api.spawnEnemyBullet(e.x + n.x * 10, e.y + n.y * 10, n.x, n.y, bmul(api, e.def.bulletSpeed), { sniper: true });
        api.sfx('sniper');
        e.state = 'idle';
        e.cd = e.def.fireRate * fmul(api);
        e.laser = 0;
      }
    }
  },

  mortar(e, api, dt) {
    const p = api.player;
    e.vx = e.vy = 0;
    if (p && p.alive) facePlayer(e, p);
    e.cd = (e.cd || 0) - dt;
    if (e.state === 'warn') {
      e.warnT -= dt;
      if (e.warnT <= 0) {
        api.mortarBlast(e.warnX, e.warnY);
        e.state = 'idle';
        e.warnT = 0;
        e.cd = e.def.fireRate * fmul(api);
      }
      return;
    }
    if (!p || !p.alive || !inView(e, api)) return;
    if (e.cd <= 0) {
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d > e.def.range) return;
      e.state = 'warn';
      e.warnX = p.x;
      e.warnY = p.y;
      e.warnMax = (api.diff && api.diff.mortarWarn) || 1.05;
      e.warnT = e.warnMax;
      e.warnR = 40;
      api.sfx('blip');
    }
  },

  truck(e, api, dt) {
    if (!e.phase) {
      e.phase = 'in';
      e.stopY = e.y + 42;
      e.squadN = 3 + ((api.rng() * 2) | 0);
      e.dropped = 0;
      e.facingY = 1;
      e.facingX = 0;
    }
    const spd = e.def.speed;
    if (e.phase === 'in') {
      e.y += spd * dt;
      e.facingY = 1;
      if (e.y >= e.stopY) {
        e.phase = 'stop';
        e.stateT = 0.4;
      }
    } else if (e.phase === 'stop') {
      e.stateT -= dt;
      if (e.stateT <= 0) {
        e.phase = 'unload';
        e.stateT = 0.22;
      }
    } else if (e.phase === 'unload') {
      e.stateT -= dt;
      if (e.stateT <= 0 && e.dropped < e.squadN) {
        const kind = e.dropped % 3 === 2 ? 'charger' : 'rifleman';
        api.spawnSquad(kind, e.x + (e.dropped - 1.5) * 12, e.y + 16);
        e.dropped++;
        e.stateT = 0.28;
      }
      if (e.dropped >= e.squadN) {
        e.unloaded = true;
        e.phase = 'out';
      }
    } else if (e.phase === 'out') {
      e.y -= spd * dt;
      e.facingY = -1;
      if (e.y < api.camY - 50) e.alive = false;
    }
    e.x = clamp(e.x, 16, WORLD_W - 16);
  },

  jeep(e, api, dt) {
    const p = api.player;
    if (!e.phase) {
      e.phase = 'strafe';
      e.dir = e.x < (api.camX || 0) + (api.viewW || 360) * 0.5 ? 1 : -1;
      e.travel = 0;
    }
    e.x += e.dir * e.def.speed * dt;
    e.travel += e.def.speed * dt;
    e.facingX = e.dir;
    e.facingY = 0.15;
    e.cd = (e.cd || 0.3) - dt;
    if (p && p.alive && e.cd <= 0 && inView(e, api)) {
      const n = norm(p.x - e.x, p.y - e.y);
      e.facingX = n.x;
      e.facingY = n.y;
      api.spawnEnemyBullet(e.x + n.x * 12, e.y + n.y * 8, n.x, n.y, bmul(api, e.def.bulletSpeed), { fromNest: true });
      api.sfx('mg');
      e.cd = e.def.fireRate * fmul(api);
      e.facingX = e.dir;
    }
    if (e.travel > 80 && (e.x < (api.camX || 0) - 36 || e.x > (api.camX || 0) + (api.viewW || 360) + 36)) {
      e.alive = false;
    }
  },

  flamer(e, api, dt) {
    const p = api.player;
    if (!p || !p.alive) {
      e.flaming = false;
      return;
    }
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    moveToward(e, p.x, p.y, e.def.speed, dt, api);
    e.cd = (e.cd || 0) - dt;
    e.flaming = d < 62 && inView(e, api);
    if (e.flaming && e.cd <= 0) {
      api.flameCone(e);
      e.cd = e.def.fireRate * fmul(api);
    }
  },

  bunker(e, api, dt) {
    const p = api.player;
    e.vx = e.vy = 0;
    e.facingX = 0;
    e.facingY = 1;
    if (!p || !p.alive || !inView(e, api)) return;
    e.cd = (e.cd || 0) - dt;
    e.sweepT = (e.sweepT || 0) + dt;
    e.pauseT = e.pauseT == null ? 0.4 : e.pauseT - dt;
    const sweep = Math.sin(e.sweepT * 0.9) * 0.4;
    const dx = Math.sin(sweep);
    const dy = Math.cos(sweep);
    e.facingX = dx;
    e.facingY = dy;
    if (e.pauseT > 0) return;
    if (e.cd <= 0) {
      e.burst = (e.burst || 0) + 1;
      api.spawnEnemyBullet(e.x + dx * 8, e.y + 12, dx, dy, bmul(api, e.def.bulletSpeed), { fromNest: true, owner: e });
      api.sfx('mg');
      e.cd = e.def.fireRate * fmul(api);
      if (e.burst >= 10) {
        e.burst = 0;
        e.pauseT = 1.1 * fmul(api);
      }
    }
  },
};

export function updateEnemy(e, api, dt) {
  const fn = BEHAVIORS[e.def.behavior];
  // Fairness: a short reaction delay the first time an enemy comes into view.
  if (!e.seen && inView(e, api)) {
    e.seen = true;
    const mul = api.diff ? api.diff.reactMul : 1;
    const randSpan = api.diff && api.diff.reactRand != null ? api.diff.reactRand : REACT_RAND;
    if (e.type !== 'mortar') e.cd = Math.max(e.cd || 0, REACT_MIN * mul + api.rng() * randSpan * mul);
    else e.cd = Math.max(e.cd || 0, 2.4 * mul);
  }
  if (fn) fn(e, api, dt);
}

export function createEnemy(type, x, y, extra) {
  const def = ENEMY_TYPES[type];
  if (!def) return null;
  return {
    type,
    def,
    x,
    y,
    vx: 0,
    vy: 0,
    facingX: 0,
    facingY: type === 'truck' ? 1 : 1,
    hp: def.hp,
    alive: true,
    radius: def.radius,
    walkT: 0,
    state: 'patrol',
    stateT: 0,
    cd: type === 'mortar' ? 2.6 : 0.4 + Math.random() * 0.6,
    laser: 0,
    elevated: !!(extra && extra.elevated),
    phase: '',
    warnT: 0,
    flaming: false,
    unloaded: false,
  };
}
