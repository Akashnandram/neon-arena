// Neon Arena – top-down wave shooter. Plain canvas + Web Audio, no libraries.
'use strict';

// ---------- config ----------

const ARENA = { w: 2000, h: 2000 };
const VIEW_MIN = 760; // world units visible across the shorter side of the screen
const STICK_RADIUS = 60;

const OBSTACLES = [
  { x: 420, y: 420, w: 170, h: 170 },
  { x: 1410, y: 420, w: 170, h: 170 },
  { x: 420, y: 1410, w: 170, h: 170 },
  { x: 1410, y: 1410, w: 170, h: 170 },
  { x: 900, y: 690, w: 200, h: 44 },
  { x: 900, y: 1266, w: 200, h: 44 },
  { x: 690, y: 900, w: 44, h: 200 },
  { x: 1266, y: 900, w: 44, h: 200 },
];

const WEAPONS = {
  pistol:  { name: 'Pistol',  rate: 0.2,   dmg: 22, speed: 950,  spread: 0.04, count: 1, ammo: Infinity, color: '#7df9ff', size: 5 },
  smg:     { name: 'SMG',     rate: 0.075, dmg: 13, speed: 1050, spread: 0.14, count: 1, ammo: 160, color: '#ffe66d', size: 4 },
  shotgun: { name: 'Shotgun', rate: 0.55,  dmg: 15, speed: 900,  spread: 0.5,  count: 7, ammo: 28,  color: '#ff9f1c', size: 4 },
  rail:    { name: 'Railgun', rate: 0.4,   dmg: 70, speed: 1800, spread: 0,    count: 1, ammo: 30,  color: '#c3a6ff', size: 6, pierce: 4 },
  rocket:  { name: 'Rockets', rate: 0.75,  dmg: 30, speed: 700,  spread: 0.02, count: 1, ammo: 12,  color: '#ff5d8f', size: 8, explode: 120 },
};
const DROP_WEAPONS = ['smg', 'shotgun', 'rail', 'rocket'];

const ENEMIES = {
  grunt:   { r: 16, hp: 40,   speed: 125, dmg: 14, score: 10,  color: '#ff4d6d', mass: 1 },
  runner:  { r: 11, hp: 22,   speed: 235, dmg: 9,  score: 15,  color: '#ffd166', mass: 0.6 },
  shooter: { r: 15, hp: 50,   speed: 105, dmg: 12, score: 25,  color: '#4cc9f0', mass: 1 },
  tank:    { r: 28, hp: 240,  speed: 70,  dmg: 28, score: 40,  color: '#b15eff', mass: 4 },
  boss:    { r: 56, hp: 2400, speed: 65,  dmg: 35, score: 500, color: '#ff2e88', mass: 20 },
};

const UPGRADES = [
  { id: 'dmg',    icon: '💥', name: 'Hollow Points',   desc: '+25% damage',                     apply: () => { stats.dmg *= 1.25; } },
  { id: 'rate',   icon: '⚡', name: 'Hair Trigger',    desc: '+20% fire rate',                  apply: () => { stats.rate *= 1.2; } },
  { id: 'speed',  icon: '👟', name: 'Sprinter',        desc: '+12% move speed',                 apply: () => { stats.speed *= 1.12; } },
  { id: 'hp',     icon: '❤️', name: 'Armor Plating',   desc: '+25 max HP and heal 25',          apply: () => { player.maxHp += 25; heal(25); } },
  { id: 'pierce', icon: '🗡️', name: 'Piercing Rounds', desc: 'Bullets pass through +1 enemy',   max: 4, apply: () => { stats.pierce++; } },
  { id: 'multi',  icon: '🔱', name: 'Split Shot',      desc: '+1 extra bullet per shot',        max: 3, apply: () => { stats.multi++; } },
  { id: 'dash',   icon: '💨', name: 'Quick Step',      desc: 'Dash recharges 30% faster',       max: 3, apply: () => { stats.dashCd *= 0.7; } },
  { id: 'magnet', icon: '🧲', name: 'Magnet',          desc: 'Grab pickups from further away',  max: 3, apply: () => { stats.magnet += 90; } },
  { id: 'vamp',   icon: '🩸', name: 'Vampire',         desc: 'Heal 2 HP per kill',              max: 3, apply: () => { stats.vamp += 2; } },
  { id: 'heal',   icon: '💊', name: 'Med Kit',         desc: 'Restore all HP',
    when: () => player.hp < player.maxHp * 0.7, apply: () => heal(player.maxHp) },
];

// Multipliers applied on top of the base numbers above. Hard = the original balance.
const DIFFICULTIES = {
  easy:   { label: 'Easy',   desc: 'Relaxed – more health, slower enemies',   playerHp: 150, enemyHp: 0.7,  enemyDmg: 0.5,  enemySpeed: 0.85, spawn: 1.35, bulletSpeed: 0.8, fire: 1.4, waveHeal: 30, score: 0.75 },
  normal: { label: 'Normal', desc: 'Balanced challenge',                       playerHp: 120, enemyHp: 0.85, enemyDmg: 0.65, enemySpeed: 0.92, spawn: 1.15, bulletSpeed: 0.85, fire: 1.3, waveHeal: 20, score: 1 },
  hard:   { label: 'Hard',   desc: 'Tough enemies, x1.5 score',                playerHp: 100, enemyHp: 1,    enemyDmg: 1,    enemySpeed: 1,    spawn: 1,    bulletSpeed: 1,   fire: 1,   waveHeal: 15, score: 1.5 },
};

// ---------- helpers ----------

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function storageGet(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode etc. */ }
}

function setText(el, value) {
  const v = String(value);
  if (el._v !== v) { el._v = v; el.textContent = v; }
}
function setWidth(el, frac) {
  const v = `${Math.round(clamp(frac, 0, 1) * 1000) / 10}%`;
  if (el._w !== v) { el._w = v; el.style.width = v; }
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 1800);
}

function banner(text, boss = false) {
  const el = $('banner');
  el.textContent = text;
  el.classList.toggle('boss', boss);
  el.classList.remove('show');
  void el.offsetWidth; // restart the animation
  el.classList.add('show');
}

// Push a circle out of every obstacle; returns the last collision normal (or null).
function collideObstacles(o) {
  let normal = null;
  for (const b of OBSTACLES) {
    const cx = clamp(o.x, b.x, b.x + b.w);
    const cy = clamp(o.y, b.y, b.y + b.h);
    let dx = o.x - cx;
    let dy = o.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= o.r * o.r) continue;
    if (d2 === 0) {
      // Centre is inside the box: leave through the nearest edge.
      const edges = [
        [o.x - b.x, -1, 0], [b.x + b.w - o.x, 1, 0],
        [o.y - b.y, 0, -1], [b.y + b.h - o.y, 0, 1],
      ].sort((p, q) => p[0] - q[0]);
      const [, nx, ny] = edges[0];
      if (nx) o.x = nx < 0 ? b.x - o.r : b.x + b.w + o.r;
      else o.y = ny < 0 ? b.y - o.r : b.y + b.h + o.r;
      normal = { x: nx, y: ny };
    } else {
      const d = Math.sqrt(d2);
      dx /= d; dy /= d;
      o.x = cx + dx * o.r;
      o.y = cy + dy * o.r;
      normal = { x: dx, y: dy };
    }
  }
  return normal;
}

function insideObstacle(x, y, pad = 0) {
  return OBSTACLES.some((b) => x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad);
}

function clampToArena(o) {
  o.x = clamp(o.x, o.r, ARENA.w - o.r);
  o.y = clamp(o.y, o.r, ARENA.h - o.r);
}

// ---------- audio (synthesised, no files) ----------

let actx = null;
let noiseBuffer = null;
let muted = storageGet('neon-muted', false);
const lastSfx = {};

function initAudio() {
  if (!actx) {
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      noiseBuffer = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    } catch { actx = null; }
  }
  if (actx && actx.state === 'suspended') actx.resume();
}

function tone(freq, freqEnd, dur, type, vol) {
  const t = actx.currentTime;
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(actx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function noise(dur, vol, cutoff) {
  const t = actx.currentTime;
  const src = actx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = actx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cutoff, t);
  filter.frequency.exponentialRampToValueAtTime(60, t + dur);
  const gain = actx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(actx.destination);
  src.start(t);
  src.stop(t + dur);
}

const SFX = {
  pistol:  () => tone(700, 180, 0.08, 'square', 0.035),
  smg:     () => tone(900, 300, 0.05, 'square', 0.025),
  shotgun: () => noise(0.25, 0.25, 3000),
  rail:    () => tone(1600, 90, 0.25, 'sawtooth', 0.05),
  rocket:  () => tone(200, 60, 0.3, 'sawtooth', 0.06),
  enemyShot: () => tone(400, 250, 0.1, 'triangle', 0.03),
  hit:     () => tone(300, 120, 0.05, 'square', 0.02),
  kill:    () => { tone(500, 80, 0.15, 'triangle', 0.06); noise(0.12, 0.08, 1800); },
  boom:    () => noise(0.6, 0.4, 1200),
  hurt:    () => { tone(180, 50, 0.3, 'sawtooth', 0.1); noise(0.2, 0.15, 800); },
  pickup:  () => { tone(600, 1200, 0.12, 'sine', 0.08); },
  dash:    () => noise(0.15, 0.1, 4000),
  wave:    () => { tone(300, 600, 0.2, 'square', 0.05); setTimeout(() => actx && tone(600, 900, 0.25, 'square', 0.05), 150); },
  boss:    () => { tone(120, 60, 0.9, 'sawtooth', 0.12); },
};

function sfx(name) {
  if (muted || !actx) return;
  const now = performance.now();
  if (now - (lastSfx[name] || 0) < 35) return; // avoid stacking identical sounds
  lastSfx[name] = now;
  SFX[name]();
}

// ---------- canvas + camera ----------

const canvas = $('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1, zoom = 1;
const cam = { x: ARENA.w / 2, y: ARENA.h / 2, shake: 0, sx: 0, sy: 0 };

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  zoom = Math.min(W, H) / VIEW_MIN;
}
window.addEventListener('resize', resize);
resize();

const screenToWorld = (sx, sy) => ({ x: (sx - W / 2) / zoom + cam.x, y: (sy - H / 2) / zoom + cam.y });
const worldToScreen = (wx, wy) => ({ x: (wx - cam.x) * zoom + W / 2, y: (wy - cam.y) * zoom + H / 2 });

function shake(amount) { cam.shake = Math.max(cam.shake, amount); }

// ---------- input ----------

const keys = new Set();
const mouse = { x: 0, y: 0, down: false };
let touchMode = false;
const moveStick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const aimStick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };

function enableTouchMode() {
  if (touchMode) return;
  touchMode = true;
  document.body.classList.add('touch');
  if (state === 'playing') $('dashBtn').hidden = false;
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === ' ' || k === 'shift') { e.preventDefault(); if (state === 'playing') tryDash(); }
  if ((k === 'p' || k === 'escape') && (state === 'playing' || state === 'paused')) togglePause();
  if (state === 'upgrade' && ['1', '2', '3'].includes(k)) chooseUpgrade(Number(k) - 1);
  if (state === 'menu' && k === 'enter') startGame();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });

canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { mouse.down = true; initAudio(); } });
window.addEventListener('mouseup', () => { mouse.down = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function stickVector(s) {
  if (s.id === null) return { x: 0, y: 0, mag: 0 };
  let dx = (s.x - s.ox) / STICK_RADIUS;
  let dy = (s.y - s.oy) / STICK_RADIUS;
  const mag = Math.hypot(dx, dy);
  if (mag > 1) { dx /= mag; dy /= mag; }
  return { x: dx, y: dy, mag: Math.min(1, mag) };
}

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  enableTouchMode();
  initAudio();
  for (const t of e.changedTouches) {
    const stick = t.clientX < W / 2 ? moveStick : aimStick;
    if (stick.id !== null) continue;
    stick.id = t.identifier;
    stick.ox = stick.x = t.clientX;
    stick.oy = stick.y = t.clientY;
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    for (const stick of [moveStick, aimStick]) {
      if (stick.id !== t.identifier) continue;
      stick.x = t.clientX;
      stick.y = t.clientY;
      // Let the stick base follow the thumb so it never "runs out" of range.
      const dx = stick.x - stick.ox, dy = stick.y - stick.oy;
      const d = Math.hypot(dx, dy);
      if (d > STICK_RADIUS * 1.4) {
        stick.ox = stick.x - (dx / d) * STICK_RADIUS * 1.4;
        stick.oy = stick.y - (dy / d) * STICK_RADIUS * 1.4;
      }
    }
  }
}, { passive: false });

function endTouch(e) {
  for (const t of e.changedTouches) {
    if (moveStick.id === t.identifier) moveStick.id = null;
    if (aimStick.id === t.identifier) aimStick.id = null;
  }
}
canvas.addEventListener('touchend', endTouch);
canvas.addEventListener('touchcancel', endTouch);

// ---------- game state ----------

let state = 'menu'; // menu | playing | upgrade | paused | over
let player, stats, enemies, bullets, enemyBullets, pickups, particles, texts, warnings;
let wave, spawnQueue, spawnTimer, waveClearTimer, score, kills, combo, comboTimer, timeScale, slowmoTimer, hurtFlash;
let upgradeChoices = [];
let upgradeLevels = {};
let nextId = 1;
let difficulty = DIFFICULTIES[storageGet('neon-difficulty', 'normal')] ? storageGet('neon-difficulty', 'normal') : 'normal';
let diff = DIFFICULTIES[difficulty];
const bests = storageGet('neon-bests', null) || { hard: storageGet('neon-best', { score: 0, wave: 0 }) };
const bestFor = (d) => bests[d] || { score: 0, wave: 0 };

function resetGame() {
  player = {
    x: ARENA.w / 2, y: ARENA.h / 2, r: 17,
    hp: diff.playerHp, maxHp: diff.playerHp, angle: 0,
    weapon: 'pistol', ammo: Infinity, fireCd: 0,
    invuln: 0, dashTime: 0, dashCd: 0, dashDir: { x: 1, y: 0 },
    kx: 0, ky: 0,
  };
  stats = { dmg: 1, rate: 1, speed: 1, pierce: 0, multi: 0, dashCd: 1.2, magnet: 70, vamp: 0 };
  enemies = []; bullets = []; enemyBullets = []; pickups = []; particles = []; texts = []; warnings = [];
  wave = 0; spawnQueue = []; spawnTimer = 0; waveClearTimer = 0;
  score = 0; kills = 0; combo = 0; comboTimer = 0;
  timeScale = 1; slowmoTimer = 0; hurtFlash = 0;
  upgradeLevels = {};
  cam.x = player.x; cam.y = player.y; cam.shake = 0;
}

function showOnly(id) {
  for (const o of ['menu', 'upgrade', 'pause', 'over']) $(o).hidden = o !== id;
  const inGame = id === null || id === 'pause' || id === 'upgrade';
  $('hud').hidden = !inGame;
  $('cornerButtons').hidden = !inGame;
  $('dashBtn').hidden = !(touchMode && id === null);
}

function startGame() {
  initAudio();
  diff = DIFFICULTIES[difficulty];
  resetGame();
  state = 'playing';
  showOnly(null);
  startWave(1);
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    showOnly('pause');
  } else if (state === 'paused') {
    state = 'playing';
    showOnly(null);
  }
}

// ---------- waves ----------

function pickEnemyType(n) {
  const r = Math.random();
  if (n >= 4 && r < 0.12) return 'tank';
  if (n >= 3 && r < 0.32) return 'shooter';
  if (n >= 2 && r < 0.55) return 'runner';
  return 'grunt';
}

function startWave(n) {
  wave = n;
  const isBoss = n % 5 === 0;
  const count = isBoss ? 4 + n : 6 + Math.floor(n * 2.5);
  spawnQueue = Array.from({ length: count }, () => pickEnemyType(n));
  if (isBoss) spawnQueue.unshift('boss');
  spawnTimer = 1.2;
  if (isBoss) { banner(`BOSS · WAVE ${n}`, true); sfx('boss'); }
  else { banner(`WAVE ${n}`); sfx('wave'); }
}

function spawnPosition() {
  for (let i = 0; i < 30; i++) {
    const a = rand(0, Math.PI * 2);
    const d = rand(480, 800);
    const x = player.x + Math.cos(a) * d;
    const y = player.y + Math.sin(a) * d;
    if (x < 60 || y < 60 || x > ARENA.w - 60 || y > ARENA.h - 60) continue;
    if (insideObstacle(x, y, 60)) continue;
    return { x, y };
  }
  return { x: rand(100, ARENA.w - 100), y: 80 };
}

function updateSpawning(dt) {
  for (const w of warnings) {
    w.t -= dt;
    if (w.t <= 0) spawnEnemy(w.type, w.x, w.y);
  }
  warnings = warnings.filter((w) => w.t > 0);

  if (!spawnQueue.length) return;
  spawnTimer -= dt;
  if (spawnTimer > 0 || enemies.length >= 36 + wave * 2) return;
  const type = spawnQueue.shift();
  const pos = spawnPosition();
  warnings.push({ type, x: pos.x, y: pos.y, t: type === 'boss' ? 1.4 : 0.8 });
  spawnTimer = Math.max(0.28, 1.1 - wave * 0.05) * diff.spawn;
}

function spawnEnemy(type, x, y) {
  const t = ENEMIES[type];
  const hpScale = type === 'boss' ? wave / 5 : 1 + 0.12 * (wave - 1);
  const hp = Math.round(t.hp * hpScale * diff.enemyHp);
  enemies.push({
    id: nextId++, type, x, y, r: t.r,
    hp, maxHp: hp, speed: t.speed * (1 + Math.min(0.3, wave * 0.015)) * diff.enemySpeed,
    kx: 0, ky: 0, flash: 0, angle: 0,
    fireCd: rand(1, 2.5), pattern: 0, strafe: Math.random() < 0.5 ? -1 : 1, wobble: rand(0, 10),
  });
  burst(x, y, t.color, 14, 220);
}

function checkWaveCleared(dt) {
  if (waveClearTimer > 0) {
    waveClearTimer -= dt;
    if (waveClearTimer <= 0) openUpgrades();
    return;
  }
  if (!spawnQueue.length && !warnings.length && !enemies.length) {
    waveClearTimer = 1.4;
    enemyBullets = [];
    heal(diff.waveHeal);
    floatText(player.x, player.y - 30, `+${diff.waveHeal} HP`, '#39ff88');
    banner('WAVE CLEARED');
    sfx('wave');
  }
}

// ---------- upgrades ----------

function openUpgrades() {
  const available = UPGRADES.filter((u) =>
    (!u.max || (upgradeLevels[u.id] || 0) < u.max) && (!u.when || u.when()));
  upgradeChoices = available.sort(() => Math.random() - 0.5).slice(0, 3);
  const box = $('upgradeChoices');
  box.innerHTML = '';
  upgradeChoices.forEach((u, i) => {
    const btn = document.createElement('button');
    btn.className = 'upgrade-card';
    const lvl = upgradeLevels[u.id] || 0;
    btn.innerHTML = `<span class="icon">${u.icon}</span><span class="name"></span><span class="desc"></span>
      <span class="key">${lvl ? `Level ${lvl + 1} · ` : ''}press ${i + 1}</span>`;
    btn.querySelector('.name').textContent = u.name;
    btn.querySelector('.desc').textContent = u.desc;
    btn.addEventListener('click', () => chooseUpgrade(i));
    box.appendChild(btn);
  });
  $('upgradeTitle').textContent = `WAVE ${wave} CLEARED`;
  state = 'upgrade';
  mouse.down = false;
  moveStick.id = aimStick.id = null;
  showOnly('upgrade');
}

function chooseUpgrade(i) {
  const u = upgradeChoices[i];
  if (!u || state !== 'upgrade') return;
  u.apply();
  upgradeLevels[u.id] = (upgradeLevels[u.id] || 0) + 1;
  sfx('pickup');
  state = 'playing';
  showOnly(null);
  startWave(wave + 1);
}

// ---------- player ----------

function heal(amount) {
  player.hp = Math.min(player.maxHp, player.hp + amount);
}

function tryDash() {
  if (player.dashCd > 0) return;
  const mv = moveInput();
  const dir = mv.mag > 0.1 ? { x: mv.x / mv.mag, y: mv.y / mv.mag } : { x: Math.cos(player.angle), y: Math.sin(player.angle) };
  player.dashDir = dir;
  player.dashTime = 0.16;
  player.dashCd = stats.dashCd;
  sfx('dash');
}

function moveInput() {
  let x = 0, y = 0;
  if (keys.has('w') || keys.has('arrowup')) y -= 1;
  if (keys.has('s') || keys.has('arrowdown')) y += 1;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  const s = stickVector(moveStick);
  if (s.mag > 0.15) { x = s.x; y = s.y; }
  const mag = Math.hypot(x, y);
  if (mag > 1) { x /= mag; y /= mag; }
  return { x, y, mag: Math.min(1, mag) };
}

function updatePlayer(dt) {
  const p = player;
  p.invuln -= dt;
  p.dashCd -= dt;
  p.fireCd -= dt;

  const mv = moveInput();
  if (p.dashTime > 0) {
    p.dashTime -= dt;
    p.x += p.dashDir.x * 950 * dt;
    p.y += p.dashDir.y * 950 * dt;
    particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: '#00f0ff', size: p.r * 0.9 });
  } else {
    const speed = 290 * stats.speed;
    p.x += (mv.x * speed + p.kx) * dt;
    p.y += (mv.y * speed + p.ky) * dt;
  }
  const decay = Math.exp(-10 * dt);
  p.kx *= decay; p.ky *= decay;
  collideObstacles(p);
  clampToArena(p);

  // Aim + fire
  let firing = false;
  if (touchMode) {
    const a = stickVector(aimStick);
    if (a.mag > 0.25) { p.angle = Math.atan2(a.y, a.x); firing = true; }
    else if (mv.mag > 0.1) p.angle = Math.atan2(mv.y, mv.x);
  }
  if (!touchMode || mouse.down) {
    const m = screenToWorld(mouse.x, mouse.y);
    p.angle = Math.atan2(m.y - p.y, m.x - p.x);
    firing = firing || mouse.down;
  }
  if (firing && p.fireCd <= 0) shoot();
}

function shoot() {
  const p = player;
  const w = WEAPONS[p.weapon];
  const shots = w.count + stats.multi;
  const fan = shots > 1 ? Math.max(w.spread, 0.12 * (shots - 1)) : 0;
  for (let i = 0; i < shots; i++) {
    const base = shots > 1 ? p.angle - fan / 2 + (fan * i) / (shots - 1) : p.angle;
    const a = base + (Math.random() - 0.5) * (shots > 1 ? w.spread * 0.25 : w.spread);
    const speed = w.speed * rand(0.92, 1.05);
    bullets.push({
      x: p.x + Math.cos(p.angle) * 26, y: p.y + Math.sin(p.angle) * 26,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      r: w.size, dmg: w.dmg * stats.dmg, life: 1.1,
      pierce: (w.pierce || 0) + stats.pierce, hit: new Set(),
      color: w.color, explode: w.explode || 0,
    });
  }
  p.fireCd = w.rate / stats.rate;
  // Muzzle flash + recoil
  for (let i = 0; i < 4; i++) {
    const a = p.angle + rand(-0.4, 0.4);
    particles.push({ x: p.x + Math.cos(p.angle) * 28, y: p.y + Math.sin(p.angle) * 28,
      vx: Math.cos(a) * rand(100, 300), vy: Math.sin(a) * rand(100, 300), life: 0.08, max: 0.08, color: w.color, size: 4 });
  }
  const recoil = p.weapon === 'shotgun' ? 160 : p.weapon === 'rocket' ? 120 : 20;
  p.kx -= Math.cos(p.angle) * recoil;
  p.ky -= Math.sin(p.angle) * recoil;
  if (p.weapon === 'shotgun' || p.weapon === 'rocket' || p.weapon === 'rail') shake(5);
  sfx(p.weapon);

  if (p.ammo !== Infinity && --p.ammo <= 0) {
    p.weapon = 'pistol';
    p.ammo = Infinity;
    floatText(p.x, p.y - 30, 'OUT OF AMMO', '#ff4d6d');
  }
}

function hurtPlayer(dmg, fromX, fromY) {
  const p = player;
  if (p.invuln > 0 || p.dashTime > 0 || state !== 'playing') return;
  p.hp -= dmg * diff.enemyDmg;
  p.invuln = 0.7;
  hurtFlash = 0.35;
  shake(12);
  const a = Math.atan2(p.y - fromY, p.x - fromX);
  p.kx += Math.cos(a) * 420;
  p.ky += Math.sin(a) * 420;
  burst(p.x, p.y, '#ff2e63', 16, 260);
  sfx('hurt');
  if (navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate(40);
  if (p.hp <= 0) gameOver();
}

// ---------- enemies ----------

function updateEnemies(dt) {
  const p = player;
  for (const e of enemies) {
    const t = ENEMIES[e.type];
    e.flash -= dt;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    let mx = dx / d, my = dy / d;
    e.angle = Math.atan2(dy, dx);

    if (e.type === 'runner') {
      // Zig-zag so they're harder to hit.
      e.wobble += dt * 6;
      const s = Math.sin(e.wobble) * 0.6;
      [mx, my] = [mx - my * s, my + mx * s];
    } else if (e.type === 'shooter') {
      if (d < 280) { mx = -mx; my = -my; }
      else if (d < 430) { [mx, my] = [-my * e.strafe, mx * e.strafe]; }
      e.fireCd -= dt;
      if (e.fireCd <= 0 && d < 680) {
        fireEnemyBullet(e, e.angle, 330, t.dmg);
        e.fireCd = rand(1.6, 2.4) * diff.fire;
      }
    } else if (e.type === 'boss') {
      e.fireCd -= dt;
      if (e.fireCd <= 0) {
        if (e.pattern % 2 === 0) {
          const n = 18, off = rand(0, 1);
          for (let i = 0; i < n; i++) fireEnemyBullet(e, off + (i / n) * Math.PI * 2, 250, 12);
        } else {
          for (let i = -2; i <= 2; i++) fireEnemyBullet(e, e.angle + i * 0.16, 360, 12);
        }
        e.pattern++;
        // Fires faster when hurt, and later bosses fire faster overall.
        const base = Math.max(1.6, 2.6 - (wave / 5 - 1) * 0.3);
        e.fireCd = (e.hp < e.maxHp / 2 ? base * 0.65 : base) * diff.fire;
      }
    }

    // Keep enemies from stacking on top of each other.
    for (const o of enemies) {
      if (o === e) continue;
      const ox = e.x - o.x, oy = e.y - o.y;
      const min = e.r + o.r;
      const d2 = ox * ox + oy * oy;
      if (d2 > 0 && d2 < min * min) {
        const od = Math.sqrt(d2);
        const push = ((min - od) / od) * 0.5 * (ENEMIES[o.type].mass / (t.mass + ENEMIES[o.type].mass)) * 2;
        e.x += ox * push;
        e.y += oy * push;
      }
    }

    e.x += (mx * e.speed + e.kx) * dt;
    e.y += (my * e.speed + e.ky) * dt;
    const decay = Math.exp(-8 * dt);
    e.kx *= decay; e.ky *= decay;

    const normal = collideObstacles(e);
    if (normal) {
      // Slide around the obstacle toward the player instead of getting stuck.
      let tx = -normal.y, ty = normal.x;
      const dot = tx * dx + ty * dy;
      if (dot < 0 || (Math.abs(dot) < 1 && e.id % 2)) { tx = -tx; ty = -ty; }
      e.x += tx * e.speed * dt;
      e.y += ty * e.speed * dt;
    }
    clampToArena(e);

    if (d < e.r + p.r) {
      hurtPlayer(t.dmg, e.x, e.y);
      e.kx -= mx * 300 / t.mass;
      e.ky -= my * 300 / t.mass;
    }
  }
}

function fireEnemyBullet(e, angle, speed, dmg) {
  enemyBullets.push({
    x: e.x + Math.cos(angle) * e.r, y: e.y + Math.sin(angle) * e.r,
    vx: Math.cos(angle) * speed * diff.bulletSpeed, vy: Math.sin(angle) * speed * diff.bulletSpeed,
    r: e.type === 'boss' ? 9 : 7, dmg, life: 4,
  });
  sfx('enemyShot');
}

function damageEnemy(e, dmg, dirX, dirY) {
  if (e.dead) return;
  const t = ENEMIES[e.type];
  e.hp -= dmg;
  e.flash = 0.07;
  e.kx += dirX * (dmg * 9) / t.mass;
  e.ky += dirY * (dmg * 9) / t.mass;
  sfx('hit');
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  e.dead = true;
  const t = ENEMIES[e.type];
  kills++;
  combo++;
  comboTimer = 2.5;
  const mult = comboMultiplier();
  const pts = Math.round(t.score * mult * diff.score);
  score += pts;
  floatText(e.x, e.y - e.r, `+${pts}`, mult > 1 ? '#ffe66d' : '#ffffff');
  burst(e.x, e.y, t.color, e.type === 'boss' ? 80 : 18, e.type === 'boss' ? 600 : 320);
  if (stats.vamp) heal(stats.vamp);
  sfx('kill');

  if (e.type === 'boss') {
    shake(28);
    slowmoTimer = 0.8;
    sfx('boom');
    dropPickup(e.x - 30, e.y, 'health');
    dropPickup(e.x + 30, e.y, DROP_WEAPONS[Math.floor(Math.random() * DROP_WEAPONS.length)]);
  } else {
    shake(e.type === 'tank' ? 8 : 3);
    const r = Math.random();
    if (r < 0.06) dropPickup(e.x, e.y, DROP_WEAPONS[Math.floor(Math.random() * DROP_WEAPONS.length)]);
    else if (r < 0.11) dropPickup(e.x, e.y, 'health');
  }
}

function comboMultiplier() {
  return Math.min(4, 1 + Math.floor(combo / 5) * 0.5);
}

function explode(x, y, radius, dmg) {
  for (const e of enemies) {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < radius + e.r) {
      const falloff = 1 - Math.min(1, d / (radius + e.r)) * 0.5;
      damageEnemy(e, dmg * falloff, (e.x - x) / (d || 1), (e.y - y) / (d || 1));
    }
  }
  burst(x, y, '#ff9f1c', 34, 420);
  burst(x, y, '#ff5d8f', 16, 250);
  particles.push({ x, y, vx: 0, vy: 0, life: 0.18, max: 0.18, color: '#ffffff', size: radius * 0.8, ring: true });
  shake(14);
  sfx('boom');
}

// ---------- bullets, pickups, effects ----------

function updateBullets(dt) {
  for (const b of bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.x < 0 || b.y < 0 || b.x > ARENA.w || b.y > ARENA.h || insideObstacle(b.x, b.y, b.r)) {
      if (b.explode) explode(b.x, b.y, b.explode, b.dmg * 2);
      else burst(b.x, b.y, b.color, 4, 120);
      b.life = 0;
      continue;
    }
    for (const e of enemies) {
      if (e.dead || b.hit.has(e.id)) continue;
      const dx = e.x - b.x, dy = e.y - b.y;
      if (dx * dx + dy * dy > (e.r + b.r) ** 2) continue;
      const sp = Math.hypot(b.vx, b.vy);
      if (b.explode) {
        explode(b.x, b.y, b.explode, b.dmg * 2);
        b.life = 0;
        break;
      }
      damageEnemy(e, b.dmg, b.vx / sp, b.vy / sp);
      burst(b.x, b.y, ENEMIES[e.type].color, 5, 160);
      b.hit.add(e.id);
      if (b.pierce-- <= 0) { b.life = 0; break; }
    }
  }
  bullets = bullets.filter((b) => b.life > 0);
  enemies = enemies.filter((e) => !e.dead);

  for (const b of enemyBullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.x < 0 || b.y < 0 || b.x > ARENA.w || b.y > ARENA.h || insideObstacle(b.x, b.y, b.r)) { b.life = 0; continue; }
    if (Math.hypot(player.x - b.x, player.y - b.y) < player.r + b.r - 3) {
      hurtPlayer(b.dmg, b.x, b.y);
      if (player.dashTime <= 0) b.life = 0;
    }
  }
  enemyBullets = enemyBullets.filter((b) => b.life > 0);
}

function dropPickup(x, y, kind) {
  pickups.push({ x, y, r: 16, kind, life: 12, bob: rand(0, 6) });
}

function updatePickups(dt) {
  const p = player;
  for (const k of pickups) {
    k.life -= dt;
    k.bob += dt * 4;
    const d = dist(k, p);
    if (d < stats.magnet + p.r) {
      const pull = 500 * dt;
      k.x += ((p.x - k.x) / d) * pull;
      k.y += ((p.y - k.y) / d) * pull;
    }
    if (d < p.r + k.r) {
      k.life = 0;
      sfx('pickup');
      if (k.kind === 'health') {
        heal(30);
        floatText(p.x, p.y - 30, '+30 HP', '#39ff88');
      } else {
        const w = WEAPONS[k.kind];
        p.weapon = k.kind;
        p.ammo = w.ammo;
        floatText(p.x, p.y - 30, w.name.toUpperCase(), w.color);
      }
      burst(k.x, k.y, '#ffffff', 10, 200);
    }
  }
  pickups = pickups.filter((k) => k.life > 0);
}

function burst(x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(speed * 0.3, speed);
    const life = rand(0.25, 0.6);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size: rand(2, 4.5) });
  }
  if (particles.length > 900) particles.splice(0, particles.length - 900);
}

function floatText(x, y, text, color) {
  texts.push({ x, y, text, color, life: 0.9 });
}

function updateEffects(dt) {
  for (const pt of particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    const f = Math.exp(-4 * dt);
    pt.vx *= f; pt.vy *= f;
  }
  particles = particles.filter((pt) => pt.life > 0);
  for (const t of texts) { t.life -= dt; t.y -= 40 * dt; }
  texts = texts.filter((t) => t.life > 0);
}

// ---------- main update ----------

function update(rawDt) {
  if (slowmoTimer > 0) { slowmoTimer -= rawDt; timeScale = 0.3; } else timeScale = 1;
  const dt = rawDt * timeScale;

  hurtFlash = Math.max(0, hurtFlash - rawDt);
  if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }

  updatePlayer(dt);
  if (waveClearTimer <= 0) updateSpawning(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updatePickups(dt);
  updateEffects(dt);
  if (state === 'playing') checkWaveCleared(dt);
  updateCamera(rawDt);
  updateHud();
}

function updateCamera(dt) {
  const k = 1 - Math.exp(-8 * dt);
  cam.x += (player.x - cam.x) * k;
  cam.y += (player.y - cam.y) * k;
  cam.shake = Math.max(0, cam.shake - 60 * dt);
  cam.sx = rand(-1, 1) * cam.shake;
  cam.sy = rand(-1, 1) * cam.shake;
}

function updateHud() {
  setText($('hpText'), Math.max(0, Math.ceil(player.hp)));
  setWidth($('hpFill'), player.hp / player.maxHp);
  setText($('weaponName'), WEAPONS[player.weapon].name);
  setText($('ammo'), player.ammo === Infinity ? '∞' : player.ammo);
  const dashFrac = 1 - Math.max(0, player.dashCd) / stats.dashCd;
  setWidth($('dashFill'), dashFrac);
  $('dashBtn').classList.toggle('cooling', dashFrac < 1);
  setText($('waveText'), `WAVE ${wave}`);
  const left = enemies.length + spawnQueue.length + warnings.length;
  setText($('enemiesText'), left ? `${left} enemies left` : '');
  setText($('scoreText'), score.toLocaleString());
  const mult = comboMultiplier();
  setText($('comboText'), combo >= 3 ? `${combo} combo${mult > 1 ? ` · x${mult}` : ''}` : '');
  const boss = enemies.find((e) => e.type === 'boss');
  $('bossBar').hidden = !boss;
  if (boss) setWidth($('bossFill'), boss.hp / boss.maxHp);
}

// ---------- rendering ----------

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#070a14';
  ctx.fillRect(0, 0, W, H);

  const z = zoom * DPR;
  ctx.setTransform(z, 0, 0, z, DPR * (W / 2 - (cam.x + cam.sx) * zoom), DPR * (H / 2 - (cam.y + cam.sy) * zoom));

  drawFloor();
  drawObstacles();
  drawWarnings();
  drawPickups();
  for (const e of enemies) drawEnemy(e);
  if (state !== 'over' || player.hp > 0) drawPlayer();

  ctx.globalCompositeOperation = 'lighter';
  for (const b of bullets) drawGlowDot(b.x, b.y, b.r, b.color);
  for (const b of enemyBullets) drawGlowDot(b.x, b.y, b.r, '#ff3864');
  for (const pt of particles) {
    const a = pt.life / pt.max;
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    if (pt.ring) {
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = 6;
      ctx.arc(pt.x, pt.y, pt.size * (1.4 - a), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.arc(pt.x, pt.y, pt.size * (0.5 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  ctx.textAlign = 'center';
  ctx.font = 'bold 18px system-ui, sans-serif';
  for (const t of texts) {
    ctx.globalAlpha = Math.min(1, t.life * 2);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  // Screen-space overlays
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (state === 'playing' || state === 'paused') drawOffscreenIndicators();
  if (touchMode && state === 'playing') { drawStick(moveStick); drawStick(aimStick); }
  drawVignette();
}

function drawFloor() {
  const tl = screenToWorld(0, 0), br = screenToWorld(W, H);
  const step = 80;
  ctx.strokeStyle = 'rgba(80, 120, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = Math.max(0, Math.floor(tl.x / step) * step); x <= Math.min(ARENA.w, br.x); x += step) {
    ctx.moveTo(x, Math.max(0, tl.y)); ctx.lineTo(x, Math.min(ARENA.h, br.y));
  }
  for (let y = Math.max(0, Math.floor(tl.y / step) * step); y <= Math.min(ARENA.h, br.y); y += step) {
    ctx.moveTo(Math.max(0, tl.x), y); ctx.lineTo(Math.min(ARENA.w, br.x), y);
  }
  ctx.stroke();

  ctx.save();
  ctx.shadowColor = '#ff2e88';
  ctx.shadowBlur = 20;
  ctx.strokeStyle = '#ff2e88';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, ARENA.w, ARENA.h);
  ctx.restore();
}

function drawObstacles() {
  for (const b of OBSTACLES) {
    ctx.fillStyle = '#10163a';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#3d5afe';
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(61, 90, 254, 0.25)';
    ctx.strokeRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
  }
}

function drawWarnings() {
  for (const w of warnings) {
    const t = ENEMIES[w.type];
    const pulse = 0.5 + Math.sin(w.t * 25) * 0.5;
    ctx.strokeStyle = t.color;
    ctx.globalAlpha = 0.4 + pulse * 0.5;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w.x, w.y, t.r + 6 + pulse * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w.x - 8, w.y); ctx.lineTo(w.x + 8, w.y);
    ctx.moveTo(w.x, w.y - 8); ctx.lineTo(w.x, w.y + 8);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPickups() {
  for (const k of pickups) {
    if (k.life < 3 && Math.floor(k.life * 8) % 2) continue; // blink before vanishing
    const y = k.y + Math.sin(k.bob) * 4;
    ctx.save();
    ctx.translate(k.x, y);
    if (k.kind === 'health') {
      ctx.fillStyle = '#39ff88';
      ctx.shadowColor = '#39ff88';
      ctx.shadowBlur = 14;
      ctx.fillRect(-5, -14, 10, 28);
      ctx.fillRect(-14, -5, 28, 10);
    } else {
      const w = WEAPONS[k.kind];
      ctx.rotate(k.bob * 0.3);
      ctx.strokeStyle = w.color;
      ctx.shadowColor = w.color;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3;
      ctx.strokeRect(-14, -14, 28, 28);
      ctx.rotate(-k.bob * 0.3);
      ctx.shadowBlur = 0;
      ctx.fillStyle = w.color;
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(w.name[0], 0, 1);
    }
    ctx.restore();
  }
}

function drawEnemy(e) {
  const t = ENEMIES[e.type];
  const color = e.flash > 0 ? '#ffffff' : t.color;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (e.type === 'runner') {
    ctx.rotate(e.angle);
    ctx.moveTo(e.r + 4, 0);
    ctx.lineTo(-e.r, e.r * 0.85);
    ctx.lineTo(-e.r * 0.5, 0);
    ctx.lineTo(-e.r, -e.r * 0.85);
    ctx.closePath();
    ctx.fill();
  } else if (e.type === 'tank') {
    ctx.rotate(e.angle);
    ctx.rect(-e.r, -e.r, e.r * 2, e.r * 2);
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.fillRect(-e.r * 0.45, -e.r * 0.45, e.r * 0.9, e.r * 0.9);
  } else if (e.type === 'shooter') {
    ctx.rotate(e.angle);
    ctx.moveTo(e.r, 0); ctx.lineTo(0, e.r); ctx.lineTo(-e.r, 0); ctx.lineTo(0, -e.r);
    ctx.closePath();
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.fillRect(e.r * 0.3, -3, e.r * 0.9, 6);
  } else if (e.type === 'boss') {
    const spin = performance.now() / 600;
    ctx.rotate(spin);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const r = i % 2 ? e.r : e.r * 1.25;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.rotate(-spin);
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.rotate(e.angle);
    ctx.fillRect(e.r * 0.2, -4, 8, 8);
  }
  ctx.restore();

  if (e.type === 'tank' && e.hp < e.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.x - 24, e.y - e.r - 14, 48, 5);
    ctx.fillStyle = t.color;
    ctx.fillRect(e.x - 24, e.y - e.r - 14, 48 * (e.hp / e.maxHp), 5);
  }
}

function drawPlayer() {
  const p = player;
  if (p.invuln > 0 && Math.floor(p.invuln * 20) % 2) return; // blink while invulnerable
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 18;
  // Gun barrel
  ctx.rotate(p.angle);
  ctx.fillStyle = WEAPONS[p.weapon].color;
  const len = p.weapon === 'rail' ? 30 : p.weapon === 'shotgun' ? 24 : 22;
  ctx.fillRect(6, -4, len, 8);
  // Body
  ctx.fillStyle = '#0b1230';
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, p.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#00f0ff';
  ctx.beginPath();
  ctx.arc(6, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGlowDot(x, y, r, color) {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

function drawOffscreenIndicators() {
  const margin = 22;
  for (const e of enemies) {
    const s = worldToScreen(e.x, e.y);
    if (s.x > 0 && s.x < W && s.y > 0 && s.y < H) continue;
    const cx = W / 2, cy = H / 2;
    const a = Math.atan2(s.y - cy, s.x - cx);
    const scale = Math.min((W / 2 - margin) / Math.abs(Math.cos(a) || 1e-6), (H / 2 - margin) / Math.abs(Math.sin(a) || 1e-6));
    const x = cx + Math.cos(a) * scale, y = cy + Math.sin(a) * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = ENEMIES[e.type].color;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    const size = e.type === 'boss' ? 14 : 8;
    ctx.moveTo(size, 0); ctx.lineTo(-size, size * 0.8); ctx.lineTo(-size, -size * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawStick(s) {
  if (s.id === null) return;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(s.ox, s.oy, STICK_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  const v = stickVector(s);
  ctx.fillStyle = s === aimStick ? 'rgba(255,46,136,0.55)' : 'rgba(0,240,255,0.45)';
  ctx.beginPath();
  ctx.arc(s.ox + v.x * STICK_RADIUS, s.oy + v.y * STICK_RADIUS, 26, 0, Math.PI * 2);
  ctx.fill();
}

function drawVignette() {
  const low = player && state === 'playing' && player.hp / player.maxHp < 0.3;
  const alpha = Math.max(hurtFlash * 1.4, low ? 0.25 + Math.sin(performance.now() / 180) * 0.12 : 0);
  if (alpha <= 0) return;
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(255,0,60,0)');
  g.addColorStop(1, `rgba(255,0,60,${Math.min(0.6, alpha)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// ---------- game over + share ----------

function gameOver() {
  state = 'over';
  player.hp = 0;
  burst(player.x, player.y, '#00f0ff', 60, 500);
  shake(25);
  sfx('boom');
  $('dashBtn').hidden = true;
  const prev = bestFor(difficulty);
  const isRecord = score > prev.score;
  const best = bests[difficulty] = { score: Math.max(prev.score, score), wave: Math.max(prev.wave, wave) };
  storageSet('neon-bests', bests);
  setTimeout(() => {
    $('finalScore').textContent = score.toLocaleString();
    $('finalWave').textContent = wave;
    $('finalKills').textContent = kills;
    $('newRecord').hidden = !isRecord || score === 0;
    $('overBest').textContent = `${diff.label} best: ${best.score.toLocaleString()} · wave ${best.wave}`;
    showOnly('over');
  }, 1100);
}

async function shareScore() {
  const url = location.origin + location.pathname;
  const text = `🔫 I survived to wave ${wave} on ${diff.label} with ${score.toLocaleString()} points in Neon Arena! Can you beat me?\n${url}`;
  if (navigator.share && touchMode) {
    try { await navigator.share({ text }); return; } catch { /* cancelled */ }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard!');
  } catch {
    prompt('Copy your score:', text);
  }
}

// ---------- UI wiring ----------

function updateMenuBest() {
  const b = bestFor(difficulty);
  $('bestText').textContent = b.score ? `${DIFFICULTIES[difficulty].label} best: ${b.score.toLocaleString()} · wave ${b.wave}` : '';
}

function selectDifficulty(d) {
  difficulty = d;
  storageSet('neon-difficulty', d);
  for (const btn of document.querySelectorAll('#difficulty button')) {
    btn.setAttribute('aria-checked', String(btn.dataset.diff === d));
  }
  $('diffDesc').textContent = DIFFICULTIES[d].desc;
  updateMenuBest();
}

function updateMuteIcon() { $('muteBtn').textContent = muted ? '🔇' : '🔊'; }

$('playBtn').addEventListener('click', startGame);
for (const btn of document.querySelectorAll('#difficulty button')) {
  btn.addEventListener('click', () => selectDifficulty(btn.dataset.diff));
}
$('againBtn').addEventListener('click', startGame);
$('menuBtn').addEventListener('click', () => { state = 'menu'; selectDifficulty(difficulty); showOnly('menu'); });
$('resumeBtn').addEventListener('click', togglePause);
$('restartBtn').addEventListener('click', startGame);
$('pauseBtn').addEventListener('click', togglePause);
$('shareBtn').addEventListener('click', shareScore);
$('muteBtn').addEventListener('click', () => {
  muted = !muted;
  storageSet('neon-muted', muted);
  updateMuteIcon();
});
$('dashBtn').addEventListener('touchstart', (e) => { e.preventDefault(); tryDash(); }, { passive: false });
$('dashBtn').addEventListener('click', tryDash);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') togglePause();
});

// ---------- loop ----------

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state === 'playing') update(dt);
  else if (state === 'over') { updateEffects(dt); updateCamera(dt); }
  else if (state === 'menu') {
    // Slow drift behind the menu.
    cam.x = ARENA.w / 2 + Math.cos(now / 4000) * 300;
    cam.y = ARENA.h / 2 + Math.sin(now / 4000) * 300;
  }
  render();
  requestAnimationFrame(frame);
}

if (window.matchMedia('(pointer: coarse)').matches) enableTouchMode();
resetGame();
selectDifficulty(difficulty);
updateMuteIcon();
showOnly('menu');
requestAnimationFrame(frame);
