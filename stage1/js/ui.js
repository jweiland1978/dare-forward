/** HUD and overlay screens. */
import { GAME_TITLE, rankFor } from './config.js?v=1';
import { isMuted, volumeIndex, isMusicOn } from './audio.js?v=1';

export function setScreen(name) {
  document.body.dataset.screen = name;
  document.body.classList.toggle('playing', name === 'play');
  const ids = ['title', 'pause', 'secured', 'gameover', 'complete'];
  for (const id of ids) {
    const el = document.getElementById('screen-' + id);
    if (el) el.hidden = true;
  }
  if (name === 'play') return;
  const map = { title: 'title', paused: 'pause', secured: 'secured', gameover: 'gameover', complete: 'complete' };
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

export function fillComplete(stats) {
  const el = document.getElementById('complete-tally');
  if (!el) return;
  el.innerHTML = '<div>Final score <b>' + stats.score + '</b></div><div>Best <b>' + stats.best + '</b></div>';
}

export function setBestOnTitle(best) {
  const el = document.getElementById('title-best');
  if (el) el.textContent = 'BEST ' + pad(best);
}

export { GAME_TITLE, isMuted };
