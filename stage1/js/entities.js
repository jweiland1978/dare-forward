/** Player, enemies, bullets, grenades, pickups, cover, POWs. */
import {
  WORLD_W,
  PLAYER_SPEED,
  PLAYER_RADIUS,
  PLAYER_LIVES,
  START_GRENADES,
  GRENADE_RANGE,
  GRENADE_RADIUS,
  GRENADE_SELF_RADIUS,
  INVULN_TIME,
  THROW_CD,
  clamp,
  dist2,
  norm,
  facingName,
  circleRect,
} from './config.js?v=1';
import { WEAPONS, PICKUPS, getWeapon } from './weapons.js?v=1';
import { ENEMY_TYPES, createEnemy, updateEnemy } from './enemies.js?v=1';
import { SPRITES, unitSprite } from './sprites.js?v=1';
import {
  explode,
  muzzleFlash,
  hitSparks,
  deathPuff,
  casing,
  smokeTrail,
  floatingText,
} from './fx.js?v=1';
import { sfx } from './audio.js?v=1';

export const COVER_DEFS = {
  sandbag: { hp: 4, w: 22, h: 12, blocksBullet: true, blocksWalk: true, onlyExplosive: false, r: 10 },
  crate: { hp: 2, w: 14, h: 14, blocksBullet: true, blocksWalk: true, onlyExplosive: false, r: 8, dropChance: 0.55 },
  barrel: { hp: 1, w: 12, h: 16, blocksBullet: true, blocksWalk: true, explosive: true, r: 8 },
  wall: { hp: 3, w: 16, h: 14, blocksBullet: true, blocksWalk: true, onlyExplosive: true, r: 9 },
  palm: { hp: 999, w: 14, h: 18, blocksBullet: false, blocksWalk: true, indestructible: true, r: 7, spriteH: 28 },
  rock: { hp: 999, w: 14, h: 10, blocksBullet: true, blocksWalk: true, indestructible: true, r: 7 },
  tuft: { hp: 999, w: 10, h: 6, blocksBullet: false, blocksWalk: false, indestructible: true, r: 4, deco: true },
};

const CRATE_DROPS = ['spread', 'mg', 'rocket', 'grenades', 'medal', 'flame'];

export function createPlayer(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    facingX: 0,
    facingY: -1,
    aimX: 0,
    aimY: -1,
    alive: true,
    lives: PLAYER_LIVES,
    grenades: START_GRENADES,
    weapon: 'rifle',
    ammo: Infinity,
    invuln: 3.0,
    fireCd: 0,
    throwCd: 0,
    walkT: 0,
    radius: PLAYER_RADIUS,
    blink: 0,
  };
}

export function makeCover(type, x, y, extra) {
  const d = COVER_DEFS[type];
  if (!d) return null;
  return {
    type,
    x,
    y,
    w: d.w,
    h: d.h,
    hp: d.hp,
    maxHp: d.hp,
    alive: true,
    blocksBullet: d.blocksBullet,
    blocksWalk: d.blocksWalk,
    onlyExplosive: !!d.onlyExplosive,
    explosive: !!d.explosive,
    indestructible: !!d.indestructible,
    deco: !!d.deco,
    r: d.r,
    drop: extra && extra.drop,
    dropChance: d.dropChance || 0,
  };
}

function coverRect(c) {
  return { x: c.x - c.w / 2, y: c.y - c.h / 2, w: c.w, h: c.h };
}

export function pointInWater(world, x, y) {
  for (const w of world.water) {
    if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) {
      for (const b of world.bridges) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return false;
      }
      return true;
    }
  }
  return false;
}

function blockedAt(world, x, y, r, ignore) {
  if (x < r || x > WORLD_W - r) return true;
  if (y < 8) return true;
  if (pointInWater(world, x, y)) return true;
  for (const c of world.cover) {
    if (!c.alive || !c.blocksWalk || c === ignore) continue;
    const rr = coverRect(c);
    if (circleRect(x, y, r, rr.x, rr.y, rr.w, rr.h)) return true;
  }
  return false;
}

export function tryMove(world, e, dx, dy) {
  const r = e.radius || 7;
  let nx = e.x + dx;
  let ny = e.y + dy;
  if (!blockedAt(world, nx, e.y, r, e)) e.x = nx;
  else if (!blockedAt(world, e.x + dx * 0.5, e.y, r, e)) e.x += dx * 0.5;
  if (!blockedAt(world, e.x, ny, r, e)) e.y = ny;
  else if (!blockedAt(world, e.x, e.y + dy * 0.5, r, e)) e.y += dy * 0.5;
}

function losHit(world, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(4, Math.ceil(Math.hypot(dx, dy) / 6));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    for (const c of world.cover) {
      if (!c.alive || !c.blocksBullet) continue;
      const rr = coverRect(c);
      if (x >= rr.x && x <= rr.x + rr.w && y >= rr.y && y <= rr.y + rr.h) return c;
    }
  }
  return null;
}

export function coverBlocksLos(world, x0, y0, x1, y1) {
  return !!losHit(world, x0, y0, x1, y1);
}

export function spawnBullet(world, x, y, dx, dy, team, wpn, extra) {
  const n = norm(dx, dy);
  const b = {
    x,
    y,
    vx: n.x * (wpn.speed || 280),
    vy: n.y * (wpn.speed || 280),
    team,
    damage: wpn.damage || 1,
    r: wpn.radius || 2,
    kind: wpn.kind || 'bullet',
    life: wpn.life || 0.8,
    splash: wpn.splash || 0,
    tracer: wpn.tracer || '#ffe9a0',
    fromNest: extra && extra.fromNest,
    sniper: extra && extra.sniper,
    owner: extra && extra.owner,
  };
  world.bullets.push(b);
  return b;
}

export function spawnGrenade(world, x, y, tx, ty, team) {
  const n = norm(tx - x, ty - y);
  const dist = Math.min(GRENADE_RANGE, Math.hypot(tx - x, ty - y) || GRENADE_RANGE);
  const tmax = 0.62;
  const g = {
    x,
    y,
    z: 0,
    tx: x + n.x * dist,
    ty: y + n.y * dist,
    ox: x,
    oy: y,
    t: 0,
    tmax,
    team,
    r: 3,
  };
  world.grenades.push(g);
  sfx('throw');
  return g;
}

function spawnPickup(world, type, x, y) {
  const def = PICKUPS[type];
  if (!def) return;
  world.pickups.push({
    type,
    def,
    x,
    y,
    t: 0,
    alive: true,
  });
}

function applyPickup(world, p, player, onScore) {
  const d = p.def;
  if (d.kind === 'weapon') {
    player.weapon = d.weapon;
    player.ammo = WEAPONS[d.weapon].ammo;
    floatingText(p.x, p.y - 10, d.label, '#ffe080');
  } else if (d.kind === 'grenades') {
    player.grenades += d.amount;
    floatingText(p.x, p.y - 10, d.label, '#80ff80');
  } else if (d.kind === 'score') {
    onScore(d.amount);
    floatingText(p.x, p.y - 10, d.label, '#ffe080');
  } else if (d.kind === 'life') {
    player.lives += 1;
    floatingText(p.x, p.y - 10, d.label, '#ff8080');
  }
  sfx('pickup');
  p.alive = false;
}

// Player hitbox vs enemy bullets is smaller than the sprite (arcade fairness).
const PLAYER_HIT_R = 4;

export function blast(world, x, y, radius, opts, hooks) {
  const size = (opts && opts.size) || radius / 32;
  explode(x, y, Math.max(0.7, size), opts);
  sfx(opts && opts.sfx ? opts.sfx : 'boom');
  const r2 = radius * radius;
  const team = opts && opts.team;
  const selfR2 = GRENADE_SELF_RADIUS * GRENADE_SELF_RADIUS;

  for (const e of world.enemies) {
    if (!e.alive) continue;
    if (dist2(e.x, e.y, x, y) <= r2) hooks.hurtEnemy(e, 99, x, y);
  }
  for (const c of world.cover) {
    if (!c.alive || c.indestructible || c.deco) continue;
    if (dist2(c.x, c.y, x, y) <= r2) hooks.hurtCover(c, 99, true);
  }
  for (const p of world.pows) {
    if (!p.alive || p.rescued) continue;
    if (dist2(p.x, p.y, x, y) <= r2 * 0.5) hooks.hurtPow(p);
  }
  const pl = world.player;
  if (pl.alive && !(pl.invuln > 0) && !hooks.invincible()) {
    const d2 = dist2(pl.x, pl.y, x, y);
    const useSelf = team === 'player';
    if (d2 <= (useSelf ? selfR2 : r2)) hooks.hurtPlayer();
  }
  // chain barrels
  for (const c of world.cover) {
    if (!c.alive || !c.explosive) continue;
    if (dist2(c.x, c.y, x, y) <= (radius + 12) * (radius + 12)) {
      hooks.hurtCover(c, 99, true);
    }
  }
}

function fireFrom(world, x, y, dx, dy, wpn, team) {
  const n = norm(dx, dy);
  const pellets = wpn.pellets || 1;
  const spread = wpn.spread || 0;
  for (let i = 0; i < pellets; i++) {
    let ang = Math.atan2(n.y, n.x);
    if (pellets === 1) ang += (Math.random() - 0.5) * spread;
    else ang += (i - (pellets - 1) / 2) * (spread / Math.max(1, pellets - 1));
    spawnBullet(world, x + n.x * 8, y + n.y * 8, Math.cos(ang), Math.sin(ang), team, wpn);
  }
  muzzleFlash(x + n.x * 10, y + n.y * 10, n.x, n.y);
  casing(x, y, n.x);
  sfx(wpn.sfx || 'rifle');
}

export function createWorld() {
  return {
    player: null,
    enemies: [],
    bullets: [],
    grenades: [],
    cover: [],
    pickups: [],
    pows: [],
    water: [],
    bridges: [],
    props: [],
  };
}

export function loadLayout(world, layout, hooks) {
  world.enemies.length = 0;
  world.bullets.length = 0;
  world.grenades.length = 0;
  world.cover.length = 0;
  world.pickups.length = 0;
  world.pows.length = 0;
  world.water = layout.water.slice();
  world.bridges = layout.bridges.slice();
  world.props = layout.props.slice();
  for (const c of layout.cover) {
    const cov = makeCover(c.type, c.x, c.y, c);
    if (cov) world.cover.push(cov);
  }
  for (const p of layout.props) {
    if (p.type === 'palm' || p.type === 'rock' || p.type === 'tuft') {
      const cov = makeCover(p.type, p.x, p.y);
      if (cov) world.cover.push(cov);
    }
  }
  world._pendingEnemies = layout.enemies.map((e) => ({ ...e, spawned: false }));
  world._pendingPows = layout.pows.map((p) => ({ ...p, spawned: false }));
  world._pendingPickups = (layout.pickups || []).map((p) => ({ ...p, spawned: false }));
  world.layout = layout;
  world.powTotal = layout.pows.length;
  world.powRescued = 0;
}

export function spawnPending(world, camY, viewH) {
  const y0 = camY - 30;
  const y1 = camY + viewH + 70;
  for (const e of world._pendingEnemies) {
    if (e.spawned) continue;
    if (e.y >= y0 && e.y <= y1) {
      const en = createEnemy(e.type, e.x, e.y);
      if (en) world.enemies.push(en);
      e.spawned = true;
    }
  }
  for (const p of world._pendingPows) {
    if (p.spawned) continue;
    if (p.y >= y0 && p.y <= y1) {
      world.pows.push({
        x: p.x,
        y: p.y,
        alive: true,
        rescued: false,
        walkT: 0,
        facingX: 0,
        facingY: 1,
        radius: 7,
      });
      p.spawned = true;
    }
  }
  for (const p of world._pendingPickups) {
    if (p.spawned) continue;
    if (p.y >= y0 && p.y <= y1) {
      spawnPickup(world, p.type, p.x, p.y);
      p.spawned = true;
    }
  }
}

function autoAim(world, player, facing, coneDeg) {
  const cone = (coneDeg * Math.PI) / 180;
  let best = null;
  let bestD = 160 * 160;
  for (const e of world.enemies) {
    if (!e.alive) continue;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > bestD) continue;
    const n = norm(dx, dy);
    const dot = n.x * facing.x + n.y * facing.y;
    if (dot > Math.cos(cone)) {
      best = e;
      bestD = d2;
    }
  }
  if (!best) return facing;
  return norm(best.x - player.x, best.y - player.y);
}

export function updatePlayer(world, dt, input, cam, hooks) {
  const p = world.player;
  if (!p.alive) return;
  p.invuln = Math.max(0, p.invuln - dt);
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.throwCd = Math.max(0, p.throwCd - dt);
  p.blink += dt;

  const spd = PLAYER_SPEED;
  p.vx = input.ax * spd;
  p.vy = input.ay * spd;
  if (input.ax || input.ay) {
    const f = norm(input.ax, input.ay);
    p.facingX = f.x;
    p.facingY = f.y;
    p.walkT += dt;
  }
  tryMove(world, p, p.vx * dt, p.vy * dt);
  p.x = clamp(p.x, 10, WORLD_W - 10);
  p.y = clamp(p.y, cam.camY + 12, cam.camY + cam.viewH - 12);
  p.y = Math.min(p.y, world.layout.length - 8);

  let aim = { x: p.facingX, y: p.facingY };
  if (input.mouseAim) {
    aim = norm(input.mouseX - p.x, input.mouseY - p.y);
    p.facingX = aim.x;
    p.facingY = aim.y;
  } else if (input.touchActive && input.fire) {
    aim = autoAim(world, p, aim, 25);
  }
  p.aimX = aim.x;
  p.aimY = aim.y;

  if (input.fire && p.fireCd <= 0) {
    const w = getWeapon(p.weapon);
    fireFrom(world, p.x, p.y, aim.x, aim.y, w, 'player');
    hooks.shotFired();
    p.fireCd = w.fireRate;
    if (!w.unlimited) {
      p.ammo -= w.pellets || 1;
      if (p.ammo <= 0) {
        p.weapon = 'rifle';
        p.ammo = Infinity;
      }
    }
  }
  if (input.consumeGrenade() && p.grenades > 0 && p.throwCd <= 0) {
    const tx = p.x + aim.x * GRENADE_RANGE;
    const ty = p.y + aim.y * GRENADE_RANGE;
    spawnGrenade(world, p.x, p.y, tx, ty, 'player');
    p.grenades--;
    p.throwCd = THROW_CD;
  }

  for (const pk of world.pickups) {
    if (!pk.alive) continue;
    if (dist2(pk.x, pk.y, p.x, p.y) < 16 * 16) {
      applyPickup(world, pk, p, hooks.addScore);
    }
  }
  for (const pow of world.pows) {
    if (!pow.alive || pow.rescued) continue;
    if (dist2(pow.x, pow.y, p.x, p.y) < 16 * 16) {
      pow.rescued = true;
      pow.alive = false;
      world.powRescued++;
      hooks.addScore(500);
      floatingText(pow.x, pow.y - 8, 'RESCUED!', '#80c0ff');
      sfx('rescue');
    }
  }
}

export function updateGrenades(world, dt, hooks) {
  for (let i = world.grenades.length - 1; i >= 0; i--) {
    const g = world.grenades[i];
    g.t += dt;
    const u = clamp(g.t / g.tmax, 0, 1);
    g.x = g.ox + (g.tx - g.ox) * u;
    g.y = g.oy + (g.ty - g.oy) * u;
    g.z = Math.sin(u * Math.PI) * 28;
    if (g.t >= g.tmax) {
      blast(world, g.tx, g.ty, GRENADE_RADIUS, { size: 1.15, team: g.team, sfx: 'boom' }, hooks);
      world.grenades.splice(i, 1);
    }
  }
}

function rocketExplode(world, b, hooks) {
  blast(world, b.x, b.y, b.splash || 42, { size: 1.2, team: b.team, sfx: 'boom' }, hooks);
}

export function updateBullets(world, dt, hooks) {
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    const b = world.bullets[i];
    b.life -= dt;
    const px = b.x;
    const py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.kind === 'rocket') smokeTrail(b.x, b.y);
    if (b.kind === 'flame') {
      b.r += 10 * dt;
    }
    if (b.life <= 0 || b.x < -10 || b.x > WORLD_W + 10) {
      if (b.kind === 'rocket') rocketExplode(world, b, hooks);
      world.bullets.splice(i, 1);
      continue;
    }

    let hit = false;
    for (const c of world.cover) {
      if (!c.alive || !c.blocksBullet) continue;
      if (b.fromNest && c.type === 'sandbag' && Math.abs(c.x - (b.owner && b.owner.x || c.x)) < 40) continue;
      const rr = coverRect(c);
      if (circleRect(b.x, b.y, b.r, rr.x, rr.y, rr.w, rr.h)) {
        const explosive = b.kind === 'rocket' || b.kind === 'flame';
        if (c.onlyExplosive && !explosive && b.kind !== 'rocket') {
          hitSparks(b.x, b.y);
          hit = true;
          break;
        }
        if (b.kind === 'rocket') {
          rocketExplode(world, b, hooks);
        } else {
          hooks.hurtCover(c, b.damage, explosive);
          hitSparks(b.x, b.y);
        }
        hit = true;
        break;
      }
    }
    if (hit) {
      world.bullets.splice(i, 1);
      continue;
    }

    if (b.team === 'player') {
      for (const e of world.enemies) {
        if (!e.alive) continue;
        const rad = e.radius + b.r + 2;
        const hitNow = dist2(b.x, b.y, e.x, e.y) <= rad * rad;
        const hitSweep = dist2((px + b.x) * 0.5, (py + b.y) * 0.5, e.x, e.y) <= rad * rad;
        if (hitNow || hitSweep) {
          if (b.kind === 'rocket') rocketExplode(world, b, hooks);
          else {
            hooks.hurtEnemy(e, b.damage, b.x, b.y);
            hooks.shotHit();
            hitSparks(b.x, b.y);
          }
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (const pow of world.pows) {
          if (!pow.alive || pow.rescued) continue;
          if (dist2(b.x, b.y, pow.x, pow.y) <= (pow.radius + b.r) * (pow.radius + b.r)) {
            hooks.hurtPow(pow);
            hit = true;
            break;
          }
        }
      }
    } else {
      const p = world.player;
      if (p.alive && dist2(b.x, b.y, p.x, p.y) <= (PLAYER_HIT_R + b.r) * (PLAYER_HIT_R + b.r)) {
        hooks.hurtPlayer();
        hitSparks(b.x, b.y);
        hit = true;
      }
    }
    if (hit) world.bullets.splice(i, 1);
  }
}

export function updateEnemies(world, dt, api) {
  for (const e of world.enemies) {
    if (!e.alive) continue;
    updateEnemy(e, api, dt);
  }
}

export function updatePickups(world, dt) {
  for (const p of world.pickups) {
    if (!p.alive) continue;
    p.t += dt;
  }
}

export function updatePows(world, dt) {
  for (const p of world.pows) {
    if (!p.alive) continue;
    p.walkT += dt * 0.5;
  }
}

export function makeEnemyApi(world, hooks) {
  return {
    player: world.player,
    cover: world.cover,
    rng: hooks.rng,
    aggression: hooks.aggression(),
    camY: 0,
    viewH: 200,
    tryMove(e, dx, dy) {
      tryMove(world, e, dx, dy);
    },
    spawnEnemyBullet(x, y, dx, dy, speed, extra) {
      // Small aim error for foot soldiers so bullets are dodgeable (nests and snipers stay exact).
      if (!(extra && (extra.sniper || extra.fromNest))) {
        const a = (Math.random() - 0.5) * 0.16;
        const c = Math.cos(a), s2 = Math.sin(a);
        const ndx = dx * c - dy * s2;
        dy = dx * s2 + dy * c;
        dx = ndx;
      }
      spawnBullet(
        world,
        x,
        y,
        dx,
        dy,
        'enemy',
        { speed, damage: 1, radius: extra && extra.sniper ? 2.2 : 2.4, life: extra && extra.sniper ? 0.9 : 1.1, kind: 'bullet', tracer: extra && extra.sniper ? '#ff6060' : '#f0d080' },
        extra,
      );
    },
    spawnEnemyGrenade(x, y, tx, ty) {
      spawnGrenade(world, x, y, tx, ty, 'enemy');
    },
    coverBlocksLos(x0, y0, x1, y1) {
      return coverBlocksLos(world, x0, y0, x1, y1);
    },
    sfx,
  };
}

export function killEnemy(world, e, hooks) {
  if (!e.alive) return;
  e.alive = false;
  deathPuff(e.x, e.y, '#6a7864');
  hooks.addScore(e.def.score);
  hooks.addKill();
  floatingText(e.x, e.y - 8, '+' + e.def.score, '#ffe080');
  if (Math.random() < 0.18) {
    const ids = CRATE_DROPS;
    spawnPickup(world, ids[(Math.random() * ids.length) | 0], e.x, e.y);
  }
}

export function destroyCover(world, c, hooks) {
  if (!c.alive) return;
  c.alive = false;
  if (c.explosive) {
    c.alive = false;
    explode(c.x, c.y, 1.35, { debris: '#c43c28' });
    sfx('barrel');
    hooks.barrelBoom(c);
    return;
  }
  deathPuff(c.x, c.y, c.type === 'crate' ? '#8a6238' : '#b08a4a');
  if (c.type === 'crate') {
    const drop = c.drop || (Math.random() < (c.dropChance || 0) ? CRATE_DROPS[(Math.random() * CRATE_DROPS.length) | 0] : null);
    if (drop) spawnPickup(world, drop, c.x, c.y);
  }
}

export function drawShadow(g, x, y, r) {
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath();
  g.ellipse(x, y + 8, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
  g.fill();
}

export function drawWorldGround(g, world, camY, viewH, palIndex) {
  const tiles = SPRITES.ground[palIndex] || SPRITES.ground[0];
  const tw = 32;
  const y0 = Math.floor(camY / tw) * tw;
  for (let y = y0; y < camY + viewH + tw; y += tw) {
    for (let x = 0; x < WORLD_W; x += tw) {
      const v = ((x / tw + y / tw) | 0) % tiles.length;
      g.drawImage(tiles[v], x, y - camY);
    }
  }
  for (const w of world.water) {
    const sy = w.y - camY;
    if (sy + w.h < -4 || sy > viewH + 4) continue;
    for (let yy = 0; yy < w.h; yy += 24) {
      for (let xx = 0; xx < w.w; xx += 24) {
        g.drawImage(SPRITES.water, w.x + xx, sy + yy);
      }
    }
    g.fillStyle = 'rgba(20,80,90,0.18)';
    g.fillRect(w.x, sy, w.w, w.h);
  }
  for (const b of world.bridges) {
    const sy = b.y - camY;
    if (sy + b.h < -4 || sy > viewH + 4) continue;
    for (let yy = 0; yy < b.h; yy += 12) {
      for (let xx = 0; xx < b.w; xx += 16) {
        g.drawImage(SPRITES.cover.bridge, b.x + xx, sy + yy);
      }
    }
  }
}

export function drawCover(g, world, camY, viewH) {
  const list = world.cover;
  for (const c of list) {
    if (!c.alive) continue;
    const sy = c.y - camY;
    if (sy < -30 || sy > viewH + 30) continue;
    const spr = SPRITES.cover[c.type];
    if (spr) {
      g.drawImage(spr, (c.x - spr.width / 2) | 0, (sy - spr.height + c.h / 2) | 0);
    } else {
      g.fillStyle = '#888';
      g.fillRect(c.x - c.w / 2, sy - c.h / 2, c.w, c.h);
    }
  }
}

export function drawEntities(g, world, camY, viewH, t) {
  const p = world.player;
  for (const pow of world.pows) {
    if (!pow.alive) continue;
    const sy = pow.y - camY;
    if (sy < -20 || sy > viewH + 20) continue;
    drawShadow(g, pow.x, sy, 6);
    const spr = unitSprite('pow', pow.facingX, pow.facingY, pow.walkT);
    g.drawImage(spr, (pow.x - spr.width / 2) | 0, (sy - spr.height + 6) | 0);
  }
  for (const e of world.enemies) {
    if (!e.alive) continue;
    const sy = e.y - camY;
    if (sy < -24 || sy > viewH + 24) continue;
    if (e.type === 'sniper' && e.laser > 0 && world.player.alive) {
      g.strokeStyle = 'rgba(255,40,40,0.75)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(e.x, sy);
      g.lineTo(e.laserX || world.player.x, (e.laserY || world.player.y) - camY);
      g.stroke();
    }
    drawShadow(g, e.x, sy, 6);
    if (e.type === 'gunnest') {
      g.drawImage(SPRITES.cover.gunnest, (e.x - 13) | 0, (sy - 16) | 0);
    } else {
      const spr = unitSprite('enemy', e.facingX, e.facingY, e.walkT);
      g.drawImage(spr, (e.x - spr.width / 2) | 0, (sy - spr.height + 6) | 0);
    }
  }
  if (p && p.alive) {
    const sy = p.y - camY;
    const hide = p.invuln > 0 && ((p.blink * 12) | 0) % 2 === 0;
    if (!hide) {
      drawShadow(g, p.x, sy, 6);
      const spr = unitSprite('player', p.facingX, p.facingY, p.walkT);
      g.drawImage(spr, (p.x - spr.width / 2) | 0, (sy - spr.height + 6) | 0);
    }
  }
  for (const pk of world.pickups) {
    if (!pk.alive) continue;
    const sy = pk.y - camY + Math.sin(pk.t * 4) * 2;
    const spr = SPRITES.pickups[pk.type];
    g.save();
    g.globalAlpha = 0.35 + 0.25 * Math.sin(pk.t * 6);
    g.fillStyle = '#ffe080';
    g.beginPath();
    g.arc(pk.x, sy + 2, 8, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    if (spr) g.drawImage(spr, (pk.x - 6) | 0, (sy - 10) | 0);
    g.restore();
  }
  for (const gr of world.grenades) {
    const sy = gr.y - camY - gr.z;
    g.fillStyle = 'rgba(255,60,40,0.35)';
    g.beginPath();
    g.ellipse(gr.tx, gr.ty - camY, 8, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,80,40,0.8)';
    g.stroke();
    g.drawImage(SPRITES.grenade, (gr.x - 3) | 0, (sy - 6) | 0);
  }
  for (const b of world.bullets) {
    const sy = b.y - camY;
    if (b.kind === 'rocket') {
      g.save();
      g.translate(b.x, sy);
      g.rotate(Math.atan2(b.vy, b.vx));
      g.drawImage(SPRITES.rocket, -4, -2);
      g.restore();
    } else if (b.kind === 'flame') {
      g.fillStyle = 'rgba(255,140,30,0.7)';
      g.beginPath();
      g.arc(b.x, sy, b.r, 0, Math.PI * 2);
      g.fill();
    } else {
      g.strokeStyle = b.tracer;
      g.lineWidth = b.sniper ? 2 : 1.5;
      g.beginPath();
      const l = Math.hypot(b.vx, b.vy) || 1;
      g.moveTo(b.x, sy);
      g.lineTo(b.x - (b.vx / l) * 7, sy - (b.vy / l) * 7);
      g.stroke();
    }
  }
}

export { WEAPONS, ENEMY_TYPES, spawnPickup, fireFrom, facingName };
