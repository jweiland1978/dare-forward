/** Web Audio synth — no samples, iOS-resume on first gesture. */
import { STORAGE_VOL, STORAGE_MUSIC } from './config.js?v=1';

let ctx = null;
let master = null;
let sfxGain = null;
let musicGain = null;
let started = false;
let musicOn = true;
let musicNodes = [];
let noiseBuf = null;

const VOLS = [0, 0.28, 0.55, 1];
let volIndex = 2;

try {
  const v = localStorage.getItem(STORAGE_VOL);
  if (v != null) volIndex = Math.max(0, Math.min(3, parseInt(v, 10) || 0));
  const m = localStorage.getItem(STORAGE_MUSIC);
  if (m != null) musicOn = m !== '0';
} catch {
  /* ignore */
}

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    sfxGain = ctx.createGain();
    musicGain = ctx.createGain();
    sfxGain.connect(master);
    musicGain.connect(master);
    master.connect(ctx.destination);
    applyVol();
  }
  return ctx;
}

function applyVol() {
  if (!master) return;
  master.gain.value = VOLS[volIndex];
  if (musicGain) musicGain.gain.value = musicOn && volIndex > 0 ? 0.22 : 0;
}

export function volumeIndex() {
  return volIndex;
}

export function isMuted() {
  return volIndex === 0;
}

export function isMusicOn() {
  return musicOn && volIndex > 0;
}

export function cycleVolume() {
  volIndex = (volIndex + 1) % 4;
  try {
    localStorage.setItem(STORAGE_VOL, String(volIndex));
  } catch {
    /* ignore */
  }
  applyVol();
  resume();
  return volIndex;
}

export function setMusic(on) {
  musicOn = !!on;
  try {
    localStorage.setItem(STORAGE_MUSIC, musicOn ? '1' : '0');
  } catch {
    /* ignore */
  }
  applyVol();
  if (musicOn) startMusic();
  else stopMusic();
}

export function toggleMusic() {
  setMusic(!musicOn);
  return musicOn;
}

export function resume() {
  ac();
  if (ctx.state === 'suspended') ctx.resume();
  if (!started) {
    started = true;
    startMusic();
  }
}

function envGain(t, a, h, d, peak) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(peak * 0.8, t + a + h);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + h + d);
  return g;
}

function osc(type, freq, t) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  return o;
}

function getNoise() {
  if (noiseBuf) return noiseBuf;
  const n = ctx.sampleRate * 0.6;
  noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function noiseSrc(t) {
  const s = ctx.createBufferSource();
  s.buffer = getNoise();
  s.loop = true;
  s.start(t);
  return s;
}

function fireSfx(name) {
  if (!ctx || volIndex === 0) return;
  const t = ctx.currentTime;
  try {
    switch (name) {
      case 'rifle': {
        const n = noiseSrc(t);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1800;
        bp.Q.value = 0.8;
        const g = envGain(t, 0.001, 0.01, 0.07, 0.55);
        n.connect(bp);
        bp.connect(g);
        g.connect(sfxGain);
        n.stop(t + 0.1);
        const o = osc('square', 420, t);
        o.frequency.exponentialRampToValueAtTime(140, t + 0.06);
        const g2 = envGain(t, 0.001, 0.005, 0.05, 0.12);
        o.connect(g2);
        g2.connect(sfxGain);
        o.start(t);
        o.stop(t + 0.08);
        break;
      }
      case 'mg': {
        const n = noiseSrc(t);
        const bp = ctx.createBiquadFilter();
        bp.type = 'highpass';
        bp.frequency.value = 900;
        const g = envGain(t, 0.001, 0.005, 0.04, 0.35);
        n.connect(bp);
        bp.connect(g);
        g.connect(sfxGain);
        n.stop(t + 0.06);
        break;
      }
      case 'spread': {
        const n = noiseSrc(t);
        const bp = ctx.createBiquadFilter();
        bp.type = 'lowpass';
        bp.frequency.value = 2400;
        const g = envGain(t, 0.002, 0.02, 0.1, 0.5);
        n.connect(bp);
        bp.connect(g);
        g.connect(sfxGain);
        n.stop(t + 0.14);
        break;
      }
      case 'rocket': {
        const n = noiseSrc(t);
        const bp = ctx.createBiquadFilter();
        bp.type = 'lowpass';
        bp.frequency.setValueAtTime(800, t);
        bp.frequency.exponentialRampToValueAtTime(220, t + 0.35);
        const g = envGain(t, 0.02, 0.1, 0.3, 0.4);
        n.connect(bp);
        bp.connect(g);
        g.connect(sfxGain);
        n.stop(t + 0.45);
        break;
      }
      case 'flame': {
        const n = noiseSrc(t);
        const bp = ctx.createBiquadFilter();
        bp.type = 'lowpass';
        bp.frequency.value = 500;
        const g = envGain(t, 0.01, 0.02, 0.08, 0.22);
        n.connect(bp);
        bp.connect(g);
        g.connect(sfxGain);
        n.stop(t + 0.12);
        break;
      }
      case 'throw': {
        const o = osc('triangle', 520, t);
        o.frequency.exponentialRampToValueAtTime(180, t + 0.18);
        const g = envGain(t, 0.01, 0.04, 0.14, 0.18);
        o.connect(g);
        g.connect(sfxGain);
        o.start(t);
        o.stop(t + 0.22);
        break;
      }
      case 'boom':
      case 'explode': {
        boom(t, 0.9);
        break;
      }
      case 'barrel': {
        boom(t, 1.25);
        break;
      }
      case 'pickup': {
        chime(t, [660, 880, 1180], 0.08, 0.18);
        break;
      }
      case 'hurt':
      case 'death': {
        const o = osc('sawtooth', 180, t);
        o.frequency.exponentialRampToValueAtTime(70, t + 0.28);
        const g = envGain(t, 0.005, 0.05, 0.25, 0.35);
        o.connect(g);
        g.connect(sfxGain);
        o.start(t);
        o.stop(t + 0.32);
        const n = noiseSrc(t);
        const g2 = envGain(t, 0.001, 0.02, 0.15, 0.3);
        n.connect(g2);
        g2.connect(sfxGain);
        n.stop(t + 0.2);
        break;
      }
      case 'rescue': {
        chime(t, [523, 659, 784, 1046], 0.09, 0.16);
        break;
      }
      case 'fanfare': {
        chime(t, [392, 523, 659, 784, 1046], 0.12, 0.2);
        break;
      }
      case 'blip': {
        const o = osc('square', 880, t);
        const g = envGain(t, 0.001, 0.01, 0.05, 0.08);
        o.connect(g);
        g.connect(sfxGain);
        o.start(t);
        o.stop(t + 0.07);
        break;
      }
      case 'sniper': {
        const o = osc('square', 1400, t);
        o.frequency.exponentialRampToValueAtTime(400, t + 0.08);
        const g = envGain(t, 0.001, 0.01, 0.1, 0.22);
        o.connect(g);
        g.connect(sfxGain);
        o.start(t);
        o.stop(t + 0.12);
        break;
      }
      case 'ui': {
        const o = osc('square', 440, t);
        const g = envGain(t, 0.001, 0.01, 0.04, 0.08);
        o.connect(g);
        g.connect(sfxGain);
        o.start(t);
        o.stop(t + 0.06);
        break;
      }
      default:
        break;
    }
  } catch {
    /* ignore */
  }
}

function boom(t, scale) {
  const n = noiseSrc(t);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(900 * scale, t);
  lp.frequency.exponentialRampToValueAtTime(80, t + 0.45 * scale);
  const g = envGain(t, 0.004, 0.04, 0.4 * scale, 0.7 * scale);
  n.connect(lp);
  lp.connect(g);
  g.connect(sfxGain);
  n.stop(t + 0.5 * scale);
  const o = osc('sine', 140 * scale, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.4 * scale);
  const g2 = envGain(t, 0.005, 0.05, 0.35 * scale, 0.55 * scale);
  o.connect(g2);
  g2.connect(sfxGain);
  o.start(t);
  o.stop(t + 0.45 * scale);
}

function chime(t, notes, step, peak) {
  notes.forEach((f, i) => {
    const o = osc('square', f, t);
    const g = envGain(t + i * step, 0.005, 0.04, 0.16, peak);
    o.connect(g);
    g.connect(sfxGain);
    o.start(t + i * step);
    o.stop(t + i * step + 0.22);
  });
}

export function sfx(name) {
  ac();
  fireSfx(name);
}

function stopMusic() {
  for (const n of musicNodes) {
    try {
      n.stop();
    } catch {
      /* ignore */
    }
  }
  musicNodes = [];
}

function startMusic() {
  ac();
  stopMusic();
  if (!musicOn || volIndex === 0) return;
  const t0 = ctx.currentTime + 0.05;
  const tempo = 0.28;
  const bass = [98, 98, 110, 98, 87, 87, 98, 110];
  const lead = [196, 0, 233, 196, 174, 0, 196, 233, 262, 0, 233, 196];

  const dur = 32;
  const o1 = osc('triangle', bass[0], t0);
  const g1 = ctx.createGain();
  g1.gain.value = 0.07;
  o1.connect(g1);
  g1.connect(musicGain);
  o1.start(t0);
  o1.stop(t0 + dur);
  for (let i = 0; i < 64; i++) {
    const f = bass[i % bass.length];
    o1.frequency.setValueAtTime(f, t0 + i * tempo);
  }

  const o2 = osc('square', 196, t0);
  const g2 = ctx.createGain();
  g2.gain.value = 0.03;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1200;
  o2.connect(lp);
  lp.connect(g2);
  g2.connect(musicGain);
  o2.start(t0);
  o2.stop(t0 + dur);
  for (let i = 0; i < 80; i++) {
    const f = lead[i % lead.length];
    const tm = t0 + i * tempo * 0.5;
    o2.frequency.setValueAtTime(Math.max(f, 80), tm);
    g2.gain.setValueAtTime(f ? 0.035 : 0.0001, tm);
  }

  musicNodes = [o1, o2];
  // loop by restarting
  const id = setTimeout(() => {
    if (musicOn && volIndex > 0) startMusic();
  }, dur * 1000 - 200);
  musicNodes.push({ stop() { clearTimeout(id); } });
}

export function hookFirstGesture() {
  const once = () => {
    resume();
    window.removeEventListener('pointerdown', once, true);
    window.removeEventListener('keydown', once, true);
    window.removeEventListener('touchstart', once, true);
  };
  window.addEventListener('pointerdown', once, true);
  window.addEventListener('keydown', once, true);
  window.addEventListener('touchstart', once, { capture: true, passive: true });
}
