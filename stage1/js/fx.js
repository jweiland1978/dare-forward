/** Particles, explosions, shake, flash, decals. */
import { PARTICLE_CAP, REDUCED_MOTION, clamp } from './config.js?v=1';

const parts = [];
const decals = [];
const floaters = [];
let shakeAmp = 0;
let shakeT = 0;
let flash = 0;
let ringId = 0;

export function resetFx() {
  parts.length = 0;
  decals.length = 0;
  floaters.length = 0;
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
  if (decals.length > 80) decals.shift();
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
  const debris = (6 * s) | 0;
  for (let i = 0; i < debris; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 50 + Math.random() * 90 * s;
    addPart({
      kind: 'debris',
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 40,
      life: 0.4 + Math.random() * 0.3,
      max: 0.7,
      color: opts && opts.debris ? opts.debris : '#6a4a28',
      r: 1.5 + Math.random() * 2,
      rot: Math.random() * 6,
      vr: (Math.random() * 2 - 1) * 8,
      add: false,
    });
  }
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
      p.vy += 180 * dt;
      p.rot = (p.rot || 0) + (p.vr || 0) * dt;
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

export function drawDecals(g, camY) {
  for (const d of decals) {
    g.globalAlpha = d.a;
    g.fillStyle = d.color;
    g.beginPath();
    g.ellipse(d.x, d.y - camY, d.r * 1.2, d.r * 0.7, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

export function drawParticles(g, camY) {
  for (const p of parts) {
    const a = clamp(p.life / (p.max || 0.3), 0, 1);
    g.globalAlpha = a * (p.a || 1);
    if (p.add) g.globalCompositeOperation = 'lighter';
    else g.globalCompositeOperation = 'source-over';
    const y = p.y - camY;
    if (p.kind === 'ring') {
      g.strokeStyle = p.color;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(p.x, y, p.r, 0, Math.PI * 2);
      g.stroke();
    } else if (p.kind === 'muzzle') {
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(p.x, y, p.r, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = p.color;
      g.fillRect(p.x - p.r * 0.5, y - p.r * 0.5, Math.max(1, p.r), Math.max(1, p.r));
    }
  }
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
}

export function drawFloaters(g, camY) {
  g.font = 'bold 8px Tahoma, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const f of floaters) {
    const a = 1 - f.t / f.life;
    g.globalAlpha = a;
    g.fillStyle = f.color;
    g.fillText(f.text, f.x, f.y - camY);
  }
  g.globalAlpha = 1;
}
