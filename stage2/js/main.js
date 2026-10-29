/** Dare Forward — loop, camera, spawning, screens, test hooks. */
import {
  GAME_TITLE,
  WORLD_W,
  TICK,
  STORAGE_BEST,
  TARGET_SCALE,
  DIFFICULTY,
  loadDifficulty,
  saveDifficulty,
  REDUCED_MOTION,
  clamp,
  mulberry32,
  rankFor,
  TERRITORY_NAMES,
  dist2,
} from './config.js?v=1';
import { PALETTES, buildTerritory } from './territories.js?v=1';
import { buildSprites } from './sprites.js?v=1';
import { WEAPON_IDS, getWeapon } from './weapons.js?v=1';
import { ENEMY_TYPE_IDS, createEnemy } from './enemies.js?v=1';
import {
  createWorld,
  createPlayer,
  loadLayout,
  spawnPending,
  updatePlayer,
  updateGrenades,
  updateBullets,
  updateEnemies,
  updatePickups,
  updatePows,
  makeEnemyApi,
  killEnemy,
  destroyCover,
  makeCover,
  drawWorldGround,
  drawCover,
  drawEntities,
  drawEdgeArrows,
  blast,
  tryExtract,
  extractNearPlayer,
  DEBRIS_COLOR,
} from './entities.js?v=1';
import {
  resetFx,
  updateFx,
  updateFires,
  drawDecals,
  drawFires,
  drawParticles,
  drawFloaters,
  getShake,
  getFlash,
  particleCount,
  fireCount,
  shakeAmount,
  explode,
  shake,
  addFlash,
  floatingText,
} from './fx.js?v=1';
import {
  sfx,
  resume,
  hookFirstGesture,
  cycleVolume,
  toggleMusic,
} from './audio.js?v=1';
import { input, bindInput, isTouchDevice, consumePause, consumeMute } from './input.js?v=1';
import { setScreen, updateHud, fillSecured, fillGameOver, fillComplete, setBestOnTitle } from './ui.js?v=1';

document.title = GAME_TITLE;
const titleEl = document.getElementById('game-title');
const headingEl = document.getElementById('title-heading');
if (titleEl) titleEl.textContent = GAME_TITLE;
if (headingEl) headingEl.textContent = GAME_TITLE;

buildSprites(PALETTES);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const low = document.createElement('canvas');
const lg = low.getContext('2d');
lg.imageSmoothingEnabled = false;
ctx.imageSmoothingEnabled = false;

const world = createWorld();

const G = {
  screen: 'title',
  territory: 0,
  territoryName: TERRITORY_NAMES[0],
  layout: null,
  camY: 0,
  camX: 0,
  viewH: 240,
  viewW: WORLD_W,
  scale: 2,
  difficulty: 'normal',
  timeScale: 1,
  slowUntil: 0,
  holding: false,
  holdStarted: false,
  holdDone: false,
  holdLeft: 0,
  holdLine: 0,
  holdSpawn: 0,
  bannerText: '',
  howtoFrom: 'title',
  startCamY: 0,
  progress: 0,
  scrollY: 0,
  score: 0,
  best: 0,
  kills: 0,
  shots: 0,
  hits: 0,
  player: null,
  seed: 1,
  rng: mulberry32(1),
  invincible: false,
  speed: 1,
  lastAmbient: 0,
  bannerT: 0,
  ended: false,
  acc: 0,
  lastT: 0,
  running: true,
};

const frameTimes = [];
let frameN = 0;
let maxMs = 0;
let sumMs = 0;

try {
  G.best = parseInt(localStorage.getItem(STORAGE_BEST) || '0', 10) || 0;
} catch {
  G.best = 0;
}
setBestOnTitle(G.best);
G.difficulty = loadDifficulty();
world.diff = DIFFICULTY[G.difficulty];

const boomTimes = [];
function noteBoom() {
  const t = performance.now();
  boomTimes.push(t);
  while (boomTimes.length && t - boomTimes[0] > 400) boomTimes.shift();
  if (boomTimes.length >= 3) {
    boomTimes.length = 0;
    shake(REDUCED_MOTION ? 5 : 16);
    addFlash(REDUCED_MOTION ? 0.18 : 0.72);
    if (!REDUCED_MOTION) {
      G.timeScale = 0.35;
      G.slowUntil = t + 520;
    }
  }
}

function getDiff() {
  return DIFFICULTY[G.difficulty] || DIFFICULTY.normal;
}

function syncDiffButtons() {
  for (const id of ['easy', 'normal', 'hard']) {
    document.querySelectorAll('[data-testid="diff-' + id + '"]').forEach((btn) => {
      const on = G.difficulty === id;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
}

function setDifficulty(id) {
  if (!DIFFICULTY[id]) return;
  G.difficulty = id;
  world.diff = DIFFICULTY[id];
  saveDifficulty(id);
  syncDiffButtons();
}
syncDiffButtons();

function saveBest() {
  if (G.score > G.best) {
    G.best = G.score;
    try {
      localStorage.setItem(STORAGE_BEST, String(G.best));
    } catch {
      /* ignore */
    }
  }
}

function layoutMode() {
  const touch = isTouchDevice() || input.touchActive;
  const portrait = window.innerHeight >= window.innerWidth;
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  const phone = shortSide < 600;
  document.body.classList.toggle('touch', touch);
  document.body.classList.toggle('no-touch', !touch);
  document.body.classList.toggle('phone-portrait', touch && phone && portrait);
  document.body.classList.toggle('overlay', touch && !(phone && portrait));
  // Phone in landscape: battlefield centered, controls in the side gutters so thumbs never cover the action.
  document.body.classList.toggle('phone-land', touch && phone && !portrait);
  document.body.classList.toggle('portrait', portrait);
  document.body.classList.toggle('landscape', !portrait);
}

function layoutKind() {
  const touch = isTouchDevice() || input.touchActive;
  const portrait = window.innerHeight >= window.innerWidth;
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  const phone = shortSide < 600;
  if (touch && phone && portrait) return 'phone';
  if (touch && phone && !portrait) return 'phoneLand';
  if (touch && !phone) return 'ipad';
  return 'laptop';
}

function computeView(cssW, cssH, mode) {
  const target = TARGET_SCALE[mode] || TARGET_SCALE.laptop;
  let viewW = cssW / target;
  let viewH = cssH / target;
  if (mode === 'phoneLand') {
    const aim = 174;
    const s = cssH / aim;
    if (s >= 1.92) {
      viewH = aim;
      viewW = cssW / s;
    }
  }
  if (viewW > WORLD_W) {
    viewW = WORLD_W;
    viewH = (cssH * viewW) / cssW;
  }
  viewW = Math.max(100, Math.round(viewW));
  if (viewW > WORLD_W) viewW = WORLD_W;
  viewH = Math.max(100, Math.round((cssH * viewW) / cssW));
  return { viewW, viewH, scale: cssW / viewW };
}

function resize() {
  layoutMode();
  const wrap = document.getElementById('game-wrap');
  const r = wrap.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const cssW = Math.max(1, r.width);
  const cssH = Math.max(1, r.height);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.max(1, (cssW * dpr) | 0);
  canvas.height = Math.max(1, (cssH * dpr) | 0);
  const v = computeView(cssW, cssH, layoutKind());
  G.viewW = v.viewW;
  G.viewH = v.viewH;
  G.scale = Math.round(v.scale * 1000) / 1000;
  low.width = G.viewW;
  low.height = G.viewH;
  lg.imageSmoothingEnabled = false;
  if (G.layout) {
    const maxC = Math.max(0, WORLD_W - G.viewW);
    G.camX = clamp(G.camX, 0, maxC);
    G.camY = clamp(G.camY, 0, Math.max(0, G.layout.length - G.viewH));
    const p = world.player;
    if (p) {
      p.x = clamp(p.x, G.camX + 12, G.camX + G.viewW - 12);
      p.y = clamp(p.y, G.camY + 12, G.camY + G.viewH - 12);
    }
  }
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 80));

bindInput({
  canvas,
  stickZone: document.getElementById('stick-zone'),
  fireBtn: document.getElementById('fire-btn'),
  grenadeBtn: document.getElementById('grenade-btn'),
  getCam: () => ({ camY: G.camY, viewH: G.viewH, camX: G.camX, viewW: G.viewW }),
});
hookFirstGesture();

const hooks = {
  rng: () => G.rng(),
  aggression() {
    return 0.2 + G.progress * 0.8;
  },
  invincible() {
    return G.invincible;
  },
  addScore(n) {
    G.score += n;
    saveBest();
  },
  addKill() {
    G.kills++;
  },
  shotFired() {
    G.shots++;
  },
  shotHit() {
    G.hits++;
  },
  hurtEnemy(e, dmg) {
    e.hp -= dmg;
    if (e.hp <= 0) killEnemy(world, e, hooks);
  },
  hurtCover(c, dmg, explosive) {
    if (!c.alive || c.indestructible) return;
    if (c.onlyExplosive && !explosive) return;
    if (explosive) c.hp = 0;
    else c.hp -= dmg;
    if (c.hp <= 0) {
      if (c.explosive) {
        if (c.boomed) return;
        c.boomed = true;
        c.alive = false;
        noteBoom();
        blast(world, c.x, c.y, 48, { size: 1.45, sfx: 'barrel', debris: DEBRIS_COLOR.barrel }, hooks);
      } else {
        destroyCover(world, c, hooks);
      }
    }
  },
  barrelBoom(c) {
    blast(world, c.x, c.y, 48, { size: 1.4, sfx: 'barrel' }, hooks);
  },
  hurtPow(p) {
    if (!p.alive || p.extracted) return;
    p.alive = false;
    p.following = false;
    if (!p.rescued) G.score = Math.max(0, G.score - 200);
    explode(p.x, p.y, 0.5);
    sfx('hurt');
  },
  hurtPlayer() {
    const p = world.player;
    if (!p.alive || p.invuln > 0 || G.invincible) return;
    p.alive = false;
    for (const pow of world.pows) if (pow.following) pow.waiting = true;
    explode(p.x, p.y, 0.8);
    sfx('death');
    p.lives -= 1;
    if (p.lives <= 0) {
      gameOver();
    } else {
      setTimeout(() => {
        if (G.screen !== 'play') return;
        p.alive = true;
        p.invuln = getDiff().respawnShield;
        p.weapon = 'rifle';
        p.ammo = Infinity;
      }, 500);
    }
  },
};

const enemyApi = makeEnemyApi(world, hooks);

function placeAtStart() {
  if (!G.layout || !world.player) return;
  const len = G.layout.length;
  const p = world.player;
  const maxC = Math.max(0, WORLD_W - G.viewW);
  p.x = WORLD_W / 2;
  p.y = len - 40;
  G.camY = Math.max(0, len - G.viewH);
  G.camX = clamp(p.x - G.viewW * 0.5, 0, maxC);
  p.x = clamp(p.x, G.camX + 12, G.camX + G.viewW - 12);
  p.y = clamp(p.y, G.camY + 12, Math.min(len - 8, G.camY + G.viewH - 12));
  G.startCamY = G.camY;
  G.progress = 0;
  G.scrollY = G.camY;
  G.lastAmbient = G.camY;
}

function loadTerritory(index, seed) {
  G.territory = index;
  G.seed = seed || 1;
  G.rng = mulberry32(G.seed + index * 997);
  G.layout = buildTerritory(index, G.rng);
  G.territoryName = G.layout.name;
  G.ended = false;
  G.bannerT = 1.8;
  G.bannerText = '';
  G.holding = false;
  G.holdStarted = false;
  G.holdDone = false;
  G.holdLeft = 0;
  G.holdSpawn = 0;
  G.timeScale = 1;
  G.slowUntil = 0;
  boomTimes.length = 0;
  world.holdClamp = null;
  world.diff = getDiff();
  loadLayout(world, G.layout, hooks);
  const startY = G.layout.length - 40;
  if (!world.player) world.player = createPlayer(WORLD_W / 2, startY);
  else {
    world.player.x = WORLD_W / 2;
    world.player.y = startY;
    world.player.alive = true;
    world.player.facingX = 0;
    world.player.facingY = -1;
  }
  world.player.invuln = getDiff().startShield;
  G.player = world.player;
  G.kills = 0;
  G.shots = 0;
  G.hits = 0;
  resetFx();
  placeAtStart();
  spawnPending(world, G.camY, G.viewH);
}

function startGame(opts) {
  const o = opts || {};
  const d = getDiff();
  G.score = o.keepScore ? G.score : 0;
  world.player = createPlayer(WORLD_W / 2, 100);
  world.player.lives = d.lives;
  world.player.grenades = d.grenades;
  world.player.weapon = 'rifle';
  world.player.ammo = Infinity;
  G.player = world.player;
  loadTerritory(o.territory || 0, o.seed || 1);
  G.screen = 'play';
  setScreen('play');
  resize();
  placeAtStart();
  world.player.invuln = d.startShield;
  resume();
  sfx('ui');
  try {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  } catch {
    /* ignore */
  }
}

function goTitle() {
  G.screen = 'title';
  setScreen('title');
  if (!G.layout) loadTerritory(0, 1);
  setBestOnTitle(G.best);
}

function pauseGame() {
  if (G.screen !== 'play') return;
  G.screen = 'paused';
  setScreen('paused');
}

function resumeGame() {
  if (G.screen !== 'paused') return;
  G.screen = 'play';
  setScreen('play');
}

function gameOver() {
  saveBest();
  G.screen = 'gameover';
  setScreen('gameover');
  fillGameOver({ score: G.score, best: G.best });
}

function accuracy() {
  if (!G.shots) return 0;
  return Math.round((G.hits / G.shots) * 100);
}

function secureTerritory() {
  if (G.ended) return;
  extractNearPlayer(world, hooks, 80);
  G.ended = true;
  G.holding = false;
  world.holdClamp = null;
  saveBest();
  sfx('fanfare');
  G.screen = 'secured';
  setScreen('secured');
  const nameEl = document.getElementById('secured-name');
  if (nameEl) nameEl.textContent = G.territoryName;
  fillSecured({
    score: G.score,
    kills: G.kills,
    pows: world.powRescued + '/' + world.powTotal,
    extracted: world.powExtracted || 0,
    accuracy: accuracy(),
  });
}

// Later stage: single final boss after territory 4.
function onCampaignEnd() {
  saveBest();
  G.screen = 'complete';
  setScreen('complete');
  fillComplete({ score: G.score, best: G.best });
}

function continueCampaign() {
  const next = G.territory + 1;
  if (next >= 4) {
    onCampaignEnd();
    return;
  }
  const lives = world.player.lives;
  const gren = world.player.grenades;
  const weap = world.player.weapon;
  const ammo = world.player.ammo;
  loadTerritory(next, G.seed);
  world.player.lives = lives;
  world.player.grenades = gren;
  world.player.weapon = weap;
  world.player.ammo = ammo;
  G.screen = 'play';
  setScreen('play');
  resize();
  placeAtStart();
  world.player.invuln = getDiff().startShield;
}

function followCamera(dt) {
  const p = world.player;
  if (!p) return;
  const maxC = Math.max(0, WORLD_W - G.viewW);
  const dead = 18;
  const mid = G.camX + G.viewW * 0.5;
  let target = G.camX;
  if (p.x < mid - dead) target = G.camX - (mid - dead - p.x);
  else if (p.x > mid + dead) target = G.camX + (p.x - (mid + dead));
  target = clamp(target, 0, maxC);
  const k = 1 - Math.exp(-12 * dt);
  G.camX = clamp(G.camX + (target - G.camX) * k, 0, maxC);
  if (p.alive) {
    p.x = clamp(p.x, G.camX + 12, G.camX + G.viewW - 12);
    p.x = clamp(p.x, 10, WORLD_W - 10);
  }
}

function holdPush() {
  const hold = G.layout && G.layout.hold;
  if (!hold || !G.holding) return;
  const d = getDiff();
  const n = Math.max(1, Math.round(2 * d.enemyMul));
  for (let i = 0; i < n; i++) {
    const x = clamp(hold.x0 + 16 + G.rng() * (hold.x1 - hold.x0 - 32), 16, WORLD_W - 16);
    const y = hold.lineY - 28 - G.rng() * 36;
    const kind = G.rng() < 0.35 ? 'charger' : 'rifleman';
    const en = createEnemy(kind, x, y);
    if (en) world.enemies.push(en);
  }
  if (G.rng() < 0.4) {
    const truck = createEnemy('truck', (hold.x0 + hold.x1) * 0.5, hold.lineY - 70);
    if (truck) world.enemies.push(truck);
  }
}

function step(dt) {
  if (G.screen !== 'play') return;
  const p = world.player;
  const d = getDiff();
  G.player = p;
  world.diff = d;
  enemyApi.player = p;
  enemyApi.cover = world.cover;
  enemyApi.camY = G.camY;
  enemyApi.viewH = G.viewH;
  enemyApi.camX = G.camX;
  enemyApi.viewW = G.viewW;
  enemyApi.diff = d;
  enemyApi.rng = G.rng;
  enemyApi.aggression = hooks.aggression();

  spawnPending(world, G.camY, G.viewH);

  const ambientEvery = ((G.layout.ambient && G.layout.ambient.every) || 240) * (d.ambientEveryMul || 1);
  if (!G.holding && G.lastAmbient - G.camY > ambientEvery) {
    G.lastAmbient = G.camY;
    const alive = world.enemies.filter((e) => e.alive).length;
    const cap = Math.max(4, Math.round(8 * d.enemyMul));
    const thin = d.enemyMul < 1 && G.rng() > d.enemyMul;
    if (!thin && alive < cap && G.camY > 80) {
      const types = (G.layout.ambient && G.layout.ambient.types) || ['rifleman'];
      const bursts = d.enemyMul >= 1.2 ? 2 : 1;
      for (let i = 0; i < bursts; i++) {
        const type = types[(G.rng() * types.length) | 0];
        const side = G.rng() < 0.5;
        let x = side ? G.camX - 28 - G.rng() * 18 : G.camX + G.viewW + 28 + G.rng() * 18;
        let y = G.camY + 18 + G.rng() * Math.min(48, G.viewH * 0.3);
        if (x < 18 || x > WORLD_W - 18) {
          x = G.camX + 24 + G.rng() * Math.max(20, G.viewW - 48);
          y = G.camY - 16;
        }
        const en = createEnemy(type, x, y);
        if (en) world.enemies.push(en);
      }
    }
  }

  updatePlayer(world, dt, input, { camY: G.camY, viewH: G.viewH, camX: G.camX, viewW: G.viewW }, hooks);
  followCamera(dt);
  if (p && p.alive) {
    const follow = G.camY + G.viewH * 0.42;
    if (p.y < follow) {
      G.camY = Math.max(0, p.y - G.viewH * 0.42);
    }
    const hold = G.layout && G.layout.hold;
    if (hold && !G.holdDone && !G.holding && p.y < hold.triggerY && p.x > hold.x0 && p.x < hold.x1) {
      G.holding = true;
      G.holdStarted = true;
      G.holdLeft = hold.duration || 24;
      G.holdLine = hold.lineY;
      world.holdClamp = hold.lineY;
      G.holdSpawn = 0.4;
      G.bannerT = Math.max(G.bannerT, 1.4);
    }
  }
  if (G.holding) {
    G.holdLeft -= dt;
    G.holdSpawn -= dt;
    if (G.holdSpawn <= 0) {
      holdPush();
      G.holdSpawn = 4.5 * (d.ambientEveryMul || 1);
    }
    if (G.holdLeft <= 0) {
      G.holding = false;
      G.holdDone = true;
      world.holdClamp = null;
      G.bannerText = 'BRIDGE OPEN';
      G.bannerT = 1.8;
      if (p) floatingText(p.x, p.y - 18, 'BRIDGE OPEN', '#ffe080');
      sfx('fanfare');
    }
  }

  updateEnemies(world, dt, enemyApi);
  updateGrenades(world, dt, hooks);
  updateBullets(world, dt, hooks);
  updatePickups(world, dt);
  updatePows(world, dt);
  tryExtract(world, hooks, false);
  updateFx(dt);
  updateFires(dt, (f) => {
    const rr = (f.r || 12) + 4;
    if (p && p.alive && dist2(p.x, p.y, f.x, f.y) < rr * rr) hooks.hurtPlayer();
    for (const e of world.enemies) {
      if (!e.alive) continue;
      if (dist2(e.x, e.y, f.x, f.y) < (rr + (e.radius || 7)) * (rr + (e.radius || 7))) hooks.hurtEnemy(e, 1);
    }
    for (const pow of world.pows) {
      if (!pow.alive || pow.hurtCd > 0) continue;
      if (dist2(pow.x, pow.y, f.x, f.y) < (rr + 6) * (rr + 6)) {
        pow.hurtCd = 0.45;
        hooks.hurtPow(pow);
      }
    }
  });

  G.scrollY = G.camY;
  G.progress = G.startCamY <= 0 ? 1 : clamp(1 - G.camY / G.startCamY, 0, 1);

  if (G.bannerT > 0) G.bannerT -= dt;

  if (!G.ended && p && p.alive && p.y < (G.layout.gateY || 90) && G.camY < 40) {
    secureTerritory();
  }
}

function draw() {
  const viewW = G.viewW;
  const viewH = G.viewH;
  const camX = Math.round(G.camX);
  const camY = Math.round(G.camY);
  lg.imageSmoothingEnabled = false;
  lg.setTransform(1, 0, 0, 1, 0, 0);
  lg.clearRect(0, 0, viewW, viewH);
  const pal = G.layout ? G.territory : 0;
  drawWorldGround(lg, world, camX, camY, viewW, viewH, pal);
  drawDecals(lg, camX, camY);
  drawCover(lg, world, camX, camY, viewW, viewH);
  drawFires(lg, camX, camY);
  drawEntities(lg, world, camX, camY, viewW, viewH);
  drawParticles(lg, camX, camY);
  drawFloaters(lg, camX, camY);
  drawEdgeArrows(lg, world, camX, camY, viewW, viewH);

  if (G.screen === 'play' && G.layout && (G.bannerT > 0 || G.holding)) {
    const a = G.holding ? 1 : Math.min(1, G.bannerT);
    const bw = Math.min(viewW - 16, 240);
    lg.globalAlpha = 0.75 * a;
    lg.fillStyle = '#1a1410';
    lg.fillRect((viewW - bw) / 2, 14, bw, G.holding ? 32 : 28);
    lg.globalAlpha = a;
    lg.fillStyle = '#f0e8d0';
    lg.font = 'bold 11px Tahoma, sans-serif';
    lg.textAlign = 'center';
    const title = G.holding && G.layout.hold ? G.layout.hold.banner : G.bannerText || G.territoryName.toUpperCase();
    lg.fillText(title, viewW / 2, 28);
    lg.font = '8px Tahoma, sans-serif';
    lg.fillStyle = '#c4a060';
    lg.fillText(G.holding ? String(Math.max(0, Math.ceil(G.holdLeft))) : 'Move north', viewW / 2, 40);
    lg.globalAlpha = 1;
  }

  const sh = getShake();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const sx = (sh.x * (canvas.width / viewW)) | 0;
  const sy = (sh.y * (canvas.height / viewH)) | 0;
  ctx.drawImage(low, sx, sy, canvas.width, canvas.height);
  const fl = getFlash();
  if (fl > 0) {
    ctx.fillStyle = 'rgba(255,255,255,' + fl * 0.55 + ')';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  updateHud({
    score: G.score,
    best: G.best,
    player: world.player,
    territoryName: G.territoryName,
    progress: G.progress,
  });
}

function loop(t) {
  const t0 = performance.now();
  if (!G.lastT) G.lastT = t;
  const realDt = Math.min(0.05, (t - G.lastT) / 1000);
  G.lastT = t;
  const now = t0;
  if (now < G.slowUntil) G.timeScale = 0.35;
  else if (G.timeScale < 1) {
    G.timeScale = Math.min(1, G.timeScale + realDt * 2.4);
    if (G.timeScale > 0.98) G.timeScale = 1;
  }
  let dt = realDt * G.speed * G.timeScale;
  if (consumePause() && (G.screen === 'play' || G.screen === 'paused')) {
    if (G.screen === 'play') pauseGame();
    else resumeGame();
  }
  if (consumeMute()) cycleVolume();
  G.acc += dt;
  let steps = 0;
  while (G.acc >= TICK && steps < 8) {
    step(TICK);
    G.acc -= TICK;
    steps++;
  }
  draw();
  const ms = performance.now() - t0;
  sumMs += ms;
  frameN++;
  if (ms > maxMs) maxMs = ms;
  requestAnimationFrame(loop);
}

document.getElementById('play-btn').addEventListener('click', () => {
  resume();
  startGame({ territory: 0, seed: 1 });
});
document.getElementById('pause-btn').addEventListener('click', () => {
  if (G.screen === 'play') pauseGame();
  else if (G.screen === 'paused') resumeGame();
});
document.getElementById('resume-btn').addEventListener('click', resumeGame);
document.getElementById('restart-btn').addEventListener('click', () => startGame({ territory: 0, seed: G.seed }));
document.getElementById('menu-btn').addEventListener('click', goTitle);
document.getElementById('mute-btn').addEventListener('click', () => {
  resume();
  cycleVolume();
  updateHud({ score: G.score, best: G.best, player: world.player, territoryName: G.territoryName, progress: G.progress });
});
document.getElementById('music-btn').addEventListener('click', () => {
  toggleMusic();
  updateHud({ score: G.score, best: G.best, player: world.player, territoryName: G.territoryName, progress: G.progress });
});
document.getElementById('continue-btn').addEventListener('click', continueCampaign);
document.getElementById('retry-btn').addEventListener('click', () => startGame({ territory: 0, seed: 1 }));
document.getElementById('go-menu-btn').addEventListener('click', goTitle);
document.getElementById('complete-menu-btn').addEventListener('click', goTitle);

for (const id of ['easy', 'normal', 'hard']) {
  document.querySelectorAll('[data-testid="diff-' + id + '"]').forEach((btn) => {
    btn.addEventListener('click', () => setDifficulty(id));
  });
}
document.querySelectorAll('[data-testid="howto-btn"]').forEach((btn) => {
  btn.addEventListener('click', () => {
    G.howtoFrom = G.screen === 'paused' ? 'paused' : 'title';
    G.screen = 'howto';
    setScreen('howto');
  });
});
function backHowTo() {
  if (G.howtoFrom === 'paused') {
    G.screen = 'paused';
    setScreen('paused');
  } else goTitle();
}
const howBack = document.getElementById('howto-back-btn');
if (howBack) howBack.addEventListener('click', backHowTo);
document.querySelectorAll('.howto-back').forEach((btn) => btn.addEventListener('click', backHowTo));

function paintHowTo() {
  document.querySelectorAll('canvas[data-icon]').forEach((c) => {
    const g = c.getContext('2d');
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#1a140e';
    g.fillRect(0, 0, 36, 36);
    const k = c.dataset.icon;
    g.fillStyle = '#e8d8b0';
    if (k === 'rifle') {
      g.fillRect(6, 16, 22, 3);
      g.fillRect(20, 13, 5, 3);
      g.fillRect(8, 19, 4, 5);
    } else if (k === 'spread') {
      g.fillStyle = '#f0c070';
      g.fillRect(6, 16, 8, 3);
      g.fillRect(14, 10, 12, 2);
      g.fillRect(14, 16, 14, 2);
      g.fillRect(14, 22, 12, 2);
    } else if (k === 'mg') {
      g.fillStyle = '#d0d8e0';
      g.fillRect(4, 15, 26, 5);
      g.fillRect(8, 11, 8, 4);
    } else if (k === 'rocket') {
      g.fillStyle = '#e07040';
      g.fillRect(8, 14, 16, 8);
      g.fillStyle = '#f0e080';
      g.fillRect(22, 16, 6, 4);
    } else if (k === 'flame') {
      g.fillStyle = '#c45a28';
      g.fillRect(6, 16, 10, 6);
      g.fillStyle = '#ffd060';
      g.fillRect(14, 12, 8, 12);
      g.fillStyle = '#ff5410';
      g.fillRect(20, 14, 6, 8);
    } else {
      g.fillStyle = '#60a040';
      g.beginPath();
      g.arc(18, 18, 7, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#d8e8c0';
      g.fillRect(17, 8, 2, 4);
    }
  });
}
paintHowTo();

function jsonState() {
  const p = world.player || {};
  const following = world.pows.filter((pw) => pw.alive && pw.following && !pw.extracted);
  return {
    screen: G.screen,
    territory: G.territory,
    territoryName: G.territoryName,
    scrollY: Math.round(G.camY),
    camX: Math.round(G.camX * 100) / 100,
    viewW: G.viewW,
    viewH: G.viewH,
    scale: G.scale,
    difficulty: G.difficulty,
    timeScale: Math.round(G.timeScale * 1000) / 1000,
    fires: fireCount(),
    vehicles: world.enemies.filter((e) => e.alive && (e.type === 'truck' || e.type === 'jeep')).length,
    bridges: (world.bridges && world.bridges.length) || 0,
    mortarBooms: world.mortarBooms || 0,
    hold: G.holding ? Math.ceil(G.holdLeft) : 0,
    progress: Math.round(G.progress * 1000) / 1000,
    player: {
      x: Math.round(p.x || 0),
      y: Math.round(p.y || 0),
      alive: !!p.alive,
      lives: p.lives || 0,
      grenades: p.grenades || 0,
      weapon: p.weapon || 'rifle',
      ammo: p.ammo === Infinity ? -1 : p.ammo || 0,
      invuln: !!(p.invuln > 0) || G.invincible,
    },
    score: G.score,
    best: G.best,
    enemies: world.enemies.map((e) => ({
      type: e.type,
      x: Math.round(e.x),
      y: Math.round(e.y),
      alive: !!e.alive,
      state: e.state || '',
      warn: e.warnT > 0,
      phase: e.phase || '',
      flaming: !!e.flaming,
    })),
    enemyCount: world.enemies.filter((e) => e.alive).length,
    bullets: {
      player: world.bullets.filter((b) => b.team === 'player').length,
      enemy: world.bullets.filter((b) => b.team !== 'player').length,
    },
    pickups: world.pickups.filter((pk) => pk.alive).map((pk) => ({ type: pk.type, x: Math.round(pk.x), y: Math.round(pk.y) })),
    cover: world.cover
      .filter((c) => c.alive && (c.type === 'sandbag' || c.type === 'crate' || c.type === 'barrel' || c.type === 'wall' || c.type === 'building' || c.type === 'bunker' || c.type === 'tanktrap' || c.type === 'wire'))
      .map((c) => ({ type: c.type, x: Math.round(c.x), y: Math.round(c.y), hp: c.hp })),
    pows: {
      rescued: world.powRescued || 0,
      total: world.powTotal || 0,
      following: following.length,
      extracted: world.powExtracted || 0,
    },
    followers: following.map((pw) => ({ x: Math.round(pw.x), y: Math.round(pw.y) })),
    particles: particleCount(),
    kills: G.kills,
    shake: shakeAmount(),
    rank: rankFor(G.score),
  };
}

window.__game = {
  state: jsonState,
  startGame,
  setInvincible(b) {
    G.invincible = !!b;
    if (world.player && b) world.player.invuln = 999;
  },
  setSpeed(m) {
    G.speed = m;
  },
  teleport(x, y) {
    if (!world.player) return;
    const p = world.player;
    const len = G.layout ? G.layout.length : 4000;
    p.x = clamp(x, 10, WORLD_W - 10);
    p.y = clamp(y, 8, len - 8);
    const outsideX = p.x < G.camX + 8 || p.x > G.camX + G.viewW - 8;
    const outsideY = p.y < G.camY + 8 || p.y > G.camY + G.viewH - 8;
    if (outsideY) G.camY = clamp(p.y - G.viewH * 0.55, 0, Math.max(0, len - G.viewH));
    if (outsideX) G.camX = clamp(p.x - G.viewW * 0.5, 0, Math.max(0, WORLD_W - G.viewW));
    p.x = clamp(p.x, G.camX + 12, G.camX + G.viewW - 12);
    p.y = clamp(p.y, G.camY + 12, G.camY + G.viewH - 12);
    spawnPending(world, G.camY, G.viewH);
  },
  scrollTo(progress) {
    const p = clamp(progress, 0, 1);
    const len = G.layout ? G.layout.length : 4000;
    G.camY = clamp(G.startCamY * (1 - p), 0, Math.max(0, len - G.viewH));
    G.progress = p;
    if (world.player) {
      world.player.y = G.camY + G.viewH * 0.55;
      world.player.x = clamp(WORLD_W / 2, G.camX + 12, G.camX + G.viewW - 12);
      const maxC = Math.max(0, WORLD_W - G.viewW);
      G.camX = clamp(world.player.x - G.viewW * 0.5, 0, maxC);
      world.player.x = clamp(WORLD_W / 2, G.camX + 12, G.camX + G.viewW - 12);
    }
    spawnPending(world, G.camY, G.viewH);
  },
  giveWeapon(id) {
    const w = getWeapon(id);
    if (!world.player) return;
    world.player.weapon = w.id;
    world.player.ammo = w.ammo;
  },
  spawnEnemy(type, x, y) {
    const e = createEnemy(type, x, y);
    if (e) world.enemies.push(e);
    return e;
  },
  spawnCover(type, x, y) {
    const c = makeCover(type, x, y);
    if (c) world.cover.push(c);
    return c;
  },
  setDifficulty,
  spawnPow(x, y) {
    world.pows.push({
      x,
      y,
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
    world.powTotal = (world.powTotal || 0) + 1;
  },
  extractNow() {
    return tryExtract(world, hooks, true);
  },
  killAllEnemies() {
    for (const e of world.enemies) {
      if (e.alive) killEnemy(world, e, hooks);
    }
  },
  skipTerritory() {
    if (G.territory >= 3) onCampaignEnd();
    else secureTerritory();
  },
  frameStats() {
    return { avgMs: frameN ? sumMs / frameN : 0, maxMs, frames: frameN };
  },
  weaponIds: WEAPON_IDS.slice(),
  enemyTypes: ENEMY_TYPE_IDS.slice(),
};

resize();
goTitle();
loadTerritory(0, 1);
requestAnimationFrame(loop);
