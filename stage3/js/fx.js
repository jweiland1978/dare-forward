/** Particles, explosions, shake, flash, decals. */
import { PARTICLE_CAP, REDUCED_MOTION, clamp } from './config.js?v=1';

const parts = [];
const decals = [];
const floaters = [];
const fires = [];
let shakeAmp = 0;
let shakeT = 0;
let flash = 0;
let ringId = 0;

export function resetFx() {
  parts.length = 0;
  decals.length = 0;
  floaters.length = 0;
  fires.length = 0;
  shakeAmp = 0;
  shakeT = 0;
  flash = 0;
}

function addPart(p) {
  if (parts.length >= PARTICLE_CAP) {
    let i = 0;
    let life = parts[0].life;
    for (let k = 1; k < parts.length; k++) {
      if (parts[k].life < life) {
        life = parts[k].life;
        i = k;
      }
    }
    parts[i] = p;
  } else parts.push(p);
}

export function spawnParticle(p) {
  addPart(p);
}

export function floatingText(x, y, text, color) {
  floaters.push({ x, y, text, color: color || '#fff4c0', life: 1.1, t: 0 });
}

export function addDecal(x, y, r, color, a) {
  decals.push({ x, y, r, color: color || '#3a2a18', a: a == null ? 0.45 : a });
  if (decals.length > 110) decals.shift();
}

export function addFire(x, y, life, radius) {
  if (fires.length >= 28) {
    let i = 0;
    for (let k = 1; k < fires.length; k++) if (fires[k].life < fires[i].life) i = k;
    fires.splice(i, 1);
  }
  fires.push({
    x,
    y,
    r: radius || 13,
    life: life || 3.2,
    max: life || 3.2,
    t: Math.random() * 5,
    acc: Math.random() * 0.2,
  });
}

export function fireCount() {
  return fires.length;
}

export function updateFires(dt, onTick) {
  for (let i = fires.length - 1; i >= 0; i--) {
    const f = fires[i];
    f.life -= dt;
    f.t += dt;
    if (f.life <= 0) {
      fires.splice(i, 1);
      continue;
    }
    f.acc += dt;
    if (f.acc >= 0.4) {
      f.acc = 0;
      if (onTick) onTick(f);
    }
    if (!REDUCED_MOTION && Math.random() < dt * 1.6) {
      addPart({
        kind: 'smoke',
        x: f.x + (Math.random() - 0.5) * f.r,
        y: f.y,
        vx: (Math.random() - 0.5) * 8,
        vy: -16 - Math.random() * 18,
        life: 0.55,
        max: 0.55,
        color: '#6a645c',
        r: 3 + Math.random() * 3,
        add: false,
      });
    }
  }
}

export function shake(amt) {
  const s = REDUCED_MOTION ? amt * 0.12 : amt;
  shakeAmp = Math.max(shakeAmp, s);
  shakeT = Math.max(shakeT, 0.18 + s * 0.02);
}

export function addFlash(amt) {
  flash = Math.min(1, flash + (REDUCED_MOTION ? amt * 0.15 : amt));
}

export function getShake() {
  if (shakeT <= 0 || shakeAmp <= 0) return { x: 0, y: 0, amp: 0 };
  const m = shakeT > 0.1 ? 1 : shakeT / 0.1;
  return {
    x: (Math.random() * 2 - 1) * shakeAmp * m,
    y: (Math.random() * 2 - 1) * shakeAmp * m,
    amp: shakeAmp * m,
  };
}

export function getFlash() {
  return flash;
}

export function particleCount() {
  return parts.length;
}

export function shakeAmount() {
  return shakeAmp;
}

export function explode(x, y, size, opts) {
  const s = size || 1;
  const big = s >= 1.1;
  shake(5 * s);
  if (big) addFlash(0.45 * s);
  else addFlash(0.12 * s);
  addDecal(x, y, 9 + 9 * s, '#2a1c10', 0.32);

  addPart({
    kind: 'ring',
    x,
    y,
    r: 4,
    vr: 90 * s,
    life: 0.38,
    max: 0.38,
    color: '#fff2c0',
    a: 0.9,
    add: true,
    id: ++ringId,
  });

  const sparks = (20 * s) | 0;
  for (let i = 0; i < sparks; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 140 * s;
    addPart({
      kind: 'spark',
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.25 + Math.random() * 0.25,
      max: 0.5,
      color: Math.random() < 0.5 ? '#ffe680' : '#ff9020',
      r: 1.2 + Math.random(),
      add: true,
    });
  }
  const fire = (16 * s) | 0;
  for (let i = 0; i < fire; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 10 + Math.random() * 50 * s;
    addPart({
      kind: 'fire',
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 20,
      life: 0.45 + Math.random() * 0.4,
      max: 0.85,
      color: i % 3 === 0 ? '#fff4c0' : i % 2 ? '#ff7a18' : '#ffd24a',
      r: 4 + Math.random() * 6 * s,
      add: true,
    });
  }
  const smoke = (8 * s) | 0;
  for (let i = 0; i < smoke; i++) {
    const a = Math.random() * Math.PI * 2;
    addPart({
      kind: 'smoke',
      x: x + Math.cos(a) * 4,
      y: y + Math.sin(a) * 4,
      vx: Math.cos(a) * 12,
      vy: -18 - Math.random() * 28,
      life: 0.6 + Math.random() * 0.5,
      max: 1.1,
      color: '#5a5348',
      r: 5 + Math.random() * 7,
      add: false,
    });
  }
  const debris = Math.min(18, (8 + 7 * s) | 0);
  const col = opts && opts.debris ? opts.debris : '#6a4a28';
  for (let i = 0; i < debris; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 110 * s;
    addPart({
      kind: 'debris',
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 30,
      life: 0.55 + Math.random() * 0.45,
      max: 1,
      color: col,
      r: 1.6 + Math.random() * 2.4,
      rot: Math.random() * 6,
      vr: (Math.random() * 2 - 1) * 10,
      gy: y + 6 + Math.random() * 16,
      bounces: 0,
      add: false,
    });
  }
  if (s >= 1.05 && !(opts && opts.noFire)) {
    addFire(x, y, 3.1 + s, 14 + 3 * s);
    addFire(x + 11, y + 5, 2.5, 11);
    if (s >= 1.3) addFire(x - 9, y - 6, 2.3, 10);
  }
}

export function burstDebris(x, y, color, n) {
  const count = n || 8;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 30 + Math.random() * 80;
    addPart({
      kind: 'debris',
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 20,
      life: 0.45 + Math.random() * 0.3,
      max: 0.75,
      color: color || '#8a7350',
      r: 1.4 + Math.random() * 2,
      rot: Math.random() * 6,
      vr: (Math.random() * 2 - 1) * 8,
      gy: y + 4 + Math.random() * 12,
      bounces: 0,
      add: false,
    });
  }
  addDecal(x, y, 5, color || '#5a4030', 0.4);
}

export function muzzleFlash(x, y, dx, dy) {
  addPart({
    kind: 'muzzle',
    x: x + dx * 6,
    y: y + dy * 6,
    vx: 0,
    vy: 0,
    life: 0.05,
    max: 0.05,
    color: '#fff2a0',
    r: 4,
    add: true,
  });
}

export function hitSparks(x, y) {
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 80;
    addPart({
      kind: 'spark',
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.18,
      max: 0.18,
      color: '#ffe8a0',
      r: 1,
      add: true,
    });
  }
}

export function deathPuff(x, y, color) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    addPart({
      kind: 'puff',
      x,
      y,
      vx: Math.cos(a) * 30,
      vy: Math.sin(a) * 30 - 10,
      life: 0.35,
      max: 0.35,
      color: color || '#7a8a70',
      r: 3 + Math.random() * 3,
      add: false,
    });
  }
}

export function casing(x, y, facingX) {
  addPart({
    kind: 'casing',
    x,
    y,
    vx: -facingX * 30 + (Math.random() * 20 - 10),
    vy: -40 - Math.random() * 20,
    life: 0.4,
    max: 0.4,
    color: '#d4b44a',
    r: 1.2,
    add: false,
  });
}

export function smokeTrail(x, y) {
  addPart({
    kind: 'smoke',
    x,
    y,
    vx: (Math.random() - 0.5) * 8,
    vy: (Math.random() - 0.5) * 8,
    life: 0.35,
    max: 0.35,
    color: '#8a8074',
    r: 3,
    add: false,
  });
}

export function updateFx(dt) {
  shakeT -= dt;
  if (shakeT <= 0) {
    shakeT = 0;
    shakeAmp = 0;
  } else {
    shakeAmp *= 0.9;
  }
  flash = Math.max(0, flash - dt * 3.2);

  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) {
      parts.splice(i, 1);
      continue;
    }
    if (p.kind === 'ring') {
      p.r += p.vr * dt;
      continue;
    }
    p.x += (p.vx || 0) * dt;
    p.y += (p.vy || 0) * dt;
    if (p.kind === 'debris' || p.kind === 'casing') {
      p.vy += (p.kind === 'debris' ? 260 : 180) * dt;
      p.rot = (p.rot || 0) + (p.vr || 0) * dt;
      if (p.kind === 'debris' && p.bounces < 2 && p.vy > 0 && p.y >= (p.gy || p.y + 1)) {
        p.y = p.gy;
        p.vy *= -0.46;
        p.vx *= 0.62;
        p.bounces++;
        if (p.bounces === 1) addDecal(p.x, p.y, 1.6 + Math.random() * 1.8, p.color, 0.5);
      }
    }
    if (p.kind === 'smoke' || p.kind === 'puff') {
      p.r += 10 * dt;
      p.vy -= 8 * dt;
    }
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.t += dt;
    f.y -= 22 * dt;
    if (f.t > f.life) floaters.splice(i, 1);
  }
}

export function drawDecals(g, camX, camY) {
  for (const d of decals) {
    g.globalAlpha = d.a;
    g.fillStyle = d.color;
    g.beginPath();
    g.ellipse(d.x - camX, d.y - camY, d.r * 1.2, d.r * 0.7, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

export function drawFires(g, camX, camY) {
  for (const f of fires) {
    const x = f.x - camX;
    const y = f.y - camY;
    const flick = REDUCED_MOTION ? 1 : 0.75 + Math.sin(f.t * 18) * 0.25;
    const a = Math.min(1, f.life / 0.4) * 0.9;
    g.globalAlpha = 0.35 * a;
    g.fillStyle = '#2a1408';
    g.beginPath();
    g.ellipse(x, y + 2, f.r * 0.9, f.r * 0.45, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = a * flick;
    g.fillStyle = '#e03810';
    g.fillRect(x - f.r * 0.45, y - f.r * 0.2, f.r * 0.9, f.r * 0.55);
    g.fillStyle = '#ffb030';
    g.fillRect(x - f.r * 0.28, y - f.r * 0.55 * flick, f.r * 0.5, f.r * 0.5);
    g.fillStyle = '#fff0a0';
    g.fillRect(x - 2, y - f.r * 0.75 * flick, 4, 5);
  }
  g.globalAlpha = 1;
}

export function drawParticles(g, camX, camY) {
  for (const p of parts) {
    const a = clamp(p.life / (p.max || 0.3), 0, 1);
    g.globalAlpha = a * (p.a || 1);
    if (p.add) g.globalCompositeOperation = 'lighter';
    else g.globalCompositeOperation = 'source-over';
    const y = p.y - camY;
    const px = p.x - camX;
    if (p.kind === 'ring') {
      g.strokeStyle = p.color;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(px, y, p.r, 0, Math.PI * 2);
      g.stroke();
    } else if (p.kind === 'muzzle') {
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(px, y, p.r, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = p.color;
      g.fillRect(px - p.r * 0.5, y - p.r * 0.5, Math.max(1, p.r), Math.max(1, p.r));
    }
  }
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
}

export function drawFloaters(g, camX, camY) {
  g.font = 'bold 8px Tahoma, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const f of floaters) {
    const a = 1 - f.t / f.life;
    g.globalAlpha = a;
    g.fillStyle = f.color;
    g.fillText(f.text, f.x - camX, f.y - camY);
  }
  g.globalAlpha = 1;
}
