/** The Bulwark — final war machine. Procedural pixel draw, no assets. */
import { WORLD_W, clamp } from './config.js?v=1';
import {
  explode,
  shake,
  addFlash,
  addFire,
  floatingText,
  spawnParticle,
  hitSparks,
} from './fx.js?v=1';
import { sfx } from './audio.js?v=1';

const BOSS_W = 158;
const BOSS_H = 66;

function recompute(boss) {
  let th = 0;
  let alive = 0;
  for (const t of boss.turrets) {
    if (t.hp <= 0) t.alive = false;
    if (t.alive) {
      th += t.hp;
      alive++;
    }
  }
  boss.turretsAlive = alive;
  boss.hp = Math.max(0, th + Math.max(0, boss.coreHp));
}

function turretXY(boss, t) {
  return { x: boss.x + t.lx, y: boss.y + t.ly };
}

function coreXY(boss) {
  return { x: boss.x + boss.core.lx, y: boss.y + boss.core.ly };
}

export function bossAimPoint(boss) {
  if (!boss || !boss.active || boss.dying || boss.hp <= 0) return null;
  if (boss.phase <= 1) {
    const t = boss.turrets.find((tt) => tt.alive);
    if (!t) return null;
    return turretXY(boss, t);
  }
  // Exposed mouth on the south face, not the buried core sprite.
  return { x: boss.x + boss.core.lx, y: boss.y + boss.h - 4 };
}

export function hitTestBoss(boss, x, y, r) {
  if (!boss || !boss.active || boss.dying) return null;
  const rr = r || 0;
  if (boss.phase <= 1) {
    for (const t of boss.turrets) {
      if (!t.alive) continue;
      const p = turretXY(boss, t);
      const dx = x - p.x;
      const dy = y - p.y;
      const rad = t.r + rr;
      if (dx * dx + dy * dy <= rad * rad) return { kind: 'turret', turret: t };
    }
  } else if (boss.coreHp > 0) {
    const p = coreXY(boss);
    const dx = x - p.x;
    const dy = y - p.y;
    const rad = boss.core.r + rr;
    if (dx * dx + dy * dy <= rad * rad) return { kind: 'core' };
    // Plates are off: a vertical mouth reaches past the south armor.
    const mouthL = p.x - 14 - rr;
    const mouthR = p.x + 14 + rr;
    const mouthTop = boss.y + boss.h * 0.45;
    const mouthBot = boss.y + boss.h + 10 + rr;
    if (x >= mouthL && x <= mouthR && y >= mouthTop && y <= mouthBot) return { kind: 'core' };
  }
  const left = boss.x - boss.w / 2 - rr;
  const right = boss.x + boss.w / 2 + rr;
  const top = boss.y - rr;
  const bot = boss.y + boss.h + rr;
  if (x >= left && x <= right && y >= top && y <= bot) return { kind: 'hull' };
  return null;
}

function destroyTurret(boss, t) {
  if (!t.alive && t.hp <= 0) return;
  t.alive = false;
  t.hp = 0;
  t.wreck = true;
  const p = turretXY(boss, t);
  explode(p.x, p.y, 1.2, { debris: '#7a828c' });
  addFire(p.x, p.y, 8, 10);
  sfx('turretboom');
  shake(7);
  if (boss.hooks.addScore) boss.hooks.addScore(450);
  floatingText(p.x, p.y - 10, 'TURRET DOWN', '#ffd080');
  recompute(boss);
  if (!boss.turrets.some((tt) => tt.alive)) enterPhase2(boss);
}

function enterPhase2(boss) {
  if (boss.phase >= 2 || boss.dying) return;
  boss.phase = 2;
  boss.platesOff = true;
  boss.attack = 'idle';
  boss.attackT = 0.4;
  boss.comboUsed = false;
  explode(boss.x, boss.y + boss.h * 0.45, 1.7, { debris: '#8a9098' });
  explode(boss.x - 36, boss.y + 20, 1.15, { debris: '#6a7078' });
  explode(boss.x + 34, boss.y + 24, 1.15, { debris: '#6a7078' });
  sfx('klaxon');
  shake(14);
  addFlash(0.55);
  if (boss.hooks.slowMo) boss.hooks.slowMo(0.5);
  floatingText(boss.x, boss.y + boss.h + 8, 'CORE EXPOSED', '#ffe080');
  recompute(boss);
  if (boss.maxHp > 0 && boss.hp / boss.maxHp <= 0.35) boss.phase = 3;
}

function enterPhase3(boss) {
  if (boss.phase >= 3 || boss.dying) return;
  boss.phase = 3;
  sfx('klaxon');
  floatingText(boss.x, boss.y - 6, 'DESPERATE', '#ff7840');
  shake(8);
}

function startDeath(boss) {
  if (!boss || boss.dying || boss.dead) return;
  boss.dying = true;
  boss.attack = 'destroy';
  boss.hp = 0;
  boss.coreHp = 0;
  boss.deathT = 0;
  boss.nextBoom = 0.05;
  boss.finalDone = false;
  boss.finished = false;
  for (const t of boss.turrets) t.alive = false;
  sfx('klaxon');
  if (boss.hooks.slowMo) boss.hooks.slowMo(0.55);
  shake(12);
}

function hurtTurret(boss, t, n) {
  if (!t.alive || boss.dying) return;
  t.hp -= n;
  t.flash = 0.12;
  if (t.hp <= 0) destroyTurret(boss, t);
  else recompute(boss);
}

function hurtCore(boss, n) {
  if (boss.dying || boss.phase < 2) return;
  boss.coreHp -= n;
  boss.coreFlash = 0.1;
  if (boss.coreHp <= 0) {
    boss.coreHp = 0;
    recompute(boss);
    if (boss.hooks.addScore) boss.hooks.addScore(2500);
    startDeath(boss);
    return;
  }
  recompute(boss);
  if (boss.phase === 2 && boss.maxHp > 0 && boss.hp / boss.maxHp <= 0.35) enterPhase3(boss);
}

/** Test / gameplay damage. Phase 1 spends the whole hit on one turret (no spill). */
export function bossDamage(boss, n) {
  if (!boss || !boss.active || boss.dying || boss.dead) return;
  const dmg = Math.max(0, n || 0);
  if (dmg <= 0) return;
  if (boss.phase <= 1) {
    const t = boss.turrets.find((tt) => tt.alive);
    if (t) {
      hurtTurret(boss, t, dmg);
      return;
    }
  }
  hurtCore(boss, dmg);
}

export function damageBossAt(boss, hit, dmg, kind) {
  if (!boss || !hit || boss.dying || !boss.active) return;
  if (hit.kind === 'hull') return;
  const bonus = kind === 'rocket' ? 8 : 0;
  if (hit.kind === 'turret' && hit.turret) hurtTurret(boss, hit.turret, dmg + bonus);
  else if (hit.kind === 'core') hurtCore(boss, dmg + bonus);
}

export function damageBossExplosion(boss, x, y, radius) {
  if (!boss || !boss.active || boss.dying) return;
  const bonus = 14;
  let touched = false;
  if (boss.phase <= 1) {
    for (const t of boss.turrets) {
      if (!t.alive) continue;
      const p = turretXY(boss, t);
      const dx = x - p.x;
      const dy = y - p.y;
      const rad = radius + t.r;
      if (dx * dx + dy * dy <= rad * rad) {
        hurtTurret(boss, t, bonus);
        touched = true;
      }
    }
  } else if (!boss.dying) {
    const p = coreXY(boss);
    const dx = x - p.x;
    const dy = y - p.y;
    const rad = radius + boss.core.r + 8;
    if (dx * dx + dy * dy <= rad * rad) {
      hurtCore(boss, bonus + 6);
      touched = true;
    }
  }
  if (touched || boss.dying) return;
  const hx = clamp(x, boss.x - boss.w / 2, boss.x + boss.w / 2);
  const hy = clamp(y, boss.y, boss.y + boss.h);
  const dx = x - hx;
  const dy = y - hy;
  if (dx * dx + dy * dy <= radius * radius) {
    if (boss.phase <= 1) {
      const t = boss.turrets.find((tt) => tt.alive);
      if (t) hurtTurret(boss, t, 8);
    } else hurtCore(boss, 10);
  }
}

export function killBoss(boss) {
  if (!boss || boss.dead) return;
  if (!boss.dying) {
    if (boss.hooks.addScore && boss.hp > 0) boss.hooks.addScore(2500);
    startDeath(boss);
  }
}

export function createBoss(diff, spec, hooks) {
  const mul = (diff && diff.bossHp) || 1;
  const tHp = Math.max(10, Math.round(28 * mul));
  const cHp = Math.max(70, Math.round(210 * mul));
  const mk = (id, lx, ly, r) => ({
    id,
    lx,
    ly,
    r,
    hp: tHp,
    max: tHp,
    alive: true,
    flash: 0,
    wreck: false,
    // Staggered opening so the first seconds are readable: MGs, then cannon, then the first shell.
    cd: id === 'mortar' ? 2.8 : id === 'cannon' ? 1.7 : 0.8 + Math.random() * 0.5,
    burst: 0,
    pause: 0.6,
  });
  const boss = {
    name: 'Bulwark',
    active: true,
    dying: false,
    dead: false,
    wreck: false,
    phase: 1,
    w: BOSS_W,
    h: BOSS_H,
    homeX: spec.x || WORLD_W / 2,
    x: spec.x || WORLD_W / 2,
    y: spec.y || 40,
    swayAmp: spec.sway != null ? spec.sway : 8,
    // Turrets sit on the south face and stick out past the hull so rifle
    // shots from below connect before the armor plate stops them.
    turrets: [
      mk('mgL', -54, 62, 13),
      mk('mgR', 54, 62, 13),
      mk('cannon', -18, 60, 13),
      mk('mortar', 26, 64, 12),
    ],
    core: { lx: 0, ly: 36, r: 13 },
    coreHp: cHp,
    coreMax: cHp,
    coreFlash: 0,
    maxHp: tHp * 4 + cHp,
    hp: tHp * 4 + cHp,
    turretsAlive: 4,
    attack: 'idle',
    attackT: 0.8,
    pending: '',
    warns: [],
    platesOff: false,
    hooks: hooks || {},
    diff: diff || {},
    t: 0,
    teleLeft: 0,
    comboUsed: false,
    deathT: 0,
    nextBoom: 0,
    smokeT: 0,
    sparkT: 0.4,
    hatch: 0,
    laserY: 0,
    laserGapX: 180,
    laserGapW: 56,
    shockX: 180,
    shockY: 80,
    shockR: 20,
    shockMax: 220,
    shockGap: 1.2,
    shockGapW: 0.95,
    finished: false,
  };
  return boss;
}

export function bossPublic(boss) {
  if (!boss) return null;
  return {
    active: !!(boss.active && !boss.dead),
    phase: boss.phase | 0,
    hp: Math.max(0, Math.round(boss.hp)),
    maxHp: boss.maxHp | 0,
    turretsAlive: boss.turrets.filter((t) => t.alive).length,
    attack: boss.attack || 'idle',
    x: Math.round(boss.x * 10) / 10,
    y: Math.round(boss.y * 10) / 10,
    // Read-only details for test bots.
    pending: boss.pending || null,
    warns: boss.warns.map((w) => ({ x: Math.round(w.x), y: Math.round(w.y), r: w.r || 34, t: Math.round(w.t * 100) / 100 })),
    laser: boss.laserGapX != null ? { y: Math.round(boss.laserY || 0), gapX: Math.round(boss.laserGapX), gapW: boss.laserGapW } : null,
    shock: boss.shockX != null ? { x: Math.round(boss.shockX), y: Math.round(boss.shockY), gap: boss.shockGap, gapW: boss.shockGapW, r: Math.round(boss.shockR || 0) } : null,
  };
}

function teleTime(boss) {
  const t = boss.diff && boss.diff.bossTele;
  return t || 1.05;
}

function aimShot(boss, x, y, tx, ty) {
  return { x: tx - x, y: ty - y };
}

function fireBullet(boss, x, y, tx, ty, speed) {
  const n = aimShot(boss, x, y, tx, ty);
  const mul = (boss.diff && boss.diff.bulletSpeedMul) || 1;
  if (boss.hooks.spawnBullet) boss.hooks.spawnBullet(x, y, n.x, n.y, speed * mul);
  sfx('bossmg');
}

function updateWarnings(boss, world, dt) {
  for (let i = boss.warns.length - 1; i >= 0; i--) {
    const w = boss.warns[i];
    w.t -= dt;
    if (w.t <= 0) {
      if (boss.hooks.blast) boss.hooks.blast(w.x, w.y, w.r || 34);
      else explode(w.x, w.y, 1.2);
      boss.warns.splice(i, 1);
    }
  }
}

function updateTurrets(boss, world, dt) {
  const p = world.player;
  const fmul = (boss.diff && boss.diff.fireRateMul) || 1;
  if (!p || !p.alive) return;
  for (const t of boss.turrets) {
    if (!t.alive) continue;
    t.cd -= dt;
    if (t.cd > 0) continue;
    const pos = turretXY(boss, t);
    if (t.id === 'mgL' || t.id === 'mgR') {
      t.burst = (t.burst || 0) + 1;
      fireBullet(boss, pos.x, pos.y + 4, p.x, p.y, 150);
      if (t.burst >= 3) {
        t.burst = 0;
        t.cd = 1.25 * fmul;
      } else t.cd = 0.2 * fmul;
    } else if (t.id === 'cannon') {
      fireBullet(boss, pos.x, pos.y + 6, p.x, p.y, 168);
      t.cd = 2.15 * fmul;
      t.flash = 0.18;
    } else if (t.id === 'mortar') {
      const warn = Math.max(0.95, (boss.diff && boss.diff.mortarWarn) || 1.05);
      const ox = (boss.hooks.rng ? boss.hooks.rng() : Math.random()) < 0.5 ? -8 : 8;
      boss.warns.push({
        x: clamp(p.x + ox, 28, WORLD_W - 28),
        y: p.y,
        t: warn,
        max: warn,
        r: 34,
      });
      sfx('warn');
      t.cd = 3.1 * fmul;
    }
  }
}

function setupLaser(boss, player) {
  const floor = boss.y + boss.h + 16;
  let y = player.y - 28;
  if (y < floor) y = floor;
  const viewBot = boss.hooks.viewBottom || player.y + 40;
  if (y > viewBot - 18) y = Math.max(floor, player.y - 16);
  boss.laserY = y;
  boss.laserGapW = 56;
  const dir = player.x < boss.homeX ? 1 : -1;
  let gx = player.x + dir * 46;
  gx = clamp(gx, 40, WORLD_W - 40);
  if (Math.abs(gx - player.x) < 28) gx = clamp(player.x - dir * 46, 40, WORLD_W - 40);
  boss.laserGapX = gx;
}

function setupShock(boss, player) {
  boss.shockX = boss.x;
  boss.shockY = boss.y + boss.h * 0.55;
  boss.shockR = 18;
  boss.shockMax = 240;
  const side = player.x < boss.x ? 1 : -1;
  boss.shockGap = Math.PI / 2 + side * 0.7;
  boss.shockGapW = 1.0;
}

function beginTelegraph(boss, player) {
  const roll = boss.hooks.rng ? boss.hooks.rng() : Math.random();
  let kind = 'laser';
  if (roll < 0.34) kind = 'shock';
  else if (roll < 0.55) kind = 'deploy';
  if (boss.phase >= 3 && roll < 0.28) kind = 'shock';
  boss.pending = kind;
  boss.attack = 'telegraph';
  boss.attackT = teleTime(boss);
  boss.teleLeft = boss.attackT;
  if (kind === 'laser') setupLaser(boss, player);
  else if (kind === 'shock') setupShock(boss, player);
  else boss.hatch = 1;
  sfx('warn');
  sfx('charge');
}

function inShockGap(boss, x, y) {
  const ang = Math.atan2(y - boss.shockY, x - boss.shockX);
  let da = ang - boss.shockGap;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  return Math.abs(da) < boss.shockGapW * 0.5;
}

function updateBigAttacks(boss, world, dt) {
  const p = world.player;
  if (!p) return;
  boss.attackT -= dt;
  if (boss.attack === 'telegraph') boss.teleLeft = Math.max(0, boss.attackT);

  if (boss.attack === 'idle') {
    if (boss.attackT <= 0 && p.alive) beginTelegraph(boss, p);
    return;
  }
  if (boss.attack === 'telegraph') {
    if (boss.attackT <= 0) {
      boss.attack = boss.pending || 'laser';
      if (boss.attack === 'laser') boss.attackT = 1.05;
      else if (boss.attack === 'shock') {
        boss.attackT = 1.2;
        boss.shockR = 18;
      } else {
        boss.attackT = 0.45;
        deploySoldiers(boss, world);
      }
    }
    return;
  }
  if (boss.attack === 'laser') {
    if (p.alive && Math.abs(p.y - boss.laserY) < 10 && Math.abs(p.x - boss.laserGapX) > boss.laserGapW * 0.5) {
      if (boss.hooks.hurtPlayer) boss.hooks.hurtPlayer();
    }
  } else if (boss.attack === 'shock') {
    const dur = 1.2;
    const u = 1 - Math.max(0, boss.attackT) / dur;
    boss.shockR = 18 + (boss.shockMax - 18) * clamp(u, 0, 1);
    if (p.alive) {
      const dx = p.x - boss.shockX;
      const dy = p.y - boss.shockY;
      const dist = Math.hypot(dx, dy);
      if (Math.abs(dist - boss.shockR) < 13 && !inShockGap(boss, p.x, p.y)) {
        if (boss.hooks.hurtPlayer) boss.hooks.hurtPlayer();
      }
    }
  }
  if (boss.attackT <= 0) {
    boss.hatch = 0;
    if (boss.phase >= 3 && !boss.comboUsed && (boss.hooks.rng ? boss.hooks.rng() : 0) < 0.7) {
      boss.comboUsed = true;
      boss.attack = 'idle';
      boss.attackT = 0.3;
    } else {
      boss.comboUsed = false;
      boss.attack = 'idle';
      boss.attackT = boss.phase >= 3 ? 0.5 : 1.2;
    }
  }
}

function deploySoldiers(boss, world) {
  const want = (boss.diff && boss.diff.bossAdds) || 2;
  let alive = 0;
  for (const e of world.enemies) if (e.alive && e.fromBoss) alive++;
  const n = Math.max(0, Math.min(want, 4 - alive));
  sfx('klaxon');
  for (let i = 0; i < n; i++) {
    const x = clamp(boss.x - 24 + i * 16, 24, WORLD_W - 24);
    const y = boss.y + boss.h + 8;
    if (boss.hooks.spawnSoldier) boss.hooks.spawnSoldier(x, y);
  }
  floatingText(boss.x, boss.y + boss.h + 4, 'DEPLOY', '#ffb0a0');
}

function updateDeath(boss, dt) {
  boss.deathT += dt;
  boss.wreck = true;
  if (boss.deathT < 2.7 && boss.deathT >= boss.nextBoom) {
    const k = boss.deathT / 2.7;
    const rx = boss.x - boss.w * 0.4 + Math.random() * boss.w * 0.8;
    const ry = boss.y + 8 + Math.random() * (boss.h - 12);
    explode(rx, ry, 0.85 + k * 0.9, { debris: '#8a929c' });
    shake(6 + k * 10);
    addFlash(0.12 + k * 0.15);
    sfx('boom');
    boss.nextBoom = boss.deathT + Math.max(0.16, 0.38 - k * 0.2);
  }
  if (boss.deathT >= 2.75 && !boss.finalDone) {
    boss.finalDone = true;
    explode(boss.x, boss.y + boss.h * 0.4, 2.3, { debris: '#c8d0d8' });
    addFlash(1);
    shake(18);
    sfx('boom');
    for (let i = 0; i < 6; i++) {
      addFire(boss.x - 50 + i * 20, boss.y + 20 + (i % 2) * 16, 26, 12 + (i % 3));
    }
  }
  if (boss.deathT >= 3.15 && !boss.finished) {
    boss.finished = true;
    boss.active = false;
    boss.dead = true;
    boss.attack = 'destroy';
    sfx('victory');
    if (boss.hooks.victory) boss.hooks.victory();
  }
}

function updateSmoke(boss, dt) {
  boss.smokeT -= dt;
  if (boss.smokeT > 0) return;
  boss.smokeT = boss.phase >= 3 ? 0.12 : 0.22;
  for (const t of boss.turrets) {
    if (t.alive && t.hp < t.max * 0.55) {
      const p = turretXY(boss, t);
      spawnParticle({
        kind: 'smoke',
        x: p.x,
        y: p.y - 6,
        vx: (Math.random() - 0.5) * 8,
        vy: -16 - Math.random() * 10,
        life: 0.6,
        max: 0.6,
        color: '#5a534c',
        r: 4 + Math.random() * 3,
      });
    }
    if (t.wreck && Math.random() < 0.7) {
      const p = turretXY(boss, t);
      spawnParticle({
        kind: 'fire',
        x: p.x,
        y: p.y,
        vx: (Math.random() - 0.5) * 6,
        vy: -12,
        life: 0.35,
        max: 0.35,
        color: Math.random() < 0.5 ? '#ffb040' : '#ff5410',
        r: 3,
        add: true,
      });
    }
  }
  if (boss.phase >= 3 && !boss.dying) {
    boss.sparkT -= dt;
    if (boss.sparkT <= 0) {
      boss.sparkT = 0.55;
      const x = boss.x - 40 + Math.random() * 80;
      const y = boss.y + 10 + Math.random() * 40;
      explode(x, y, 0.45, { debris: '#6a7078' });
      hitSparks(x, y);
    }
  }
}

export function updateBoss(boss, world, dt) {
  if (!boss || boss.dead) return;
  if (boss.dying) {
    updateDeath(boss, dt);
    updateSmoke(boss, dt);
    return;
  }
  boss.t += dt;
  if (boss.phase >= 2) {
    const sp = boss.phase >= 3 ? 1.15 : 0.62;
    boss.x = boss.homeX + Math.sin(boss.t * sp) * boss.swayAmp;
  }
  for (const t of boss.turrets) if (t.flash > 0) t.flash -= dt;
  if (boss.coreFlash > 0) boss.coreFlash -= dt;
  updateWarnings(boss, world, dt);
  if (boss.phase <= 1) updateTurrets(boss, world, dt);
  else updateBigAttacks(boss, world, dt);
  updateSmoke(boss, dt);
}

export function clearBossHazards(boss) {
  if (!boss || boss.dying) return;
  boss.warns.length = 0;
  boss.attack = 'idle';
  boss.attackT = 0.85;
  boss.hatch = 0;
  boss.pending = '';
}

function rect(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(x | 0, y | 0, w | 0, h | 0);
}

export function drawBoss(g, boss, camX, camY) {
  if (!boss) return;
  const x = (boss.x - boss.w / 2 - camX) | 0;
  const y = (boss.y - camY) | 0;
  const w = boss.w;
  const h = boss.h;
  // Shadow
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(x + 6, y + h - 2, w - 12, 8);
  // Treads
  rect(g, x, y + h - 16, w, 14, '#1a1c20');
  rect(g, x + 2, y + h - 14, w - 4, 10, '#2a2e34');
  g.fillStyle = '#3a4048';
  for (let i = 4; i < w - 4; i += 10) rect(g, x + i, y + h - 13, 6, 8, '#121418');
  // Wheels
  for (let i = 8; i < w - 8; i += 18) {
    rect(g, x + i, y + h - 8, 8, 8, '#0e1014');
    rect(g, x + i + 2, y + h - 6, 4, 4, '#5a6068');
  }
  // Hull
  rect(g, x + 10, y + 10, w - 20, h - 24, boss.platesOff ? '#3a2a28' : '#4a545e');
  rect(g, x + 16, y + 6, w - 32, 16, '#5c6772');
  rect(g, x + 22, y + 14, w - 44, h - 32, '#3e4650');
  // Armor plates
  if (!boss.platesOff) {
    rect(g, x + 28, y + 18, 36, 22, '#6a7480');
    rect(g, x + w - 64, y + 18, 36, 22, '#6a7480');
    rect(g, x + w / 2 - 16, y + 16, 32, 18, '#7a8490');
  } else {
    rect(g, x + w / 2 - 14, y + 22, 28, 20, '#1a1210');
    const pulse = 0.55 + Math.sin(boss.t * 8) * 0.45;
    g.globalAlpha = 0.45 + pulse * 0.55;
    rect(g, x + w / 2 - 8, y + 26, 16, 12, boss.phase >= 3 ? '#ff5410' : '#ffb040');
    g.globalAlpha = 1;
    rect(g, x + w / 2 - 3, y + 29, 6, 6, '#fff4c0');
    rect(g, x + w / 2 - 12, y + h - 18, 24, 22, '#140c0a');
    rect(g, x + w / 2 - 6, y + h - 12, 12, 14, boss.phase >= 3 ? '#ff5410' : '#ffb040');
    rect(g, x + w / 2 - 2, y + h - 8, 4, 6, '#fff4c0');
  }
  // Stage 3 polish: outline, top highlight, panel seams, hazard band, side exhausts, glowing slits.
  g.fillStyle = '#101317';
  g.fillRect(x + 9, y + 9, w - 18, 1);
  g.fillRect(x + 9, y + 9, 1, h - 23);
  g.fillRect(x + w - 10, y + 9, 1, h - 23);
  rect(g, x + 16, y + 6, w - 32, 1, '#8a96a2');
  for (let i = 1; i < 5; i++) rect(g, x + 10 + ((w - 20) * i) / 5, y + 22, 1, h - 40, '#353c44');
  for (let i = 0; i < w - 28; i += 8) {
    rect(g, x + 14 + i, y + h - 20, 4, 3, '#d8b030');
    rect(g, x + 18 + i, y + h - 20, 4, 3, '#1a1a1a');
  }
  rect(g, x + 2, y + 20, 8, 18, '#2a3036');
  rect(g, x + w - 10, y + 20, 8, 18, '#2a3036');
  for (let i = 0; i < 3; i++) {
    rect(g, x + 3, y + 23 + i * 5, 6, 2, '#0c0e10');
    rect(g, x + w - 9, y + 23 + i * 5, 6, 2, '#0c0e10');
  }
  if (!boss.platesOff && !boss.dead) {
    const glow = 0.4 + Math.sin(boss.t * 5) * 0.3;
    g.globalAlpha = glow;
    rect(g, x + w / 2 - 12, y + 36, 24, 2, '#ff4020');
    rect(g, x + 32, y + 42, 28, 1, '#ff4020');
    rect(g, x + w - 60, y + 42, 28, 1, '#ff4020');
    g.globalAlpha = 1;
  }
  // Rivets
  g.fillStyle = '#c0c6ce';
  for (let i = 0; i < 8; i++) {
    rect(g, x + 20 + i * 16, y + 12, 2, 2, '#d0d6de');
    rect(g, x + 24 + i * 16, y + h - 22, 2, 2, '#b8c0c8');
  }
  // Vents
  for (let i = 0; i < 4; i++) {
    rect(g, x + 30 + i * 28, y + 8, 10, 3, '#14181c');
    if (boss.phase >= 3 || boss.dying) rect(g, x + 32 + i * 28, y + 9, 6, 1, '#ff6a20');
  }
  // Turrets
  for (const t of boss.turrets) {
    const tx = (boss.x + t.lx - camX) | 0;
    const ty = (boss.y + t.ly - camY) | 0;
    if (t.wreck || !t.alive) {
      rect(g, tx - 8, ty - 6, 16, 10, '#2a2422');
      rect(g, tx - 3, ty - 2, 6, 4, '#ff6a18');
      continue;
    }
    const flash = t.flash > 0;
    rect(g, tx - t.r, ty - t.r + 2, t.r * 2, t.r * 2 - 2, flash ? '#f0f4f8' : '#2c3238');
    rect(g, tx - t.r + 2, ty - t.r + 4, t.r * 2 - 4, t.r * 2 - 6, flash ? '#fff' : '#59636e');
    if (t.id === 'cannon') rect(g, tx - 2, ty, 4, 14, '#1a1c20');
    else if (t.id === 'mortar') {
      rect(g, tx - 3, ty - 2, 6, 12, '#242018');
      rect(g, tx - 5, ty + 6, 10, 4, '#3a3428');
    } else rect(g, tx - 1, ty, 3, 12, '#141618');
    // Tiny HP pip
    const frac = clamp(t.hp / t.max, 0, 1);
    rect(g, tx - 6, ty - t.r - 3, 12, 2, '#1a1008');
    rect(g, tx - 6, ty - t.r - 3, Math.max(1, (12 * frac) | 0), 2, frac < 0.4 ? '#e05030' : '#d4b060');
  }
  if (boss.hatch > 0) {
    g.globalAlpha = 0.35 + Math.sin(boss.t * 24) * 0.25;
    rect(g, x + w / 2 - 10, y + h - 18, 20, 8, '#ffd060');
    g.globalAlpha = 1;
  }
  if (boss.coreFlash > 0 && boss.phase >= 2) {
    g.globalAlpha = 0.45;
    rect(g, x + w / 2 - 16, y + 20, 32, 24, '#fff');
    g.globalAlpha = 1;
  }
}

export function drawBossFx(g, boss, camX, camY, viewW) {
  if (!boss) return;
  for (const w of boss.warns) {
    const u = 1 - w.t / (w.max || 1);
    const R = (w.r || 34) * Math.max(0.2, u);
    const x = w.x - camX;
    const y = w.y - camY;
    g.strokeStyle = '#ff3030';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, w.r || 34, 0, Math.PI * 2); // exact blast area from the first frame
    g.stroke();
    g.fillStyle = 'rgba(255,40,30,' + (0.12 + u * 0.18) + ')';
    g.beginPath();
    g.arc(x, y, Math.max(3, R), 0, Math.PI * 2);
    g.fill();
  }
  if (boss.attack === 'telegraph' && boss.pending === 'laser') {
    drawLaser(g, boss, camX, camY, viewW, 0.45);
  } else if (boss.attack === 'laser') {
    drawLaser(g, boss, camX, camY, viewW, 1);
  }
  if ((boss.attack === 'telegraph' && boss.pending === 'shock') || boss.attack === 'shock') {
    drawShock(g, boss, camX, camY, boss.attack === 'shock');
  }
  if (boss.attack === 'telegraph' && boss.pending === 'deploy') {
    const x = boss.x - camX;
    const y = boss.y + boss.h - 6 - camY;
    g.strokeStyle = '#ffd060';
    g.lineWidth = 2;
    g.strokeRect(x - 14, y - 8, 28, 14);
  }
}

function drawLaser(g, boss, camX, camY, viewW, power) {
  const y = boss.laserY - camY;
  const gap0 = boss.laserGapX - boss.laserGapW / 2 - camX;
  const gap1 = boss.laserGapX + boss.laserGapW / 2 - camX;
  const h = power > 0.8 ? 10 : 4;
  g.fillStyle = power > 0.8 ? 'rgba(255,80,40,0.9)' : 'rgba(255,70,50,0.55)';
  if (gap0 > 0) g.fillRect(0, y - h / 2, Math.max(0, gap0), h);
  if (gap1 < viewW) g.fillRect(gap1, y - h / 2, Math.max(0, viewW - gap1), h);
  // Safe gap marker
  g.fillStyle = 'rgba(180,255,160,0.35)';
  g.fillRect(gap0, y - h / 2 - 2, gap1 - gap0, h + 4);
  if (power > 0.8) {
    g.fillStyle = '#fff6d0';
    if (gap0 > 0) g.fillRect(0, y - 1, Math.max(0, gap0), 2);
    if (gap1 < viewW) g.fillRect(gap1, y - 1, Math.max(0, viewW - gap1), 2);
  }
}

function drawShock(g, boss, camX, camY, firing) {
  const x = boss.shockX - camX;
  const y = boss.shockY - camY;
  const R = firing ? boss.shockR : 78;
  g.strokeStyle = firing ? 'rgba(255,220,160,0.95)' : 'rgba(255,60,40,0.75)';
  g.lineWidth = firing ? 8 : 3;
  g.beginPath();
  // Danger arc, leaving the safe wedge undrawn
  const a0 = boss.shockGap + boss.shockGapW / 2;
  const a1 = boss.shockGap - boss.shockGapW / 2 + Math.PI * 2;
  g.arc(x, y, R, a0, a1);
  g.stroke();
  g.strokeStyle = 'rgba(160,255,140,0.85)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(x, y, Math.max(20, R), boss.shockGap - boss.shockGapW / 2, boss.shockGap + boss.shockGapW / 2);
  g.stroke();
  if (!firing) {
    g.fillStyle = 'rgba(255,50,30,0.08)';
    g.beginPath();
    g.arc(x, y, 78, a0, a1);
    g.lineTo(x, y);
    g.fill();
  }
}

export function drawBossBar(g, boss, viewW) {
  if (!boss || boss.dead) return;
  const pad = 6;
  const y = 3;
  g.fillStyle = 'rgba(12,10,8,0.82)';
  g.fillRect(pad, y, viewW - pad * 2, 16);
  g.fillStyle = '#f0e6d0';
  g.font = 'bold 8px Tahoma, sans-serif';
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.fillText('BULWARK', pad + 3, y + 1);
  const phaseName = boss.dying ? 'FALLING' : boss.phase <= 1 ? 'TURRETS' : boss.phase === 2 ? 'UNLEASHED' : 'DESPERATE';
  g.textAlign = 'right';
  g.fillStyle = '#e0b060';
  g.fillText(phaseName, viewW - pad - 3, y + 1);
  const bx = pad + 3;
  const by = y + 10;
  const bw = viewW - pad * 2 - 6;
  g.fillStyle = '#1a100c';
  g.fillRect(bx, by, bw, 4);
  const frac = boss.maxHp > 0 ? clamp(boss.hp / boss.maxHp, 0, 1) : 0;
  g.fillStyle = boss.phase >= 3 ? '#e04828' : '#d4b060';
  g.fillRect(bx, by, Math.max(0, bw * frac), 4);
  // Segment ticks at turret boundaries (4 turrets share the front portion of the bar)
  const turretShare = boss.maxHp > 0 ? (boss.maxHp - boss.coreMax) / boss.maxHp : 0.4;
  g.fillStyle = '#1a100c';
  for (let i = 1; i < 4; i++) {
    const tx = bx + bw * turretShare * (i / 4);
    g.fillRect(tx, by, 1, 4);
  }
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
}
