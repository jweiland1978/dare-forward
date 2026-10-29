/** Dare Forward — loop, camera, spawning, screens, test hooks. */
import {
  GAME_TITLE,
  WORLD_W,
  TICK,
  STORAGE_BEST,
  clamp,
  mulberry32,
  rankFor,
  TERRITORY_NAMES,
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
  blast,
} from './entities.js?v=1';
import {
  resetFx,
  updateFx,
  drawDecals,
  drawParticles,
  drawFloaters,
  getShake,
  getFlash,
  particleCount,
  shakeAmount,
  explode,
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
  viewH: 240,
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
  G.viewH = WORLD_W * (cssH / cssW);
  low.width = WORLD_W;
  low.height = Math.max(1, Math.ceil(G.viewH));
  lg.imageSmoothingEnabled = false;
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 80));

bindInput({
  canvas,
  stickZone: document.getElementById('stick-zone'),
  fireBtn: document.getElementById('fire-btn'),
  grenadeBtn: document.getElementById('grenade-btn'),
  getCam: () => ({ camY: G.camY, viewH: G.viewH }),
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
        c.alive = false;
        blast(world, c.x, c.y, 48, { size: 1.4, sfx: 'barrel', debris: '#c43c28' }, hooks);
      } else {
        destroyCover(world, c, hooks);
      }
    }
  },
  barrelBoom(c) {
    blast(world, c.x, c.y, 48, { size: 1.4, sfx: 'barrel' }, hooks);
  },
  hurtPow(p) {
    if (!p.alive) return;
    p.alive = false;
    G.score = Math.max(0, G.score - 200);
    explode(p.x, p.y, 0.5);
    sfx('hurt');
  },
  hurtPlayer() {
    const p = world.player;
    if (!p.alive || p.invuln > 0 || G.invincible) return;
    p.alive = false;
    explode(p.x, p.y, 0.8);
    sfx('death');
    p.lives -= 1;
    if (p.lives <= 0) {
      gameOver();
    } else {
      setTimeout(() => {
        if (G.screen !== 'play') return;
        p.alive = true;
        p.invuln = INVULN();
        p.weapon = 'rifle';
        p.ammo = Infinity;
      }, 500);
    }
  },
};

function INVULN() {
  return 2.5;
}

const enemyApi = makeEnemyApi(world, hooks);

function loadTerritory(index, seed) {
  G.territory = index;
  G.seed = seed || 1;
  G.rng = mulberry32(G.seed + index * 997);
  G.layout = buildTerritory(index, G.rng);
  G.territoryName = G.layout.name;
  G.ended = false;
  G.bannerT = 1.8;
  loadLayout(world, G.layout, hooks);
  const startY = G.layout.length - 40;
  if (!world.player) world.player = createPlayer(WORLD_W / 2, startY);
  else {
    world.player.x = WORLD_W / 2;
    world.player.y = startY;
    world.player.alive = true;
    world.player.invuln = 3.0;
    world.player.facingX = 0;
    world.player.facingY = -1;
  }
  G.player = world.player;
  G.viewH = G.viewH || 240;
  G.camY = Math.max(0, G.layout.length - G.viewH);
  G.startCamY = G.camY;
  G.progress = 0;
  G.scrollY = G.camY;
  G.lastAmbient = G.camY;
  G.kills = 0;
  G.shots = 0;
  G.hits = 0;
  resetFx();
  spawnPending(world, G.camY, G.viewH);
}

function startGame(opts) {
  const o = opts || {};
  G.score = o.keepScore ? G.score : 0;
  world.player = createPlayer(WORLD_W / 2, 100);
  world.player.lives = 3;
  world.player.grenades = 5;
  world.player.weapon = 'rifle';
  world.player.ammo = Infinity;
  G.player = world.player;
  loadTerritory(o.territory || 0, o.seed || 1);
  G.screen = 'play';
  setScreen('play');
  resize();
  G.camY = Math.max(0, G.layout.length - G.viewH);
  G.startCamY = G.camY;
  world.player.y = G.layout.length - 40;
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
  G.ended = true;
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
  G.camY = Math.max(0, G.layout.length - G.viewH);
  G.startCamY = G.camY;
  world.player.y = G.layout.length - 40;
}

function step(dt) {
  if (G.screen !== 'play') return;
  const p = world.player;
  G.player = p;
  enemyApi.player = p;
  enemyApi.cover = world.cover;
  enemyApi.camY = G.camY;
  enemyApi.viewH = G.viewH;
  enemyApi.rng = G.rng;

  spawnPending(world, G.camY, G.viewH);

  const ambientEvery = (G.layout.ambient && G.layout.ambient.every) || 240;
  if (G.lastAmbient - G.camY > ambientEvery) {
    G.lastAmbient = G.camY;
    if (world.enemies.filter((e) => e.alive).length < 8 && G.camY > 80) {
      const types = (G.layout.ambient && G.layout.ambient.types) || ['rifleman'];
      const type = types[(G.rng() * types.length) | 0];
      const side = G.rng() < 0.5;
      const x = side ? 20 + G.rng() * 40 : WORLD_W - 60 + G.rng() * 40;
      const y = G.camY + 10;
      const en = createEnemy(type, x, y);
      if (en) world.enemies.push(en);
    }
  }

  updatePlayer(world, dt, input, { camY: G.camY, viewH: G.viewH }, hooks);
  updateEnemies(world, dt, enemyApi);
  updateGrenades(world, dt, hooks);
  updateBullets(world, dt, hooks);
  updatePickups(world, dt);
  updatePows(world, dt);
  updateFx(dt);

  if (p && p.alive) {
    const follow = G.camY + G.viewH * 0.42;
    if (p.y < follow) {
      G.camY = Math.max(0, p.y - G.viewH * 0.42);
    }
  }
  G.scrollY = G.camY;
  G.progress = G.startCamY <= 0 ? 1 : clamp(1 - G.camY / G.startCamY, 0, 1);

  if (G.bannerT > 0) G.bannerT -= dt;

  if (!G.ended && p && p.alive && p.y < (G.layout.gateY || 90) && G.camY < 40) {
    secureTerritory();
  }
}

function draw() {
  const viewH = low.height;
  G.viewH = viewH;
  lg.imageSmoothingEnabled = false;
  const pal = G.layout ? G.territory : 0;
  drawWorldGround(lg, world, G.camY, viewH, pal);
  drawDecals(lg, G.camY);
  drawCover(lg, world, G.camY, viewH);
  drawEntities(lg, world, G.camY, viewH, G.lastT);
  drawParticles(lg, G.camY);
  drawFloaters(lg, G.camY);

  if (G.bannerT > 0 && G.screen === 'play' && G.layout) {
    const a = Math.min(1, G.bannerT);
    lg.globalAlpha = 0.75 * a;
    lg.fillStyle = '#1a1410';
    lg.fillRect(40, 18, WORLD_W - 80, 28);
    lg.globalAlpha = a;
    lg.fillStyle = '#f0e8d0';
    lg.font = 'bold 12px Tahoma, sans-serif';
    lg.textAlign = 'center';
    lg.fillText(G.territoryName.toUpperCase(), WORLD_W / 2, 32);
    lg.font = '8px Tahoma, sans-serif';
    lg.fillStyle = '#c4a060';
    lg.fillText('Move north', WORLD_W / 2, 42);
    lg.globalAlpha = 1;
  }

  const sh = getShake();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const sx = (sh.x * (canvas.width / WORLD_W)) | 0;
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
  let dt = Math.min(0.05, (t - G.lastT) / 1000) * G.speed;
  G.lastT = t;
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

function jsonState() {
  const p = world.player || {};
  return {
    screen: G.screen,
    territory: G.territory,
    territoryName: G.territoryName,
    scrollY: Math.round(G.camY),
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
    })),
    enemyCount: world.enemies.filter((e) => e.alive).length,
    bullets: {
      player: world.bullets.filter((b) => b.team === 'player').length,
      enemy: world.bullets.filter((b) => b.team !== 'player').length,
    },
    pickups: world.pickups.filter((pk) => pk.alive).map((pk) => ({ type: pk.type, x: Math.round(pk.x), y: Math.round(pk.y) })),
    cover: world.cover
      .filter((c) => c.alive && (c.type === 'sandbag' || c.type === 'crate' || c.type === 'barrel' || c.type === 'wall'))
      .map((c) => ({ type: c.type, x: Math.round(c.x), y: Math.round(c.y), hp: c.hp })),
    pows: { rescued: world.powRescued || 0, total: world.powTotal || 0 },
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
    world.player.x = x;
    world.player.y = y;
  },
  scrollTo(progress) {
    const p = clamp(progress, 0, 1);
    G.camY = G.startCamY * (1 - p);
    G.progress = p;
    if (world.player) {
      world.player.y = G.camY + G.viewH * 0.55;
      world.player.x = WORLD_W / 2;
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
