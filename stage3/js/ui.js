/** HUD and overlay screens. */
import { GAME_TITLE, rankFor, REDUCED_MOTION } from './config.js?v=1';
import { isMuted, volumeIndex, isMusicOn } from './audio.js?v=1';

export function setScreen(name) {
  document.body.dataset.screen = name;
  document.body.classList.toggle('playing', name === 'play');
  const ids = ['title', 'pause', 'secured', 'gameover', 'complete', 'howto', 'victory', 'credits'];
  for (const id of ids) {
    const el = document.getElementById('screen-' + id);
    if (el) el.hidden = true;
  }
  if (name === 'play') return;
  const map = {
    title: 'title',
    paused: 'pause',
    secured: 'secured',
    gameover: 'gameover',
    complete: 'complete',
    howto: 'howto',
    victory: 'victory',
    credits: 'credits',
  };
  const el = document.getElementById('screen-' + map[name]);
  if (el) el.hidden = false;
}

function pad(n) {
  return String(Math.max(0, n | 0)).padStart(6, '0');
}

function hearts(n) {
  const max = Math.max(3, n);
  let s = '';
  for (let i = 0; i < max; i++) s += i < n ? '♥' : '♡';
  return s;
}

export function updateHud(G) {
  const score = document.querySelector('[data-testid="hud-score"]');
  const lives = document.querySelector('[data-testid="hud-lives"]');
  const gren = document.querySelector('[data-testid="hud-grenades"]');
  const weap = document.querySelector('[data-testid="hud-weapon"]');
  const terr = document.querySelector('[data-testid="hud-territory"]');
  const best = document.getElementById('hud-best');
  const rank = document.getElementById('hud-rank');
  const prog = document.getElementById('hud-progress');
  const mute = document.querySelector('[data-testid="mute-btn"]');
  if (score) score.textContent = pad(G.score);
  if (best) best.textContent = 'BEST ' + pad(G.best);
  if (rank) rank.textContent = rankFor(G.score);
  if (lives) lives.textContent = hearts(G.player ? G.player.lives : 3);
  if (gren) gren.textContent = String(G.player ? G.player.grenades : 5);
  if (weap) {
    const p = G.player;
    if (!p) weap.textContent = 'Rifle';
    else if (p.weapon === 'rifle') weap.textContent = 'Rifle';
    else weap.textContent = p.weapon.toUpperCase() + ' ' + (p.ammo === Infinity ? '' : p.ammo);
  }
  if (terr) {
    const name = G.territoryName || 'Oasis Cut';
    terr.textContent = name;
  }
  if (prog) prog.style.width = Math.round((G.progress || 0) * 100) + '%';
  if (mute) {
    const v = volumeIndex();
    mute.textContent = v === 0 ? '🔇' : v === 1 ? '🔈' : v === 2 ? '🔉' : '🔊';
    mute.setAttribute('aria-label', v === 0 ? 'Muted' : 'Volume ' + v);
  }
  const musicBtn = document.getElementById('music-btn');
  if (musicBtn) musicBtn.textContent = isMusicOn() ? 'Music: On' : 'Music: Off';
}

export function fillSecured(stats) {
  const el = document.getElementById('secured-tally');
  if (!el) return;
  el.innerHTML =
    '<div>Score <b>' +
    stats.score +
    '</b></div><div>Kills <b>' +
    stats.kills +
    '</b></div><div>POWs <b>' +
    stats.pows +
    '</b></div><div>Extracted <b>' +
    (stats.extracted == null ? 0 : stats.extracted) +
    '</b></div><div>Accuracy <b>' +
    stats.accuracy +
    '%</b></div>';
}

export function fillGameOver(stats) {
  const el = document.getElementById('gameover-tally');
  if (!el) return;
  el.innerHTML =
    '<div>Score <b>' + stats.score + '</b></div><div>Best <b>' + stats.best + '</b></div>';
}

function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}

export function fillVictory(stats) {
  const rankEl = document.getElementById('victory-rank');
  const tally = document.getElementById('victory-tally');
  const rank = stats.rank || rankFor(stats.score || 0);
  if (rankEl) rankEl.textContent = rank;
  if (!tally) return;
  const diff = stats.difficulty ? stats.difficulty.charAt(0).toUpperCase() + stats.difficulty.slice(1) : 'Normal';
  tally.innerHTML =
    '<div>Score <b>' +
    stats.score +
    '</b></div><div>Best <b>' +
    stats.best +
    '</b></div><div>Time <b>' +
    fmtTime(stats.time) +
    '</b></div><div>Kills <b>' +
    stats.kills +
    '</b></div><div>Accuracy <b>' +
    stats.accuracy +
    '%</b></div><div>Deaths <b>' +
    stats.deaths +
    '</b></div><div>POWs rescued <b>' +
    stats.rescued +
    '</b></div><div>Extracted <b>' +
    stats.extracted +
    '</b></div><div>Difficulty <b>' +
    diff +
    '</b></div>';
}

export function fillComplete(stats) {
  const el = document.getElementById('complete-tally');
  if (!el) return;
  el.innerHTML = '<div>Final score <b>' + stats.score + '</b></div><div>Best <b>' + stats.best + '</b></div>';
}

export function setBestOnTitle(best) {
  const el = document.getElementById('title-best');
  if (el) el.textContent = 'BEST ' + pad(best);
}

const GLYPH = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
};

function stampWord(g, word, x, y, scale, color) {
  g.fillStyle = color;
  let cx = x;
  for (const ch of word) {
    const rows = GLYPH[ch];
    if (!rows) {
      cx += scale * 4;
      continue;
    }
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c] === '1') g.fillRect(cx + c * scale, y + r * scale, scale, scale);
      }
    }
    cx += (rows[0].length + 1) * scale;
  }
  return cx - x;
}

export function drawTitleArt(time) {
  const c = document.getElementById('title-art');
  if (!c || document.body.dataset.screen !== 'title') return;
  const cssW = Math.max(80, Math.round(c.clientWidth) || 320);
  const cssH = Math.max(36, Math.round(c.clientHeight) || 72);
  if (c.width !== cssW || c.height !== cssH) {
    c.width = cssW;
    c.height = cssH;
  }
  const g = c.getContext('2d');
  if (!g) return;
  const t = REDUCED_MOTION ? 0 : time || 0;
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#1a140e';
  g.fillRect(0, 0, cssW, cssH);
  // Sky bands
  g.fillStyle = '#3a2418';
  g.fillRect(0, 0, cssW, cssH * 0.45);
  g.fillStyle = '#5a3420';
  g.fillRect(0, cssH * 0.28, cssW, cssH * 0.2);
  // Parallax ridges
  const hill = (color, speed, base, amp) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, cssH);
    for (let x = 0; x <= cssW; x += 4) {
      const y = base + Math.sin((x + t * speed) * 0.04) * amp;
      g.lineTo(x, y);
    }
    g.lineTo(cssW, cssH);
    g.fill();
  };
  hill('#2a1c14', 10, cssH * 0.62, 6);
  hill('#3a2a1c', 18, cssH * 0.72, 5);
  hill('#1a120c', 28, cssH * 0.82, 3);
  // Marching silhouettes
  const gy = cssH - 8;
  const march = REDUCED_MOTION ? 12 : (t * 22) % 28;
  g.fillStyle = '#0c0806';
  for (let i = -1; i < cssW / 22 + 2; i++) {
    const x = ((i * 22 + march) % (cssW + 30)) - 16;
    const bob = REDUCED_MOTION ? 0 : (i + (t * 6) | 0) % 2;
    g.fillRect(x, gy - 8 - bob, 3, 6);
    g.fillRect(x - 1, gy - 4, 2, 3);
    g.fillRect(x + 2, gy - 4, 2, 3);
    g.fillRect(x + 3, gy - 7, 4, 1);
  }
  // Wordmark
  const scale = cssW < 280 ? 2 : cssH < 56 ? 2 : cssH >= 96 && cssW >= 420 ? 4 : 3;
  // Center each stacked word on its own (letters are 6 units wide incl. spacing).
  const xFor = (word) => Math.max(4, ((cssW - (word.length * 6 - 1) * scale) / 2) | 0);
  const x0 = xFor('DARE');
  const x1 = xFor('FORWARD');
  const y0 = cssH < 56 ? 4 : 8;
  const flicker = !REDUCED_MOTION && Math.floor(t * 12) % 53 === 0;
  stampWord(g, 'DARE', x0 + 1, y0 + 1, scale, '#1a0c08');
  stampWord(g, 'DARE', x0, y0, scale, flicker ? '#a06030' : '#f0d8a0');
  const y1 = y0 + scale * 8 + 2;
  if (y1 + scale * 7 < cssH - 2) {
    stampWord(g, 'FORWARD', x1 + 1, y1 + 1, scale, '#1a0c08');
    stampWord(g, 'FORWARD', x1, y1, scale, flicker ? '#c05020' : '#e07030');
  }
}

export { GAME_TITLE, isMuted };
