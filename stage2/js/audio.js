/** Web Audio synth — no samples, iOS-resume on first gesture. */
import { STORAGE_VOL, STORAGE_MUSIC } from './config.js?v=2';

let ctx = null;
let master = null;
let sfxGain = null;
let musicGain = null;
let started = false;
let musicOn = true;
const liveVoices = new Set(); // every started source, for the safety cap
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
  if (musicOn && volIndex > 0 && !musicPlaying) startMusic();
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
  trackVoice(o, null, t, null);
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
  trackVoice(s, null, t, null);
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
      case 'extract': {
        chime(t, [659, 784, 988, 1318], 0.07, 0.2);
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

/* ---------------------------------------------------------------------------
 * Music + drone: short, self-stopping notes scheduled against the AudioContext
 * clock with a small lookahead. No oscillator ever plays longer than one note,
 * so nothing can "hang" if timers are throttled or the tab/phone pauses.
 * ------------------------------------------------------------------------- */
const MUSIC_STEP = 0.14; // seconds per lead step (bass changes every 2 steps)
const LOOKAHEAD = 0.25; // schedule this far ahead of ctx.currentTime
const VOICE_CAP = 3.0; // safety: kill any source older than this (seconds)
const BASS = [98, 98, 110, 98, 87, 87, 98, 110];
const LEAD = [196, 0, 233, 196, 174, 0, 196, 233, 262, 0, 233, 196];
let musicPlaying = false;
let droneOn = false;
let nextMusicT = 0;
let musicStep = 0;
let nextDroneT = 0;
let schedId = null;
const musicVoices = new Set();

function trackVoice(src, gainNode, t, set) {
  const v = { src, g: gainNode, t0: t };
  liveVoices.add(v);
  if (set) set.add(v);
  src.onended = () => {
    liveVoices.delete(v);
    if (set) set.delete(v);
    try {
      src.disconnect();
      if (gainNode) gainNode.disconnect();
    } catch {
      /* ignore */
    }
  };
  return v;
}

function killVoice(v, now) {
  try {
    if (v.g) {
      v.g.gain.cancelScheduledValues(now);
      v.g.gain.setValueAtTime(0.0001, now);
    }
    v.src.stop(now + 0.02);
  } catch {
    /* already stopped */
  }
  liveVoices.delete(v);
}

/** One enveloped note that always stops on its own. */
function note(type, f, t, dur, peak, dest, filterHz, set) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + Math.min(0.012, dur * 0.25));
  g.gain.setValueAtTime(peak, t + dur * 0.7);
  g.gain.linearRampToValueAtTime(0, t + dur);
  if (filterHz) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = filterHz;
    o.connect(lp);
    lp.connect(g);
  } else o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
  trackVoice(o, g, t, set);
}

function scheduleMusicStep(t, i) {
  const lf = LEAD[i % LEAD.length];
  if (lf) note('square', lf, t, MUSIC_STEP * 0.85, 0.035, musicGain, 1200, musicVoices);
  if (i % 2 === 0) note('triangle', BASS[(i / 2) % BASS.length], t, MUSIC_STEP * 1.9, 0.07, musicGain, 0, musicVoices);
}

function scheduleDroneSeg(t) {
  // overlapping 1.2 s segments with soft edges = continuous engine rumble
  const seg = 1.2;
  note('sine', 42, t, seg, 0.07, sfxGain, 0, null);
  note('triangle', 28, t, seg, 0.07, sfxGain, 140, null);
}

function audioTick() {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  // safety cap: nothing may ring longer than a few seconds
  for (const v of liveVoices) if (now - v.t0 > VOICE_CAP) killVoice(v, now);
  if (musicPlaying) {
    if (nextMusicT < now) nextMusicT = now + 0.03; // fell behind (throttled): skip, never burst
    while (nextMusicT < now + LOOKAHEAD) {
      scheduleMusicStep(nextMusicT, musicStep);
      nextMusicT += MUSIC_STEP;
      musicStep = (musicStep + 1) % 96;
    }
  }
  if (droneOn) {
    if (nextDroneT < now) nextDroneT = now + 0.03;
    while (nextDroneT < now + LOOKAHEAD) {
      scheduleDroneSeg(nextDroneT);
      nextDroneT += 0.9;
    }
  }
}

function ensureScheduler() {
  if (schedId == null) schedId = setInterval(audioTick, 50);
}

/** Low engine rumble while the war machine is alive. */
export function setBossDrone(on) {
  on = !!on && volIndex > 0;
  if (on === droneOn) return;
  droneOn = on;
  if (on) {
    try {
      ac();
      nextDroneT = 0;
      ensureScheduler();
      audioTick();
    } catch {
      /* ignore */
    }
  }
}

function stopMusic() {
  musicPlaying = false;
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const v of musicVoices) killVoice(v, now);
  musicVoices.clear();
}

function startMusic() {
  ac();
  stopMusic();
  if (!musicOn || volIndex === 0) return;
  musicPlaying = true;
  musicStep = 0;
  nextMusicT = 0;
  ensureScheduler();
  audioTick();
}

let gestureHooked = false;
export function hookFirstGesture() {
  if (gestureHooked) return;
  gestureHooked = true;
  // First gesture unlocks audio; later gestures re-wake it if iOS suspended/interrupted it.
  const wake = () => {
    if (document.hidden) return;
    if (!started) resume();
    else if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
  };
  window.addEventListener('pointerdown', wake, true);
  window.addEventListener('keydown', wake, true);
  window.addEventListener('touchstart', wake, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) {
      ctx.suspend().catch(() => {});
    } else if (started) {
      ctx.resume().catch(() => {});
    }
  });
}
