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
  burstDebris,
  addFire,
  spawnParticle,
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
  building: { hp: 999, w: 80, h: 56, blocksBullet: true, blocksWalk: true, indestructible: true, r: 20 },
  bunker: { hp: 12, w: 36, h: 28, blocksBullet: true, blocksWalk: true, onlyExplosive: true, r: 16 },
  tanktrap: { hp: 999, w: 18, h: 16, blocksBullet: false, blocksWalk: true, indestructible: true, r: 9 },
  wire: { hp: 999, w: 36, h: 16, blocksBullet: false, blocksWalk: false, indestructible: true, r: 8, slow: 0.48, deco: true },
};

export const DEBRIS_COLOR = {
  sandbag: '#c4a060',
  crate: '#a87840',
  barrel: '#d24a30',
  wall: '#8a8478',
  building: '#7a756c',
  bunker: '#6a6a64',
  truck: '#5a6844',
  jeep: '#4a5a38',
  flamer: '#c45a20',
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
  const c = {
    type,
    x,
    y,
    w: (extra && extra.w) || d.w,
    h: (extra && extra.h) || d.h,
    hp: d.hp,
    maxHp: d.hp,
    alive: true,
    blocksBullet: d.blocksBullet,
    blocksWalk: d.blocksWalk,
    onlyExplosive: !!d.onlyExplosive,
    explosive: !!d.explosive,
    indestructible: !!d.indestructible || !!(extra && extra.indestructible),
    deco: !!d.deco,
    r: d.r,
    drop: extra && extra.drop,
    dropChance: d.dropChance || 0,
    slow: (extra && extra.slow) || d.slow || 0,
    holdGate: !!(extra && extra.holdGate),
  };
  return c;
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

export function groundMul(world, x, y) {
  let m = 1;
  for (const z of world.mud || []) {
    if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) m = Math.min(m, z.mul || 0.55);
  }
  for (const c of world.cover) {
    if (!c.alive || !c.slow) continue;
    const rr = coverRect(c);
    if (x >= rr.x && x <= rr.x + rr.w && y >= rr.y && y <= rr.y + rr.h) m = Math.min(m, c.slow);
  }
  return m;
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
  const tmax = (world.diff && world.diff.grenadeWarn) || 0.72;
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
    if (!p.alive || p.extracted) continue;
    // Followers (right behind you) only get caught by your own blasts at point-blank range.
    const powR2 = p.following && team === 'player' ? selfR2 * 0.5 : r2 * 0.55;
    if (dist2(p.x, p.y, x, y) <= powR2) hooks.hurtPow(p);
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
    mud: [],
    extractions: [],
    powExtracted: 0,
    mortarBooms: 0,
  };
}

export function loadLayout(world, layout, hooks) {
  world.enemies.length = 0;
  world.bullets.length = 0;
  world.grenades.length = 0;
  world.cover.length = 0;
  world.pickups.length = 0;
  world.pows.length = 0;
  world.water = (layout.water || []).slice();
  world.bridges = (layout.bridges || []).slice();
  world.props = (layout.props || []).slice();
  world.mud = (layout.mud || []).slice();
  world.extractions = (layout.extractions || []).map((z) => ({ x: z.x, y: z.y, r: z.r || 32 }));
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
  world._pendingEnemies = (layout.enemies || []).map((e) => ({ ...e, spawned: false }));
  world._pendingPows = (layout.pows || []).map((p) => ({ ...p, spawned: false }));
  world._pendingPickups = (layout.pickups || []).map((p) => ({ ...p, spawned: false }));
  world.layout = layout;
  world.powTotal = (layout.pows || []).length;
  world.powRescued = 0;
  world.powExtracted = 0;
  world.mortarBooms = 0;
}

export function spawnPending(world, camY, viewH) {
  const y0 = camY - 30;
  const y1 = camY + viewH + 70;
  for (const e of world._pendingEnemies) {
    if (e.spawned) continue;
    if (e.y >= y0 && e.y <= y1) {
      const en = createEnemy(e.type, e.x, e.y, e);
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
        following: false,
        extracted: false,
        waiting: false,
        walkT: 0,
        facingX: 0,
        facingY: 1,
        radius: 7,
        hurtCd: 0,
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

function autoAim(world, player, facing, coneDeg, cam) {
  const cone = (coneDeg * Math.PI) / 180;
  let best = null;
  let bestD = 160 * 160;
  for (const e of world.enemies) {
    if (!e.alive) continue;
    if (cam && (e.x < cam.camX - 8 || e.x > cam.camX + cam.viewW + 8 || e.y < cam.camY - 8 || e.y > cam.camY + cam.viewH + 8)) continue;
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

  const spd = PLAYER_SPEED * groundMul(world, p.x, p.y);
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
  if (world.holdClamp != null && p.y < world.holdClamp) p.y = world.holdClamp;

  let aim = { x: p.facingX, y: p.facingY };
  if (input.mouseAim) {
    aim = norm(input.mouseX - p.x, input.mouseY - p.y);
    p.facingX = aim.x;
    p.facingY = aim.y;
  } else if (input.touchActive && input.fire) {
    aim = autoAim(world, p, aim, 25, cam);
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
    if (!pow.alive || pow.rescued || pow.following) continue;
    if (dist2(pow.x, pow.y, p.x, p.y) < 18 * 18) {
      pow.rescued = true;
      pow.following = true;
      pow.waiting = false;
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

function bulletHitsEnemy(b, e, px, py) {
  if (e.type === 'flamer' && e.facingX != null) {
    const tx = e.x - e.facingX * 9;
    const ty = e.y - e.facingY * 9;
    const fromBack = b.vx * e.facingX + b.vy * e.facingY < 0;
    if (fromBack && dist2(b.x, b.y, tx, ty) <= 49) return true;
  }
  const rad = e.radius + b.r + (e.type === 'truck' || e.type === 'jeep' ? 4 : 2);
  if (dist2(b.x, b.y, e.x, e.y) <= rad * rad) return true;
  if (dist2((px + b.x) * 0.5, (py + b.y) * 0.5, e.x, e.y) <= rad * rad) return true;
  return false;
}

function strikeEnemy(world, e, b, hooks) {
  if (e.type === 'flamer') {
    const tx = e.x - (e.facingX || 0) * 9;
    const ty = e.y - (e.facingY || 0) * 9;
    const fromBack = b.vx * (e.facingX || 0) + b.vy * (e.facingY || 0) < 0;
    if (fromBack && dist2(b.x, b.y, tx, ty) <= 49) {
      e.tankHit = true;
      e.hp = 0;
    }
  }
  if (b.kind === 'rocket') rocketExplode(world, b, hooks);
  else {
    hooks.hurtEnemy(e, e.tankHit ? 99 : b.damage, b.x, b.y);
    hooks.shotHit();
    hitSparks(b.x, b.y);
  }
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
    if (b.team === 'player') {
      for (const e of world.enemies) {
        if (!e.alive || !e.elevated) continue;
        if (bulletHitsEnemy(b, e, px, py)) {
          strikeEnemy(world, e, b, hooks);
          hit = true;
          break;
        }
      }
    }
    if (!hit) {
      for (const c of world.cover) {
        if (!c.alive || !c.blocksBullet) continue;
        if (b.fromNest && c.type === 'sandbag' && Math.abs(c.x - (b.owner && b.owner.x || c.x)) < 40) continue;
        if (c.type === 'bunker' && b.vy > 18 && b.kind !== 'rocket') continue;
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
    }
    if (hit) {
      world.bullets.splice(i, 1);
      continue;
    }

    if (b.team === 'player') {
      for (const e of world.enemies) {
        if (!e.alive || e.elevated) continue;
        if (bulletHitsEnemy(b, e, px, py)) {
          strikeEnemy(world, e, b, hooks);
          hit = true;
          break;
        }
      }
    } else {
      for (const pow of world.pows) {
        if (!pow.alive || pow.hurtCd > 0) continue;
        if (dist2(b.x, b.y, pow.x, pow.y) <= (pow.radius + b.r) * (pow.radius + b.r)) {
          pow.hurtCd = 0.45;
          // Followers can soak a few stray enemy bullets (they trail right behind the player).
          pow.bulletHp = (pow.bulletHp == null ? 3 : pow.bulletHp) - 1;
          if (pow.bulletHp <= 0) hooks.hurtPow(pow);
          else hitSparks(b.x, b.y);
          hit = true;
          break;
        }
      }
      const p = world.player;
      if (!hit && p.alive && dist2(b.x, b.y, p.x, p.y) <= (PLAYER_HIT_R + b.r) * (PLAYER_HIT_R + b.r)) {
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
  const player = world.player;
  const followers = [];
  for (const p of world.pows) {
    if (p.hurtCd > 0) p.hurtCd -= dt;
    if (!p.alive) continue;
    if (p.following && !p.extracted) followers.push(p);
    else p.walkT += dt * 0.4;
  }
  let ax = player ? player.x : 0;
  let ay = player ? player.y : 0;
  const face = player ? norm(player.facingX || 0, player.facingY || -1) : { x: 0, y: 1 };
  for (let i = 0; i < followers.length; i++) {
    const pw = followers[i];
    if (!player || !player.alive || pw.waiting) {
      pw.waiting = true;
      if (player && player.alive && dist2(pw.x, pw.y, player.x, player.y) < 52 * 52) pw.waiting = false;
      else continue;
    }
    const tx = ax - face.x * 16;
    const ty = ay - face.y * 16;
    const d = Math.hypot(tx - pw.x, ty - pw.y);
    if (d > 8) {
      const sp = Math.min(118, 76 + d * 1.4) * groundMul(world, pw.x, pw.y);
      const n = norm(tx - pw.x, ty - pw.y);
      pw.facingX = n.x;
      pw.facingY = n.y;
      tryMove(world, pw, n.x * sp * dt, n.y * sp * dt);
      pw.walkT += dt * 1.3;
    }
    ax = pw.x;
    ay = pw.y;
  }
}

export function tryExtract(world, hooks, forceAll) {
  const zones = world.extractions || [];
  const ready = [];
  for (const pow of world.pows) {
    if (!pow.alive || !pow.following || pow.extracted) continue;
    if (forceAll) {
      ready.push(pow);
      continue;
    }
    for (const z of zones) {
      if (dist2(pow.x, pow.y, z.x, z.y) <= (z.r || 32) * (z.r || 32)) {
        ready.push(pow);
        break;
      }
    }
  }
  if (!ready.length) return 0;
  for (const pow of ready) {
    pow.extracted = true;
    pow.following = false;
    pow.alive = false;
    world.powExtracted++;
  }
  const bonus = ready.length * 500;
  hooks.addScore(bonus);
  const at = ready[0];
  floatingText(at.x, at.y - 12, 'EXTRACTED x' + ready.length + ' +' + bonus, '#80d0ff');
  sfx('extract');
  return ready.length;
}

export function extractNearPlayer(world, hooks, radius) {
  const p = world.player;
  if (!p) return 0;
  const ready = [];
  for (const pow of world.pows) {
    if (!pow.alive || !pow.following || pow.extracted) continue;
    if (dist2(pow.x, pow.y, p.x, p.y) <= radius * radius) ready.push(pow);
  }
  if (!ready.length) return 0;
  for (const pow of ready) {
    pow.extracted = true;
    pow.following = false;
    pow.alive = false;
    world.powExtracted++;
  }
  const bonus = ready.length * 500;
  hooks.addScore(bonus);
  floatingText(p.x, p.y - 16, 'EXTRACTED x' + ready.length + ' +' + bonus, '#80d0ff');
  sfx('extract');
  return ready.length;
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
      const precise = extra && (extra.sniper || extra.fromNest);
      if (!precise) {
        const spread = (world.diff && world.diff.aimError) || 0.16;
        const a = (Math.random() - 0.5) * spread;
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
    mortarBlast(x, y) {
      world.mortarBooms = (world.mortarBooms || 0) + 1;
      blast(world, x, y, 40, { size: 1.35, sfx: 'boom', debris: '#6a5a48', team: 'enemy' }, hooks);
    },
    spawnSquad(type, x, y) {
      const en = createEnemy(type, x, y);
      if (!en) return null;
      en.cd = Math.max(en.cd || 0, 0.7);
      world.enemies.push(en);
      return en;
    },
    flameCone(e) {
      const p = world.player;
      if (!p) return;
      const n = norm(p.x - e.x || 0.01, p.y - e.y || 0.2);
      for (let i = 0; i < 4; i++) {
        const dist = 12 + i * 12;
        const ang = Math.atan2(n.y, n.x) + (Math.random() - 0.5) * 0.45;
        spawnParticle({
          kind: 'fire',
          x: e.x + Math.cos(ang) * dist,
          y: e.y + Math.sin(ang) * dist,
          vx: Math.cos(ang) * 24,
          vy: Math.sin(ang) * 24,
          life: 0.2,
          max: 0.2,
          color: i % 2 ? '#ffb040' : '#ff5410',
          r: 4 + Math.random() * 2.5,
          add: true,
        });
      }
      if (Math.random() < 0.3) addFire(e.x + n.x * 28, e.y + n.y * 28, 1.4, 10);
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < 60 && p.alive) hooks.hurtPlayer();
    },
  };
}

export function killEnemy(world, e, hooks) {
  if (!e.alive) return;
  e.alive = false;
  const vehicle = e.type === 'truck' || e.type === 'jeep';
  if (vehicle || e.tankHit) {
    const col = DEBRIS_COLOR[e.type] || '#c45a20';
    if (!e._blasted) {
      e._blasted = true;
      blast(world, e.x, e.y, vehicle ? 46 : 34, { size: vehicle ? 1.5 : 1.2, sfx: 'boom', debris: col, team: 'enemy' }, hooks);
    }
    if (e.tankHit) {
      hooks.addScore(200);
      floatingText(e.x, e.y - 16, 'TANK +200', '#ffb060');
    } else if (vehicle && !e.unloaded && e.type === 'truck') {
      hooks.addScore(150);
      floatingText(e.x, e.y - 16, 'SQUAD LOST', '#ffb060');
    }
  } else {
    deathPuff(e.x, e.y, '#6a7864');
  }
  hooks.addScore(e.def.score);
  hooks.addKill();
  floatingText(e.x, e.y - 8, '+' + e.def.score, '#ffe080');
  const drop = (world.diff && world.diff.dropRate) || 0.18;
  if (!vehicle && Math.random() < drop) {
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
  burstDebris(c.x, c.y, DEBRIS_COLOR[c.type] || '#8a7350', c.type === 'crate' ? 8 : 6);
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

export function drawWorldGround(g, world, camX, camY, viewW, viewH, palIndex) {
  const tiles = SPRITES.ground[palIndex] || SPRITES.ground[0];
  const tw = 32;
  const y0 = Math.floor(camY / tw) * tw;
  const x0 = Math.floor(camX / tw) * tw;
  for (let y = y0; y < camY + viewH + tw; y += tw) {
    for (let x = x0; x < camX + viewW + tw; x += tw) {
      const v = (((x / tw) | 0) + ((y / tw) | 0)) % tiles.length;
      const ti = (v + tiles.length) % tiles.length;
      g.drawImage(tiles[ti], x - camX, y - camY);
    }
  }
  for (const z of world.mud || []) {
    if (z.y + z.h < camY - 4 || z.y > camY + viewH + 4) continue;
    if (z.x + z.w < camX - 4 || z.x > camX + viewW + 4) continue;
    g.fillStyle = 'rgba(40,36,24,0.45)';
    g.beginPath();
    g.ellipse(z.x + z.w / 2 - camX, z.y + z.h / 2 - camY, z.w / 2, z.h / 2, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(90,80,50,0.25)';
    g.fillRect(z.x - camX + 4, z.y - camY + 4, Math.max(4, z.w * 0.3), 3);
  }
  for (const w of world.water) {
    const sy = w.y - camY;
    const sx = w.x - camX;
    if (sy + w.h < -4 || sy > viewH + 4) continue;
    if (sx + w.w < -4 || sx > viewW + 4) continue;
    for (let yy = 0; yy < w.h; yy += 24) {
      for (let xx = 0; xx < w.w; xx += 24) {
        g.drawImage(SPRITES.water, sx + xx, sy + yy);
      }
    }
    g.fillStyle = 'rgba(20,80,90,0.18)';
    g.fillRect(sx, sy, w.w, w.h);
  }
  for (const b of world.bridges) {
    const sy = b.y - camY;
    const sx = b.x - camX;
    if (sy + b.h < -4 || sy > viewH + 4) continue;
    for (let yy = 0; yy < b.h; yy += 12) {
      for (let xx = 0; xx < b.w; xx += 16) {
        g.drawImage(SPRITES.cover.bridge, sx + xx, sy + yy);
      }
    }
  }
  const t = performance.now() / 1000;
  for (const z of world.extractions || []) {
    const x = z.x - camX;
    const y = z.y - camY;
    if (x < -40 || x > viewW + 40 || y < -40 || y > viewH + 40) continue;
    g.globalAlpha = 0.75;
    g.strokeStyle = '#70c0ff';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(x, y, (z.r || 30) * (0.92 + Math.sin(t * 3) * 0.06), 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#e8e0d0';
    g.fillRect(x - 1, y - 18, 2, 18);
    g.fillStyle = '#3080e0';
    g.fillRect(x + 1, y - 18, 10, 6);
    g.globalAlpha = 1;
  }
}

function drawBuilding(g, c, x, y) {
  const w = c.w;
  const h = c.h;
  const left = x - w / 2;
  const top = y - h / 2;
  g.fillStyle = '#4e4942';
  g.fillRect(left, top, w, h);
  g.fillStyle = '#6e6860';
  g.fillRect(left + 2, top + 3, w - 4, Math.max(4, h * 0.42));
  g.fillStyle = '#2e2a26';
  g.fillRect(left, top, w, 3);
  g.fillStyle = '#d8c898';
  g.fillRect(left + 6, top + h * 0.48, 5, 4);
  g.fillRect(left + w - 12, top + h * 0.48, 5, 4);
  g.fillStyle = '#241c14';
  g.fillRect(x - 5, top + h - 8, 10, 8);
}

function drawBunker(g, c, x, y) {
  const w = c.w;
  const h = c.h;
  g.fillStyle = '#3e3e3a';
  g.fillRect(x - w / 2, y - h / 2, w, h);
  g.fillStyle = '#6a6a62';
  g.fillRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, 6);
  g.fillStyle = '#10100e';
  g.fillRect(x - 8, y + h / 2 - 7, 16, 4);
  g.fillStyle = '#2a2a26';
  g.fillRect(x - w / 2, y - 2, 4, h / 2);
  g.fillRect(x + w / 2 - 4, y - 2, 4, h / 2);
}

function drawTrap(g, x, y) {
  g.strokeStyle = '#9aa0a8';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x - 8, y - 5);
  g.lineTo(x + 8, y + 6);
  g.moveTo(x + 8, y - 5);
  g.lineTo(x - 8, y + 6);
  g.moveTo(x, y - 8);
  g.lineTo(x, y + 7);
  g.stroke();
}

function drawWire(g, c, x, y) {
  const w = c.w || 28;
  const h = c.h || 12;
  g.strokeStyle = '#5c584e';
  g.lineWidth = 1;
  g.strokeRect(x - w / 2, y - h / 2, w, h);
  g.beginPath();
  for (let i = -2; i <= 2; i++) {
    g.moveTo(x - w / 2, y + i * 2);
    g.lineTo(x + w / 2, y + i * 2 + 3);
  }
  g.stroke();
}

export function drawCover(g, world, camX, camY, viewW, viewH) {
  for (const c of world.cover) {
    if (!c.alive) continue;
    const sx = c.x - camX;
    const sy = c.y - camY;
    if (sx < -c.w || sx > viewW + c.w || sy < -c.h - 20 || sy > viewH + c.h) continue;
    if (c.type === 'building') {
      drawBuilding(g, c, sx, sy);
      continue;
    }
    if (c.type === 'bunker') {
      drawBunker(g, c, sx, sy);
      continue;
    }
    if (c.type === 'tanktrap') {
      drawTrap(g, sx, sy);
      continue;
    }
    if (c.type === 'wire') {
      drawWire(g, c, sx, sy);
      continue;
    }
    const spr = SPRITES.cover[c.type];
    if (spr) {
      g.drawImage(spr, (sx - spr.width / 2) | 0, (sy - spr.height + c.h / 2) | 0);
    } else {
      g.fillStyle = '#888';
      g.fillRect(sx - c.w / 2, sy - c.h / 2, c.w, c.h);
    }
  }
}

function drawWarn(g, e, camX, camY) {
  if (!(e.warnT > 0)) return;
  const u = 1 - e.warnT / (e.warnMax || 1);
  const R = (e.warnR || 40) * Math.max(0.15, u);
  const x = e.warnX - camX;
  const y = e.warnY - camY;
  g.globalAlpha = 0.28 + 0.2 * Math.sin(performance.now() / 80);
  g.fillStyle = '#c01818';
  g.beginPath();
  g.ellipse(x, y, R, R * 0.62, 0, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 0.9;
  g.strokeStyle = '#ff4040';
  g.lineWidth = 1.5;
  g.stroke();
  const z = Math.sin(Math.min(1, u) * Math.PI) * 36;
  g.fillStyle = '#2a2018';
  g.beginPath();
  g.arc(x, y - z, 3, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
}

function drawVehicle(g, e, x, y) {
  const jeep = e.type === 'jeep';
  const north = (e.facingY || 1) < 0;
  g.fillStyle = jeep ? '#3e4e32' : '#4a5c38';
  g.fillRect(x - (jeep ? 8 : 11), y - 16, jeep ? 16 : 22, jeep ? 26 : 32);
  g.fillStyle = '#241c14';
  g.fillRect(x - (jeep ? 6 : 8), north ? y - 16 : y + 6, jeep ? 12 : 16, 10);
  g.fillStyle = '#1a1a16';
  g.fillRect(x - 12, y - 10, 4, 6);
  g.fillRect(x + 8, y - 10, 4, 6);
  g.fillRect(x - 12, y + 4, 4, 6);
  g.fillRect(x + 8, y + 4, 4, 6);
  if (!jeep) {
    g.fillStyle = '#6a5a40';
    g.fillRect(x - 8, north ? y + 2 : y - 14, 16, 12);
  } else {
    g.strokeStyle = '#222';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (e.facingX || 0) * 14, y + (e.facingY || 1) * 14);
    g.stroke();
  }
}

export function drawEntities(g, world, camX, camY, viewW, viewH) {
  const p = world.player;
  for (const e of world.enemies) {
    if (e.alive && e.warnT > 0) drawWarn(g, e, camX, camY);
  }
  for (const pow of world.pows) {
    if (!pow.alive) continue;
    const sx = pow.x - camX;
    const sy = pow.y - camY;
    if (sy < -30 || sy > viewH + 30 || sx < -20 || sx > viewW + 20) continue;
    drawShadow(g, sx, sy, 6);
    const spr = unitSprite('pow', pow.facingX, pow.facingY, pow.walkT);
    g.drawImage(spr, (sx - spr.width / 2) | 0, (sy - spr.height + 6) | 0);
  }
  for (const e of world.enemies) {
    if (!e.alive) continue;
    const sx = e.x - camX;
    const sy = e.y - camY;
    const lift = e.elevated ? 12 : 0;
    const sniperLaser = e.type === 'sniper' && e.laser > 0;
    if (!sniperLaser && (sy < -40 || sy > viewH + 40 || sx < -40 || sx > viewW + 40)) continue;
    if (sniperLaser && p && p.alive) {
      g.strokeStyle = 'rgba(255,40,40,0.8)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(sx, sy - lift);
      g.lineTo((e.laserX || p.x) - camX, (e.laserY || p.y) - camY);
      g.stroke();
    }
    if (sy < -50 || sy > viewH + 40 || sx < -40 || sx > viewW + 40) continue;
    drawShadow(g, sx, sy, e.type === 'truck' ? 12 : 6);
    if (e.type === 'gunnest' || e.type === 'bunker') {
      g.drawImage(SPRITES.cover.gunnest, (sx - 13) | 0, (sy - 16) | 0);
    } else if (e.type === 'mortar') {
      if (SPRITES.cover.sandbag) {
        g.drawImage(SPRITES.cover.sandbag, (sx - 18) | 0, (sy - 4) | 0);
        g.drawImage(SPRITES.cover.sandbag, (sx + 2) | 0, (sy - 2) | 0);
      }
      g.strokeStyle = '#2a2824';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + (e.facingX || 0) * 12, sy + (e.facingY || 1) * 10 - 8);
      g.stroke();
      const spr = unitSprite('enemy', e.facingX, e.facingY, 0);
      g.drawImage(spr, (sx - spr.width / 2 - 6) | 0, (sy - spr.height + 4) | 0);
    } else if (e.type === 'truck' || e.type === 'jeep') {
      drawVehicle(g, e, sx, sy);
    } else {
      const spr = unitSprite('enemy', e.facingX, e.facingY, e.walkT);
      const dy = (sy - spr.height + 6 - lift) | 0;
      g.drawImage(spr, (sx - spr.width / 2) | 0, dy);
      if (e.elevated) {
        g.fillStyle = '#5a564e';
        g.fillRect(sx - 10, sy - 4, 20, 4);
      }
      if (e.type === 'flamer') {
        const bx = sx - (e.facingX || 0) * 8;
        const by = sy - (e.facingY || 0) * 8;
        g.fillStyle = '#c45a28';
        g.fillRect(bx - 3, by - 5, 6, 8);
        g.fillStyle = '#e8d090';
        g.fillRect(bx - 1, by - 3, 2, 3);
        if (e.flaming && p) {
          g.globalAlpha = 0.35;
          g.fillStyle = '#ff6a10';
          g.beginPath();
          g.moveTo(sx, sy);
          const n = norm(p.x - e.x, p.y - e.y);
          g.lineTo(sx + n.x * 50 - n.y * 14, sy + n.y * 50 + n.x * 14);
          g.lineTo(sx + n.x * 50 + n.y * 14, sy + n.y * 50 - n.x * 14);
          g.fill();
          g.globalAlpha = 1;
        }
      }
    }
  }
  if (p && p.alive) {
    const sx = p.x - camX;
    const sy = p.y - camY;
    const hide = p.invuln > 0 && ((p.blink * 12) | 0) % 2 === 0;
    if (!hide) {
      drawShadow(g, sx, sy, 6);
      const spr = unitSprite('player', p.facingX, p.facingY, p.walkT);
      g.drawImage(spr, (sx - spr.width / 2) | 0, (sy - spr.height + 6) | 0);
    }
  }
  for (const pk of world.pickups) {
    if (!pk.alive) continue;
    const sx = pk.x - camX;
    const sy = pk.y - camY + Math.sin(pk.t * 4) * 2;
    if (sx < -16 || sx > viewW + 16 || sy < -16 || sy > viewH + 16) continue;
    const spr = SPRITES.pickups[pk.type];
    g.save();
    g.globalAlpha = 0.35 + 0.25 * Math.sin(pk.t * 6);
    g.fillStyle = '#ffe080';
    g.beginPath();
    g.arc(sx, sy + 2, 8, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    if (spr) g.drawImage(spr, (sx - 6) | 0, (sy - 10) | 0);
    g.restore();
  }
  for (const gr of world.grenades) {
    const sx = gr.x - camX;
    const sy = gr.y - camY - gr.z;
    const pulse = 6 + (gr.t / gr.tmax) * 10;
    g.fillStyle = 'rgba(255,40,30,0.28)';
    g.beginPath();
    g.ellipse(gr.tx - camX, gr.ty - camY, pulse, pulse * 0.62, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,80,40,0.85)';
    g.stroke();
    g.drawImage(SPRITES.grenade, (sx - 3) | 0, (sy - 6) | 0);
  }
  for (const b of world.bullets) {
    const sx = b.x - camX;
    const sy = b.y - camY;
    if (b.kind === 'rocket') {
      g.save();
      g.translate(sx, sy);
      g.rotate(Math.atan2(b.vy, b.vx));
      g.drawImage(SPRITES.rocket, -6, -2);
      g.restore();
    } else if (b.kind === 'flame') {
      g.fillStyle = 'rgba(255,140,30,0.7)';
      g.beginPath();
      g.arc(sx, sy, b.r, 0, Math.PI * 2);
      g.fill();
    } else {
      g.strokeStyle = b.tracer;
      g.lineWidth = b.sniper ? 2.2 : 2;
      g.beginPath();
      const len = Math.hypot(b.vx, b.vy) || 1;
      const trail = b.sniper ? 14 : 12;
      g.moveTo(sx, sy);
      g.lineTo(sx - (b.vx / len) * trail, sy - (b.vy / len) * trail);
      g.stroke();
    }
  }
}

export function drawEdgeArrows(g, world, camX, camY, viewW, viewH) {
  const marks = [];
  for (const pow of world.pows) {
    if (!pow.alive || pow.extracted) continue;
    marks.push([pow.x, pow.y, '#6eb0ff']);
  }
  for (const e of world.enemies) {
    if (!e.alive) continue;
    if (e.type === 'gunnest' || e.type === 'bunker' || e.type === 'mortar') marks.push([e.x, e.y, '#ff6040']);
  }
  for (const pk of world.pickups) {
    if (!pk.alive) continue;
    if (Math.abs(pk.x - (world.player ? world.player.x : 0)) + Math.abs(pk.y - (world.player ? world.player.y : 0)) < 220) {
      marks.push([pk.x, pk.y, '#ffe080']);
    }
  }
  const cx = viewW * 0.5;
  const cy = viewH * 0.5;
  let n = 0;
  for (const [wx, wy, col] of marks) {
    const x = wx - camX;
    const y = wy - camY;
    if (x > 10 && x < viewW - 10 && y > 10 && y < viewH - 10) continue;
    if (n++ > 8) break;
    const dx = x - cx;
    const dy = y - cy;
    const hw = viewW * 0.5 - 12;
    const hh = viewH * 0.5 - 12;
    let t = 1e9;
    if (dx !== 0) t = Math.min(t, hw / Math.abs(dx));
    if (dy !== 0) t = Math.min(t, hh / Math.abs(dy));
    const ax = cx + dx * t;
    const ay = cy + dy * t;
    const ang = Math.atan2(dy, dx);
    g.save();
    g.translate(ax, ay);
    g.rotate(ang);
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(7, 0);
    g.lineTo(-5, 4);
    g.lineTo(-5, -4);
    g.fill();
    g.restore();
  }
}

export { WEAPONS, ENEMY_TYPES, spawnPickup, fireFrom, facingName };
