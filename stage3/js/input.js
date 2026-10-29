/** Keyboard, mouse, touch stick + FIRE/GRENADE. Multi-touch by pointer id. */
import { WORLD_W } from './config.js?v=1';

export const input = {
  ax: 0,
  ay: 0,
  fire: false,
  grenadeQueued: false,
  mouseAim: false,
  mouseX: 0,
  mouseY: 0,
  pauseQueued: false,
  muteQueued: false,
  keys: Object.create(null),
  touchActive: false,
};

const pointers = new Map();
let stickId = null;
let stickOx = 0;
let stickOy = 0;
let stickDx = 0;
let stickDy = 0;
let fireIds = new Set();
let seenTouch = false;

const KEY_UP = new Set(['ArrowUp', 'KeyW', 'w', 'W']);
const KEY_DN = new Set(['ArrowDown', 'KeyS', 's', 'S']);
const KEY_LT = new Set(['ArrowLeft', 'KeyA', 'a', 'A']);
const KEY_RT = new Set(['ArrowRight', 'KeyD', 'd', 'D']);

function isCoarse() {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

export function isTouchDevice() {
  return seenTouch || isCoarse() || navigator.maxTouchPoints > 0;
}

export function consumeGrenade() {
  if (!input.grenadeQueued) return false;
  input.grenadeQueued = false;
  return true;
}
input.consumeGrenade = consumeGrenade;

export function consumePause() {
  if (!input.pauseQueued) return false;
  input.pauseQueued = false;
  return true;
}

export function consumeMute() {
  if (!input.muteQueued) return false;
  input.muteQueued = false;
  return true;
}

function refreshMove() {
  let x = 0;
  let y = 0;
  if (input.keys.up) y -= 1;
  if (input.keys.down) y += 1;
  if (input.keys.left) x -= 1;
  if (input.keys.right) x += 1;
  if (stickId != null) {
    x = stickDx;
    y = stickDy;
  }
  const l = Math.hypot(x, y);
  if (l > 1) {
    x /= l;
    y /= l;
  }
  input.ax = x;
  input.ay = y;
}

function onKey(e, down) {
  const k = e.code || e.key;
  if (KEY_UP.has(k) || KEY_UP.has(e.key)) input.keys.up = down;
  if (KEY_DN.has(k) || KEY_DN.has(e.key)) input.keys.down = down;
  if (KEY_LT.has(k) || KEY_LT.has(e.key)) input.keys.left = down;
  if (KEY_RT.has(k) || KEY_RT.has(e.key)) input.keys.right = down;
  if (k === 'Space' || k === 'KeyJ' || e.key === ' ') {
    input.fire = down || fireIds.size > 0 || input.mouseAim;
    if (down) e.preventDefault();
  }
  if (down && (k === 'KeyG' || k === 'KeyK' || e.key === 'g' || e.key === 'k')) {
    input.grenadeQueued = true;
    e.preventDefault();
  }
  if (down && (k === 'KeyP' || k === 'Escape' || e.key === 'p' || e.key === 'Escape')) {
    input.pauseQueued = true;
    e.preventDefault();
  }
  if (down && (k === 'KeyM' || e.key === 'm')) {
    input.muteQueued = true;
    e.preventDefault();
  }
  refreshMove();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
}

export function bindInput(opts) {
  const { canvas, stickZone, fireBtn, grenadeBtn, getCam } = opts;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === ' ') {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'BUTTON' || tag === 'A') {
        e.preventDefault();
        try {
          e.target.blur();
        } catch {
          /* ignore */
        }
      }
    }
    onKey(e, true);
  });
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => {
    input.keys = Object.create(null);
    input.fire = fireIds.size > 0;
    input.mouseAim = false;
    refreshMove();
  });

  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.target && (e.target.closest('#app') || e.target === document.body)) e.preventDefault();
    },
    { passive: false },
  );

  function canvasToWorld(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const cam = getCam();
    const viewW = cam.viewW || WORLD_W;
    const x = ((clientX - r.left) / r.width) * viewW + (cam.camX || 0);
    const y = ((clientY - r.top) / r.height) * cam.viewH + cam.camY;
    return { x, y };
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') {
      seenTouch = true;
      input.touchActive = true;
      return;
    }
    if (e.button === 0) {
      input.mouseAim = true;
      input.fire = true;
      const w = canvasToWorld(e.clientX, e.clientY);
      input.mouseX = w.x;
      input.mouseY = w.y;
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    } else if (e.button === 1 || e.button === 2) {
      input.grenadeQueued = true;
      e.preventDefault();
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!input.mouseAim) return;
    const w = canvasToWorld(e.clientX, e.clientY);
    input.mouseX = w.x;
    input.mouseY = w.y;
  });
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') return;
    if (e.button === 0) {
      input.mouseAim = false;
      input.fire = fireIds.size > 0 || input.keys.fire;
    }
  });
  canvas.addEventListener('pointercancel', () => {
    input.mouseAim = false;
    if (fireIds.size === 0) input.fire = false;
  });

  function bindHold(el, onDown, onUp) {
    if (!el) return;
    el.addEventListener(
      'pointerdown',
      (e) => {
        seenTouch = true;
        input.touchActive = true;
        el.setPointerCapture(e.pointerId);
        onDown(e);
        e.preventDefault();
        e.stopPropagation();
      },
      { passive: false },
    );
    el.addEventListener('pointerup', (e) => {
      onUp(e);
      e.preventDefault();
    });
    el.addEventListener('pointercancel', (e) => onUp(e));
  }

  bindHold(
    fireBtn,
    (e) => {
      fireIds.add(e.pointerId);
      input.fire = true;
    },
    (e) => {
      fireIds.delete(e.pointerId);
      if (fireIds.size === 0 && !input.mouseAim) input.fire = false;
    },
  );

  bindHold(
    grenadeBtn,
    () => {
      input.grenadeQueued = true;
    },
    () => {},
  );

  if (stickZone) {
    const ring = stickZone.querySelector('.stick-ring');
    const knob = stickZone.querySelector('.stick-knob');
    const maxR = 42;

    function setStickVisual(ox, oy, dx, dy) {
      if (!ring || !knob) return;
      ring.style.display = 'block';
      ring.style.left = ox - 48 + 'px';
      ring.style.top = oy - 48 + 'px';
      knob.style.transform = `translate(${dx * maxR}px, ${dy * maxR}px)`;
    }
    function hideStick() {
      if (ring) ring.style.display = 'none';
    }

    stickZone.addEventListener(
      'pointerdown',
      (e) => {
        if (stickId != null) return;
        seenTouch = true;
        input.touchActive = true;
        stickId = e.pointerId;
        const r = stickZone.getBoundingClientRect();
        stickOx = e.clientX - r.left;
        stickOy = e.clientY - r.top;
        stickDx = 0;
        stickDy = 0;
        stickZone.setPointerCapture(e.pointerId);
        setStickVisual(stickOx, stickOy, 0, 0);
        refreshMove();
        e.preventDefault();
      },
      { passive: false },
    );
    stickZone.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerId !== stickId) return;
        const r = stickZone.getBoundingClientRect();
        const x = e.clientX - r.left - stickOx;
        const y = e.clientY - r.top - stickOy;
        const l = Math.hypot(x, y) || 1;
        const m = Math.min(1, l / maxR);
        stickDx = (x / l) * m;
        stickDy = (y / l) * m;
        setStickVisual(stickOx, stickOy, stickDx, stickDy);
        refreshMove();
        e.preventDefault();
      },
      { passive: false },
    );
    function endStick(e) {
      if (e && e.pointerId !== stickId) return;
      stickId = null;
      stickDx = stickDy = 0;
      hideStick();
      refreshMove();
    }
    stickZone.addEventListener('pointerup', endStick);
    stickZone.addEventListener('pointercancel', endStick);
    hideStick();
  }

  window.addEventListener(
    'touchstart',
    () => {
      seenTouch = true;
      input.touchActive = true;
    },
    { passive: true },
  );
}

export { pointers };
