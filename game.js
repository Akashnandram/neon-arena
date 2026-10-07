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
  scrapper:{ name: 'Scrapper',rate: 0.11,  dmg: 11, speed: 1000, spread: 0.32, count: 3, ammo: 120, color: '#39ff88', size: 4 },
};
const DROP_WEAPONS = ['smg', 'shotgun', 'rail', 'rocket', 'scrapper'];

const ENEMIES = {
  grunt:   { r: 16, hp: 40,   speed: 125, dmg: 14, score: 10,  color: '#ff4d6d', mass: 1 },
  runner:  { r: 11, hp: 22,   speed: 235, dmg: 9,  score: 15,  color: '#ffd166', mass: 0.6 },
  shooter: { r: 15, hp: 50,   speed: 105, dmg: 12, score: 25,  color: '#4cc9f0', mass: 1 },
  tank:    { r: 28, hp: 240,  speed: 70,  dmg: 28, score: 40,  color: '#b15eff', mass: 4 },
  splitter:{ r: 20, hp: 90,   speed: 95,  dmg: 16, score: 30,  color: '#39ff88', mass: 1.6 },
  dasher:  { r: 13, hp: 55,   speed: 150, dmg: 18, score: 30,  color: '#ff9f1c', mass: 0.9 },
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
  { id: 'crit',   icon: '🎯', name: 'Deadeye',         desc: '+15% crit chance (2x dmg)',       max: 4, apply: () => { stats.crit += 0.15; } },
  { id: 'regen',  icon: '🌱', name: 'Regeneration',    desc: '+0.8 HP per second',              max: 3, apply: () => { stats.regen += 0.8; } },
  { id: 'blast',  icon: '💣', name: 'Blast Rounds',    desc: 'Bullets explode for 40 damage',   max: 3, apply: () => { stats.blast += 40; } },
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

// Cached DOM refs (perf: avoid getElementById every frame in updateHud)
const el = {};
function cacheDom() {
  for (const id of ['hpFill','hpText','weaponName','ammo','dashFill','dashBtn','waveText','enemiesText','bossBar','bossFill','bossName','scoreText','comboText','killsText','timeText','waveProgress','toast','banner','hud','cornerButtons','menu','upgrade','pause','over','upgradeChoices','upgradeTitle','buildRow','finalScore','finalWave','finalKills','finalTime','finalCombo','finalAccuracy','newRecord','overBest','muteBtn','playBtn','bestText','diffDesc','againBtn','menuBtn','resumeBtn','restartBtn','quitBtn','pauseBtn','shareBtn','muteBtn2','shakeToggle','autofireToggle','flashToggle']) {
    el[id] = document.getElementById(id);
  }
}

const reduceMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
const settings = {
  shake: storageGet('neon-shake', true),
  autofire: storageGet('neon-autofire', false),
  flash: storageGet('neon-flash', true),
};
function reduceMotion() { return reduceMotionQuery.matches || !settings.flash; }

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
  const t = el.toast || $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 1800);
}

function banner(text, boss = false) {
  const b = el.banner || $('banner');
  b.textContent = text;
  b.classList.toggle('boss', boss);
  b.classList.remove('show');
  void b.offsetWidth; // restart the animation
  b.classList.add('show');
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
  scrapper:() => { tone(650, 220, 0.07, 'square', 0.03); noise(0.08, 0.06, 2600); },
  shotgun: () => noise(0.25, 0.25, 3000),
  rail:    () => tone(1600, 90, 0.25, 'sawtooth', 0.05),
  rocket:  () => tone(200, 60, 0.3, 'sawtooth', 0.06),
  enemyShot: () => tone(400, 250, 0.1, 'triangle', 0.03),
  hit:     () => tone(300, 120, 0.05, 'square', 0.02),
  crit:    () => tone(1200, 2400, 0.12, 'square', 0.05),
  kill:    () => { tone(500, 80, 0.15, 'triangle', 0.06); noise(0.12, 0.08, 1800); },
  pop:     () => tone(400, 900, 0.12, 'sine', 0.07),
  telegraph: () => tone(200, 800, 0.25, 'sawtooth', 0.04),
  boom:    () => noise(0.6, 0.4, 1200),
  hurt:    () => { tone(180, 50, 0.3, 'sawtooth', 0.1); noise(0.2, 0.15, 800); },
  pickup:  () => { tone(600, 1200, 0.12, 'sine', 0.08); },
  dash:    () => noise(0.15, 0.1, 4000),
  wave:    () => { tone(300, 600, 0.2, 'square', 0.05); setTimeout(() => actx && !muted && tone(600, 900, 0.25, 'square', 0.05), 150); },
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
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  DPR = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
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

function shake(amount) {
  if (!settings.shake || reduceMotionQuery.matches) return;
  cam.shake = Math.max(cam.shake, amount);
}

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
  if (state === 'upgrade' && k === 'r') rerollUpgrades();
  if (state === 'playing' && (k === 'e' || k === 'x' || k === 'q')) dropWeapon();
  if (state === 'menu' && k === 'enter') startGame();
  if (state === 'over' && k === 'enter') startGame();
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
let player, stats, enemies, bullets, enemyBullets, pickups, particles, texts, warnings, rings, dust;
let wave, spawnQueue, spawnTimer, waveClearTimer, score, kills, combo, comboTimer, timeScale, slowmoTimer, hurtFlash;
let waveTotal, runTime, shotsFired, shotsHit, maxCombo, damageDealt, rerollsLeft, dashHitIds, tutorialStep;
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
  stats = { dmg: 1, rate: 1, speed: 1, pierce: 0, multi: 0, dashCd: 1.2, magnet: 70, vamp: 0, crit: 0.05, regen: 0, blast: 0 };
  enemies = []; bullets = []; enemyBullets = []; pickups = []; particles = []; texts = []; warnings = []; rings = [];
  dust = Array.from({ length: 90 }, () => ({ x: rand(0, ARENA.w), y: rand(0, ARENA.h), vx: rand(-12, 12), vy: rand(-12, 12), size: rand(1, 2.6), tw: rand(0, 6) }));
  wave = 0; spawnQueue = []; spawnTimer = 0; waveClearTimer = 0;
  score = 0; kills = 0; combo = 0; comboTimer = 0;
  timeScale = 1; slowmoTimer = 0; hurtFlash = 0;
  waveTotal = 1; runTime = 0; shotsFired = 0; shotsHit = 0; maxCombo = 0; damageDealt = 0;
  rerollsLeft = 1; dashHitIds = new Set(); tutorialStep = 0;
  upgradeLevels = {};
  cam.x = player.x; cam.y = player.y; cam.shake = 0;
}

function ring(x, y, color, maxR = 70, life = 0.4, width = 5) {
  if (reduceMotion()) life = Math.min(life, 0.2);
  rings.push({ x, y, color, r: 8, maxR, life, max: life, width });
}

function showOnly(id) {
  for (const o of ['menu', 'upgrade', 'pause', 'over']) (el[o] || $(o)).hidden = o !== id;
  const inGame = id === null || id === 'pause' || id === 'upgrade';
  (el.hud || $('hud')).hidden = !inGame;
  (el.cornerButtons || $('cornerButtons')).hidden = !inGame;
  (el.dashBtn || $('dashBtn')).hidden = !(touchMode && id === null);
}

function startGame() {
  initAudio();
  diff = DIFFICULTIES[difficulty];
  resetGame();
  state = 'playing';
  showOnly(null);
  startWave(1);
  tutorial(0);
}

function tutorial(step) {
  if (step !== tutorialStep) return;
  const msgs = touchMode
    ? ['Left thumb to move', 'Right thumb to aim & shoot', 'Dash through enemies to hurt them!']
    : ['WASD to move · Click to shoot', 'SPACE to dash — dashing damages enemies!', 'E drops your weapon · R rerolls upgrades'];
  if (step < msgs.length) {
    toast(msgs[step]);
    tutorialStep++;
    setTimeout(() => { if (state === 'playing') tutorial(tutorialStep); }, 3400);
  }
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    const pb = el.pauseBuild || $('pauseBuild');
    if (pb) {
      const entries = Object.entries(upgradeLevels).filter(([, v]) => v > 0);
      pb.textContent = entries.length
        ? entries.map(([id, v]) => {
            const u = UPGRADES.find((x) => x.id === id);
            return `${u ? u.icon + ' ' + u.name : id}${v > 1 ? ' ×' + v : ''}`;
          }).join(' · ')
        : 'No upgrades yet';
    }
    showOnly('pause');
  } else if (state === 'paused') {
    state = 'playing';
    showOnly(null);
  }
}

// ---------- waves ----------

function pickEnemyType(n) {
  const r = Math.random();
  if (n >= 6 && r < 0.10) return 'dasher';
  if (n >= 4 && r < 0.20) return 'tank';
  if (n >= 3 && r < 0.34) return 'splitter';
  if (n >= 3 && r < 0.48) return 'shooter';
  if (n >= 2 && r < 0.68) return 'runner';
  return 'grunt';
}

function startWave(n) {
  wave = n;
  const isBoss = n % 5 === 0;
  const count = isBoss ? 4 + n : 6 + Math.floor(n * 2.5);
  spawnQueue = Array.from({ length: count }, () => pickEnemyType(n));
  if (isBoss) spawnQueue.unshift('boss');
  waveTotal = spawnQueue.length;
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
  // Elites from wave 6: tougher, faster, worth more.
  const elite = type !== 'boss' && wave >= 6 && Math.random() < 0.12;
  enemies.push({
    id: nextId++, type, x, y, r: elite ? t.r * 1.25 : t.r,
    hp: elite ? hp * 2 : hp, maxHp: elite ? hp * 2 : hp,
    speed: t.speed * (1 + Math.min(0.3, wave * 0.015)) * diff.enemySpeed * (elite ? 1.1 : 1),
    elite: !!elite,
    kx: 0, ky: 0, flash: 0, angle: 0,
    fireCd: rand(1, 2.5), pattern: 0, strafe: Math.random() < 0.5 ? -1 : 1, wobble: rand(0, 10),
    state: 'chase', stateT: rand(0.5, 1.5), chargeDir: null, minionT: 5,
  });
  burst(x, y, t.color, 14, 220);
  ring(x, y, t.color, t.r * 3, 0.5, 4);
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

function rollUpgrades() {
  const available = UPGRADES.filter((u) =>
    (!u.max || (upgradeLevels[u.id] || 0) < u.max) && (!u.when || u.when()));
  // Always offer 3: fill with dmg/speed/hp if filters leave too few.
  const fallback = UPGRADES.filter((u) => ['dmg', 'speed', 'hp'].includes(u.id));
  const pool = [...available];
  for (const f of fallback) if (pool.length < 3 && !pool.includes(f)) pool.push(f);
  return pool.sort(() => Math.random() - 0.5).slice(0, 3);
}

function renderUpgradeCards() {
  const box = el.upgradeChoices || $('upgradeChoices');
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
  // Build recap + reroll / skip row
  const build = el.buildRow || $('buildRow');
  if (build) {
    const entries = Object.entries(upgradeLevels).filter(([, v]) => v > 0);
    build.textContent = entries.length
      ? 'Build: ' + entries.map(([id, v]) => {
          const u = UPGRADES.find((x) => x.id === id);
          return `${u ? u.icon : '•'}${v > 1 ? '×' + v : ''}`;
        }).join('  ')
      : 'No upgrades yet — pick your first power-up!';
  }
  const rerollBtn = $('rerollBtn');
  if (rerollBtn) rerollBtn.hidden = rerollsLeft <= 0;
  const rerollLabel = $('rerollLabel');
  if (rerollLabel) rerollLabel.textContent = rerollsLeft > 0 ? `Reroll (${rerollsLeft} left · R)` : 'No rerolls left';
}

function openUpgrades() {
  rerollsLeft = 1;
  upgradeChoices = rollUpgrades();
  renderUpgradeCards();
  (el.upgradeTitle || $('upgradeTitle')).textContent = `WAVE ${wave} CLEARED`;
  state = 'upgrade';
  mouse.down = false;
  moveStick.id = aimStick.id = null;
  showOnly('upgrade');
}

function rerollUpgrades() {
  if (state !== 'upgrade' || rerollsLeft <= 0) return;
  rerollsLeft--;
  upgradeChoices = rollUpgrades();
  renderUpgradeCards();
  sfx('pickup');
}

function skipUpgrade() {
  if (state !== 'upgrade') return;
  heal(10);
  sfx('pickup');
  state = 'playing';
  showOnly(null);
  startWave(wave + 1);
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

function dropWeapon() {
  if (player.weapon === 'pistol') return;
  player.weapon = 'pistol';
  player.ammo = Infinity;
  floatText(player.x, player.y - 30, 'PISTOL', '#7df9ff');
  toast('Dropped weapon — back to Pistol (E)');
  sfx('pickup');
}

function tryDash() {
  if (player.dashCd > 0 || state !== 'playing') return;
  const mv = moveInput();
  const dir = mv.mag > 0.1 ? { x: mv.x / mv.mag, y: mv.y / mv.mag } : { x: Math.cos(player.angle), y: Math.sin(player.angle) };
  player.dashDir = dir;
  player.dashTime = 0.16;
  player.dashCd = stats.dashCd;
  dashHitIds = new Set();
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
  if (stats.regen) heal(stats.regen * dt);

  const mv = moveInput();
  if (p.dashTime > 0) {
    p.dashTime -= dt;
    p.x += p.dashDir.x * 950 * dt;
    p.y += p.dashDir.y * 950 * dt;
    particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: '#00f0ff', size: p.r * 0.9 });
    // Offensive dash: damage enemies passed through (once per dash each).
    for (const e of enemies) {
      if (e.dead || dashHitIds.has(e.id)) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 6) {
        dashHitIds.add(e.id);
        const dmg = 120 * stats.dmg;
        damageEnemy(e, dmg, p.dashDir.x, p.dashDir.y, false);
        floatText(e.x, e.y - e.r - 8, 'DASH!', '#00f0ff');
      }
    }
  } else {
    const speed = 290 * stats.speed;
    p.x += (mv.x * speed + p.kx) * dt;
    p.y += (mv.y * speed + p.ky) * dt;
  }
  const decay = Math.exp(-10 * dt);
  p.kx *= decay; p.ky *= decay;
  collideObstacles(p);
  clampToArena(p);

  // Aim + fire (fixed: mouse only aims on desktop, touch sticks on mobile)
  let firing = !!settings.autofire;
  if (touchMode) {
    const a = stickVector(aimStick);
    if (a.mag > 0.25) { p.angle = Math.atan2(a.y, a.x); firing = true; }
    else if (mv.mag > 0.1) p.angle = Math.atan2(mv.y, mv.x);
    if (mouse.down) {
      const m = screenToWorld(mouse.x, mouse.y);
      p.angle = Math.atan2(m.y - p.y, m.x - p.x);
      firing = true;
    }
  } else {
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
    const isCrit = Math.random() < stats.crit;
    shotsFired++;
    bullets.push({
      x: p.x + Math.cos(p.angle) * 26, y: p.y + Math.sin(p.angle) * 26,
      px: p.x + Math.cos(p.angle) * 26, py: p.y + Math.sin(p.angle) * 26,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      r: isCrit ? w.size * 1.35 : w.size, dmg: w.dmg * stats.dmg * (isCrit ? 2 : 1), life: 1.1,
      pierce: (w.pierce || 0) + stats.pierce, hit: new Set(),
      color: isCrit ? '#ffffff' : w.color, explode: w.explode || 0, blast: stats.blast, crit: isCrit,
    });
  }
  p.fireCd = w.rate / stats.rate;
  // Muzzle flash + recoil
  for (let i = 0; i < 4; i++) {
    const a = p.angle + rand(-0.4, 0.4);
    particles.push({ x: p.x + Math.cos(p.angle) * 28, y: p.y + Math.sin(p.angle) * 28,
      vx: Math.cos(a) * rand(100, 300), vy: Math.sin(a) * rand(100, 300), life: 0.08, max: 0.08, color: w.color, size: 4 });
  }
  const recoil = p.weapon === 'shotgun' ? 160 : p.weapon === 'rocket' ? 120 : p.weapon === 'scrapper' ? 60 : 20;
  p.kx -= Math.cos(p.angle) * recoil;
  p.ky -= Math.sin(p.angle) * recoil;
  if (p.weapon === 'shotgun' || p.weapon === 'rocket' || p.weapon === 'rail' || p.weapon === 'scrapper') shake(4);
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
    let spd = e.speed * (e.elite ? 1.1 : 1);

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
    } else if (e.type === 'dasher') {
      // Telegraph, then lunge.
      e.stateT -= dt;
      if (e.state === 'chase') {
        if (e.stateT <= 0 && d < 520 && d > 120) {
          e.state = 'aim'; e.stateT = 0.55;
          e.chargeDir = { x: mx, y: my };
          sfx('telegraph');
        }
      } else if (e.state === 'aim') {
        mx = 0; my = 0;
        if (e.chargeDir) e.angle = Math.atan2(e.chargeDir.y, e.chargeDir.x);
        if (e.stateT <= 0) { e.state = 'lunge'; e.stateT = 0.38; }
      } else if (e.state === 'lunge') {
        mx = e.chargeDir.x * 3.4; my = e.chargeDir.y * 3.4;
        if (e.stateT <= 0) { e.state = 'chase'; e.stateT = rand(0.9, 1.6); }
      }
    } else if (e.type === 'boss') {
      e.fireCd -= dt;
      e.minionT -= dt;
      const enraged = e.hp < e.maxHp * 0.3;
      if (e.minionT <= 0 && enemies.length < 30) {
        e.minionT = enraged ? 4 : 6;
        for (let i = 0; i < 2; i++) {
          const a = rand(0, Math.PI * 2);
          const bx = clamp(e.x + Math.cos(a) * (e.r + 40), 60, ARENA.w - 60);
          const by = clamp(e.y + Math.sin(a) * (e.r + 40), 60, ARENA.h - 60);
          if (!insideObstacle(bx, by, 40)) warnings.push({ type: Math.random() < 0.5 ? 'grunt' : 'runner', x: bx, y: by, t: 0.9 });
        }
        floatText(e.x, e.y - e.r - 16, 'MINIONS!', '#ff2e88');
      }
      if (e.fireCd <= 0) {
        if (e.pattern % 2 === 0) {
          const n = 18, off = rand(0, 1);
          for (let i = 0; i < n; i++) fireEnemyBullet(e, off + (i / n) * Math.PI * 2, 250, 12);
        } else {
          for (let i = -2; i <= 2; i++) fireEnemyBullet(e, e.angle + i * 0.16, enraged ? 420 : 360, 12);
        }
        e.pattern++;
        // Fires faster when hurt, and later bosses fire faster overall.
        const base = Math.max(1.6, 2.6 - (wave / 5 - 1) * 0.3);
        e.fireCd = (e.hp < e.maxHp / 2 ? base * 0.65 : base) * diff.fire * (enraged ? 0.75 : 1);
      }
      if (enraged) spd *= 1.35;
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

    e.x += (mx * spd + e.kx) * dt;
    e.y += (my * spd + e.ky) * dt;
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

function damageEnemy(e, dmg, dirX, dirY, isCrit = false) {
  if (e.dead) return;
  const t = ENEMIES[e.type];
  e.hp -= dmg;
  damageDealt += Math.max(0, dmg);
  e.flash = 0.09;
  e.kx += dirX * (dmg * 9) / t.mass;
  e.ky += dirY * (dmg * 9) / t.mass;
  if (dmg >= 30) floatText(e.x + rand(-8, 8), e.y - e.r - 6, `${Math.round(dmg)}${isCrit ? ' CRIT' : ''}`, isCrit ? '#ffe66d' : '#ffd7e2');
  if (isCrit) sfx('crit'); else sfx('hit');
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  e.dead = true;
  const t = ENEMIES[e.type];
  kills++;
  combo++;
  maxCombo = Math.max(maxCombo, combo);
  comboTimer = 2.5;
  const mult = comboMultiplier();
  const eliteMult = e.elite ? 3 : 1;
  const pts = Math.round(t.score * mult * diff.score * eliteMult);
  score += pts;
  floatText(e.x, e.y - e.r, `+${pts}`, mult > 1 ? '#ffe66d' : '#ffffff');
  burst(e.x, e.y, t.color, e.type === 'boss' ? 80 : e.elite ? 30 : 18, e.type === 'boss' ? 600 : 320);
  ring(e.x, e.y, t.color, e.type === 'boss' ? 220 : e.type === 'tank' ? 110 : 60, 0.4, e.type === 'boss' ? 10 : 5);
  if (stats.vamp) heal(stats.vamp);
  sfx('kill');

  // Splitter births 2 runners.
  if (e.type === 'splitter') {
    sfx('pop');
    for (let i = 0; i < 2; i++) {
      const a = rand(0, Math.PI * 2);
      const nx = clamp(e.x + Math.cos(a) * 26, 40, ARENA.w - 40);
      const ny = clamp(e.y + Math.sin(a) * 26, 40, ARENA.h - 40);
      if (!insideObstacle(nx, ny, 20)) spawnEnemy('runner', nx, ny);
    }
  }

  if (e.type === 'boss') {
    shake(28);
    slowmoTimer = 0.9;
    sfx('boom');
    dropPickup(e.x - 30, e.y, 'health');
    dropPickup(e.x + 30, e.y, DROP_WEAPONS[Math.floor(Math.random() * DROP_WEAPONS.length)]);
    if (Math.random() < 0.5) dropPickup(e.x, e.y + 40, 'health');
  } else {
    shake(e.type === 'tank' ? 8 : e.elite ? 6 : 3);
    if (e.elite) {
      dropPickup(e.x, e.y, Math.random() < 0.6 ? DROP_WEAPONS[Math.floor(Math.random() * DROP_WEAPONS.length)] : 'health');
      if (Math.random() < 0.5) dropPickup(e.x + 24, e.y, 'health');
    } else {
      const r = Math.random();
      if (r < 0.06) dropPickup(e.x, e.y, DROP_WEAPONS[Math.floor(Math.random() * DROP_WEAPONS.length)]);
      else if (r < 0.11) dropPickup(e.x, e.y, 'health');
    }
  }
}

function comboMultiplier() {
  return Math.min(4, 1 + Math.floor(combo / 5) * 0.5);
}

function explode(x, y, radius, dmg) {
  ring(x, y, '#ff9f1c', radius * 1.4, 0.35, 8);
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
    b.px = b.x; b.py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.x < 0 || b.y < 0 || b.x > ARENA.w || b.y > ARENA.h || insideObstacle(b.x, b.y, b.r)) {
      if (b.explode) explode(b.x, b.y, b.explode, b.dmg * 2);
      else if (b.blast) explode(b.x, b.y, 50, b.blast * 0.6);
      else burst(b.x, b.y, b.color, 4, 120);
      b.life = 0;
      continue;
    }
    for (const e of enemies) {
      if (e.dead || b.hit.has(e.id)) continue;
      const dx = e.x - b.x, dy = e.y - b.y;
      if (dx * dx + dy * dy > (e.r + b.r) ** 2) continue;
      const sp = Math.hypot(b.vx, b.vy) || 1;
      shotsHit++;
      if (b.explode) {
        explode(b.x, b.y, b.explode, b.dmg * 2);
        b.life = 0;
        break;
      }
      damageEnemy(e, b.dmg, b.vx / sp, b.vy / sp, b.crit);
      if (b.blast) explode(b.x, b.y, 50, b.blast * 0.6);
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
    const d = dist(k, p) || 0.001;
    if (d < stats.magnet + p.r) {
      const pull = 650 * dt;
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
        const w = WEAPONS[k.kind] || WEAPONS.pistol;
        p.weapon = k.kind in WEAPONS ? k.kind : 'pistol';
        p.ammo = w.ammo;
        floatText(p.x, p.y - 30, w.name.toUpperCase(), w.color);
        toast(`${w.name} — ${w.ammo === Infinity ? '∞ ammo' : w.ammo + ' ammo'} · E to drop`);
      }
      burst(k.x, k.y, '#ffffff', 10, 200);
      ring(k.x, k.y, '#ffffff', 50, 0.3, 3);
    }
  }
  pickups = pickups.filter((k) => k.life > 0);
}

function burst(x, y, color, n, speed) {
  if (reduceMotion()) n = Math.ceil(n / 2);
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
  if (texts.length > 40) texts.splice(0, texts.length - 40);
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
  for (const r of rings) {
    r.life -= dt;
    const p = 1 - r.life / r.max;
    r.r = 8 + (r.maxR - 8) * (1 - (1 - p) * (1 - p));
  }
  rings = rings.filter((r) => r.life > 0);
  if (dust) for (const d of dust) {
    d.tw += dt;
    d.x += d.vx * dt; d.y += d.vy * dt;
    if (d.x < 0) d.x += ARENA.w; if (d.x > ARENA.w) d.x -= ARENA.w;
    if (d.y < 0) d.y += ARENA.h; if (d.y > ARENA.h) d.y -= ARENA.h;
  }
}

// ---------- main update ----------

function update(rawDt) {
  if (slowmoTimer > 0) { slowmoTimer -= rawDt; timeScale = 0.3; } else timeScale = 1;
  const dt = rawDt * timeScale;

  hurtFlash = Math.max(0, hurtFlash - rawDt);
  runTime += dt;
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

function fmtTime(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function updateHud() {
  const hpT = el.hpText || $('hpText'), hpF = el.hpFill || $('hpFill');
  setText(hpT, Math.max(0, Math.ceil(player.hp)));
  setWidth(hpF, player.hp / player.maxHp);
  hpF.style.background = player.hp / player.maxHp < 0.3 ? 'linear-gradient(90deg,#ff2e63,#ff2e63)' : '';
  setText(el.weaponName || $('weaponName'), WEAPONS[player.weapon].name);
  setText(el.ammo || $('ammo'), player.ammo === Infinity ? '∞' : player.ammo);
  const dashFrac = 1 - Math.max(0, player.dashCd) / stats.dashCd;
  setWidth(el.dashFill || $('dashFill'), dashFrac);
  (el.dashBtn || $('dashBtn')).classList.toggle('cooling', dashFrac < 1);
  setText(el.waveText || $('waveText'), `WAVE ${wave}`);
  const left = enemies.length + spawnQueue.length + warnings.length;
  setText(el.enemiesText || $('enemiesText'), left ? `${left} enemies left` : '');
  const prog = el.waveProgress || $('waveProgress');
  if (prog) setWidth(prog, waveTotal ? 1 - left / waveTotal : 1);
  setText(el.scoreText || $('scoreText'), score.toLocaleString());
  const mult = comboMultiplier();
  setText(el.comboText || $('comboText'), combo >= 3 ? `${combo} combo${mult > 1 ? ` · x${mult}` : ''}` : '');
  if (el.killsText) setText(el.killsText, `${kills} kills`);
  if (el.timeText) setText(el.timeText, fmtTime(runTime));
  const boss = enemies.find((e) => e.type === 'boss');
  const bossBar = el.bossBar || $('bossBar');
  bossBar.hidden = !boss;
  if (boss) {
    setWidth(el.bossFill || $('bossFill'), boss.hp / boss.maxHp);
    if (el.bossName) setText(el.bossName, boss.hp < boss.maxHp * 0.3 ? `VOIDLORD · ENRAGED · WAVE ${wave}` : `VOIDLORD · WAVE ${wave}`);
  }
}

// ---------- rendering ----------

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#070a14';
  ctx.fillRect(0, 0, W, H);

  const z = zoom * DPR;
  ctx.setTransform(z, 0, 0, z, DPR * (W / 2 - (cam.x + cam.sx) * zoom), DPR * (H / 2 - (cam.y + cam.sy) * zoom));

  drawFloor();
  drawDust();
  drawObstacles();
  drawWarnings();
  drawPickups();
  for (const e of enemies) drawEnemy(e);
  if (state !== 'over' || player.hp > 0) drawPlayer();

  ctx.globalCompositeOperation = 'lighter';
  // Bullet trails
  ctx.lineWidth = 2;
  for (const b of bullets) {
    if (b.px !== undefined) {
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(b.px, b.py);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    drawGlowDot(b.x, b.y, b.r, b.color);
  }
  ctx.globalAlpha = 1;
  for (const b of enemyBullets) drawGlowDot(b.x, b.y, b.r, '#ff3864');
  for (const r of rings) {
    ctx.globalAlpha = Math.max(0, r.life / r.max) * 0.9;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.width * (r.life / r.max) + 1;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
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

function drawDust() {
  if (!dust) return;
  ctx.fillStyle = 'rgba(120,160,255,0.25)';
  for (const d of dust) {
    const tl = cam.x - W / zoom / 2 - 50, brx = cam.x + W / zoom / 2 + 50;
    const tly = cam.y - H / zoom / 2 - 50, bry = cam.y + H / zoom / 2 + 50;
    if (d.x < tl || d.x > brx || d.y < tly || d.y > bry) continue;
    ctx.globalAlpha = 0.25 + Math.sin(d.tw * 2) * 0.15;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
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
      const w = WEAPONS[k.kind] || WEAPONS.pistol;
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
  // Elite aura
  if (e.elite) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.strokeStyle = '#ffe66d';
    ctx.globalAlpha = 0.6 + Math.sin(performance.now() / 200) * 0.3;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, e.r + 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Dasher telegraph line
  if (e.type === 'dasher' && e.state === 'aim' && e.chargeDir) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,159,28,0.6)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + e.chargeDir.x * 260, e.y + e.chargeDir.y * 260);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
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
  } else if (e.type === 'splitter') {
    ctx.rotate(e.angle * 0.5);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
      ctx.lineTo(Math.cos(a + 0.5) * e.r * 0.6, Math.sin(a + 0.5) * e.r * 0.6);
      ctx.closePath();
    }
    ctx.globalAlpha = 0.4;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'dasher') {
    ctx.rotate(e.angle);
    ctx.moveTo(e.r * 1.6, 0);
    ctx.lineTo(-e.r * 0.6, e.r);
    ctx.lineTo(-e.r, 0);
    ctx.lineTo(-e.r * 0.6, -e.r);
    ctx.closePath();
    ctx.fill();
    if (e.state === 'aim') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(e.r * 0.4, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    }
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

  if ((e.type === 'tank' || e.type === 'splitter' || e.elite) && e.hp < e.maxHp) {
    const w = e.type === 'tank' ? 48 : 36;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.x - w / 2, e.y - e.r - 14, w, 5);
    ctx.fillStyle = e.elite ? '#ffe66d' : t.color;
    ctx.fillRect(e.x - w / 2, e.y - e.r - 14, w * (e.hp / e.maxHp), 5);
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
  ctx.fillStyle = (WEAPONS[p.weapon] || WEAPONS.pistol).color;
  const len = p.weapon === 'rail' ? 30 : p.weapon === 'shotgun' ? 24 : p.weapon === 'scrapper' ? 26 : 22;
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
  ring(player.x, player.y, '#00f0ff', 200, 0.6, 8);
  shake(25);
  sfx('boom');
  (el.dashBtn || $('dashBtn')).hidden = true;
  const prev = bestFor(difficulty);
  const isRecord = score > prev.score;
  const best = bests[difficulty] = { score: Math.max(prev.score, score), wave: Math.max(prev.wave, wave) };
  storageSet('neon-bests', bests);
  const acc = shotsFired ? Math.round((shotsHit / shotsFired) * 100) : 0;
  setTimeout(() => {
    setText(el.finalScore || $('finalScore'), score.toLocaleString());
    setText(el.finalWave || $('finalWave'), wave);
    setText(el.finalKills || $('finalKills'), kills);
    if (el.finalTime) setText(el.finalTime, fmtTime(runTime));
    if (el.finalCombo) setText(el.finalCombo, `x${comboMultiplier()} · best ${maxCombo}`);
    if (el.finalAccuracy) setText(el.finalAccuracy, `${acc}%`);
    (el.newRecord || $('newRecord')).hidden = !isRecord || score === 0;
    (el.overBest || $('overBest')).textContent = `${diff.label} best: ${best.score.toLocaleString()} · wave ${best.wave}`;
    showOnly('over');
  }, 1100);
}

async function shareScore() {
  const url = location.origin + location.pathname;
  const text = `🔫 I survived to wave ${wave} (${kills} kills, ${score.toLocaleString()} pts) on ${diff.label} in Neon Arena! Can you beat me?\n${url}`;
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
  (el.bestText || $('bestText')).textContent = b.score ? `${DIFFICULTIES[difficulty].label} best: ${b.score.toLocaleString()} · wave ${b.wave}` : '';
}

function selectDifficulty(d) {
  difficulty = d;
  storageSet('neon-difficulty', d);
  for (const btn of document.querySelectorAll('#difficulty button')) {
    btn.setAttribute('aria-checked', String(btn.dataset.diff === d));
  }
  (el.diffDesc || $('diffDesc')).textContent = DIFFICULTIES[d].desc;
  updateMenuBest();
}

function updateMuteIcon() {
  const m1 = el.muteBtn || $('muteBtn'), m2 = el.muteBtn2 || $('muteBtn2');
  if (m1) m1.textContent = muted ? '🔇' : '🔊';
  if (m2) m2.textContent = muted ? '🔇 Unmute' : '🔊 Mute';
}

function toggleMute() {
  muted = !muted;
  storageSet('neon-muted', muted);
  updateMuteIcon();
}

function syncSettingsUI() {
  if (el.shakeToggle) el.shakeToggle.checked = !!settings.shake;
  if (el.autofireToggle) el.autofireToggle.checked = !!settings.autofire;
  if (el.flashToggle) el.flashToggle.checked = !!settings.flash;
}

function quitToMenu() {
  state = 'menu';
  resetGame();
  selectDifficulty(difficulty);
  showOnly('menu');
}

cacheDom();
(el.playBtn || $('playBtn')).addEventListener('click', startGame);
for (const btn of document.querySelectorAll('#difficulty button')) {
  btn.addEventListener('click', () => selectDifficulty(btn.dataset.diff));
}
(el.againBtn || $('againBtn')).addEventListener('click', startGame);
(el.menuBtn || $('menuBtn')).addEventListener('click', quitToMenu);
(el.resumeBtn || $('resumeBtn')).addEventListener('click', togglePause);
(el.restartBtn || $('restartBtn')).addEventListener('click', startGame);
if (el.quitBtn) el.quitBtn.addEventListener('click', quitToMenu);
(el.pauseBtn || $('pauseBtn')).addEventListener('click', togglePause);
(el.shareBtn || $('shareBtn')).addEventListener('click', shareScore);
(el.muteBtn || $('muteBtn')).addEventListener('click', toggleMute);
if (el.muteBtn2) el.muteBtn2.addEventListener('click', toggleMute);
const rerollBtnEl = $('rerollBtn');
if (rerollBtnEl) rerollBtnEl.addEventListener('click', rerollUpgrades);
const skipBtnEl = $('skipBtn');
if (skipBtnEl) skipBtnEl.addEventListener('click', skipUpgrade);
if (el.shakeToggle) el.shakeToggle.addEventListener('change', (e) => { settings.shake = e.target.checked; storageSet('neon-shake', settings.shake); });
if (el.autofireToggle) el.autofireToggle.addEventListener('change', (e) => { settings.autofire = e.target.checked; storageSet('neon-autofire', settings.autofire); });
if (el.flashToggle) el.flashToggle.addEventListener('change', (e) => { settings.flash = e.target.checked; storageSet('neon-flash', settings.flash); });
(el.dashBtn || $('dashBtn')).addEventListener('touchstart', (e) => { e.preventDefault(); tryDash(); }, { passive: false });
(el.dashBtn || $('dashBtn')).addEventListener('click', tryDash);

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
document.addEventListener('gesturestart', (e) => e.preventDefault());
resetGame();
selectDifficulty(difficulty);
updateMuteIcon();
syncSettingsUI();
showOnly('menu');
requestAnimationFrame(frame);
