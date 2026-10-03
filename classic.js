// Phoenix — Classic 1980 mode.
// A from-scratch 2D recreation of the arcade original on its 208x256 vertical raster:
// hand-drawn pixel sprites, the five-round structure, the shield, regrowing wings and the mothership.
// Nothing here is taken from the original ROM; it is a tribute built from memory of the cabinet.

const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;

const W = 208, H = 256;
const PY = 228;               // player ship top edge
const HI_KEY = 'phoenix.classic.hi';

const cv = $('classic'), ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

function fit() {
  const s = Math.min((innerWidth - 16) / W, (innerHeight - 16) / H);
  const k = s >= 2 ? Math.floor(s) : s;
  cv.style.width = `${W * k}px`;
  cv.style.height = `${H * k}px`;
}
addEventListener('resize', fit);
fit();

// ---------------------------------------------------------------- sprites

const PAL = {
  W: '#ffffff', A: '#dce9ff', B: '#2f6fd6', K: '#101014', Y: '#ffd23f', O: '#ff8c1a', R: '#ff3b3b', C: '#ff5a3c',
  G: '#53e07a', T: '#2dd4bf', E: '#f2ead8', L: '#7fc4ff', N: '#1d3a55',
};

function sprite(rows, map = {}) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x];
    if (ch === '.') continue;
    g.fillStyle = PAL[map[ch] || ch];
    g.fillRect(x, y, 1, 1);
  }
  return c;
}
const mirror = rows => rows.map(r => r.split('').reverse().join(''));
const flipV = rows => rows.slice().reverse();

const PLAYER = sprite([
  '.......AA.......',
  '.......AA.......',
  '......AAAA......',
  '......ABBA......',
  '......ABBA......',
  '.....AABBAA.....',
  '.....AABBAA.....',
  '....AAABBAAA....',
  '...AAAABBAAAA...',
  '..AAAAABBAAAAA..',
  '.AAAAAAAAAAAAAA.',
  '.AA..AAAAAA..AA.',
  '.A...CCCCCC...A.',
  '.....C....C.....',
]);

const SMALL_ROWS = [
  [ // wings up
    'X.............X.',
    'XX...........XX.',
    '.XX.........XX..',
    '..XX..XOX..XX...',
    '...XXXXOXXXX....',
    '....XXXOXXX.....',
    '......XOX.......',
    '.......O........',
  ],
  [ // level
    '................',
    '................',
    'XXXX...XOX..XXXX',
    '...XXX.XOX.XXX..',
    '.....XXXOXXX....',
    '......XXOXX.....',
    '.......XOX......',
    '.......O........',
  ],
  [ // wings down
    '.......O........',
    '......XOX.......',
    '.....XXOXX......',
    '...XXXXOXXXX....',
    '..XX..XOX..XX...',
    '.XX.........XX..',
    'XX...........XX.',
    'X.............X.',
  ],
];
const smallBirdSet = (wing, body) => SMALL_ROWS.map(r => sprite(r, { X: wing, O: body }));
const SMALL = { scout: smallBirdSet('Y', 'R'), raider: smallBirdSet('L', 'O'), escort: smallBirdSet('C', 'Y') };

const BIG_BODY_ROWS = [
  '...XX...',
  '..XXXX..',
  '..XXXX..',
  '.XXXXXX.',
  '.XXXXXX.',
  '.XXXXXX.',
  '.XXXXXX.',
  '.XXXXXX.',
  '..XXXX..',
  '..XXXX..',
  '..XKKX..',
  '..XXXX..',
  '...XX...',
  '...YY...',
  '....Y...',
  '....Y...',
];
// Wing frames are generated: a tapered feather sweeping from the shoulder outward, tilted by the flap phase.
function wingRows(f) {
  const rows = Array.from({ length: 16 }, () => Array(12).fill('.'));
  for (let x = 0; x < 12; x++) {
    const dist = 11 - x;                     // 0 at the tip, 11 at the shoulder
    const cy = 8 - f * dist * 0.55;
    const thick = 1 + Math.floor((11 - dist) / 4);
    for (let t = 0; t < thick + 1; t++) {
      const y = Math.round(cy) + t;
      if (y >= 0 && y < 16) rows[y][x] = t === 0 ? 'Z' : 'X';
    }
  }
  return rows.map(r => r.join(''));
}
const bigSet = (body, wing, edge) => ({
  body: sprite(BIG_BODY_ROWS, { X: body }),
  left: [1, 0, -1].map(f => sprite(wingRows(f), { X: wing, Z: edge })),
  right: [1, 0, -1].map(f => sprite(mirror(wingRows(f)), { X: wing, Z: edge })),
});
const BIG = { hatch: bigSet('L', 'B', 'A'), fury: bigSet('O', 'R', 'Y') };

const EGG = [
  sprite(['.EE.', 'EEEE', 'EEEE', '.EE.']),
  sprite(['..EE..', '.EEEE.', 'EEEEEE', 'EEEEEE', '.EEEE.', '..EE..']),
  sprite(['..EEEE..', '.EEEEEE.', 'EEEEEEEE', 'EEEEEEEE', 'EEEEEEEE', 'EEEEEEEE', '.EEEEEE.', '..EEEE..']),
];

const ALIEN = sprite([
  '..GGGG..',
  '.GGGGGG.',
  'GGKGGKGG',
  'GGGGGGGG',
  '.GGGGGG.',
  '..G..G..',
  '.G....G.',
  'G......G',
]);

const BOMB = [sprite(['.R.', 'RYR', 'RYR', '.R.']), sprite(['.Y.', 'YRY', 'YRY', '.Y.'])];

const BURST = [1, 2, 3].map(n => {
  const c = document.createElement('canvas');
  c.width = c.height = 24;
  const g = c.getContext('2d');
  g.translate(12, 12);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + n * 0.3, r = n * 3.5;
    g.fillStyle = i % 2 ? PAL.Y : PAL.W;
    g.fillRect(Math.round(Math.cos(a) * r) - 1, Math.round(Math.sin(a) * r) - 1, 2, 2);
    if (n > 1) { g.fillStyle = PAL.R; g.fillRect(Math.round(Math.cos(a) * r * 0.5) - 1, Math.round(Math.sin(a) * r * 0.5) - 1, 2, 2); }
  }
  return c;
});

// ---------------------------------------------------------------- audio

let ac = null, noiseBuf = null;
function audio() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
}
function tone(type, f0, f1, dur, vol = 0.08, at = 0) {
  if (!ac || G.muted) return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + at;
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t); o.stop(t + dur);
}
function noise(dur, vol = 0.2, freq = 900) {
  if (!ac || G.muted) return;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), t = ac.currentTime;
  s.buffer = noiseBuf;
  f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(80, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(ac.destination);
  s.start(t, rand(0, 0.5), dur);
}
const midi = n => 440 * 2 ** ((n - 69) / 12);
// Both tunes the cabinet played are public-domain classics: Sor's "Romance de Amor" and Beethoven's "Für Elise".
const ROMANCE = [[76, 1], [76, 1], [76, 1], [74, 1], [72, 1], [71, 1], [71, 1], [71, 1], [72, 1], [71, 1], [69, 1], [67, 1], [67, 1], [67, 1], [69, 1], [67, 1], [66, 1], [64, 2]];
const ELISE = [[76, 1], [75, 1], [76, 1], [75, 1], [76, 1], [71, 1], [74, 1], [72, 1], [69, 3]];
function melody(notes, step = 0.17) {
  if (!ac || G.muted) return 0;
  let t = 0;
  for (const [n, d] of notes) { tone('triangle', midi(n), midi(n), d * step * 0.95, 0.07, t); t += d * step; }
  return t;
}
const sfx = {
  shoot: () => tone('square', 1400, 200, 0.14, 0.05),
  bomb: () => tone('square', 300, 120, 0.1, 0.03),
  hit: () => { noise(0.18, 0.15, 1800); tone('square', 400, 60, 0.18, 0.06); },
  big: () => { noise(0.5, 0.25, 800); tone('sawtooth', 200, 30, 0.5, 0.1); },
  flap: () => tone('sine', 500, 1100, 0.07, 0.025),
  wing: () => tone('square', 700, 350, 0.08, 0.05),
  block: () => tone('square', 220, 110, 0.05, 0.05),
  shield: () => tone('sine', 180, 720, 0.4, 0.08),
  hatch: () => tone('triangle', 350, 1000, 0.18, 0.06),
  life: () => tone('sine', 660, 1320, 0.3, 0.08),
  romance: () => melody(ROMANCE),
  elise: () => melody(ELISE, 0.16),
};

// ---------------------------------------------------------------- state

const G = { mode: 'menu', score: 0, hi: 0, lives: 3, round: 0, loop: 0, t: 0, clearT: -1, diveT: 2, nextLife: 5000, muted: false, bonus: null, flash: 0 };
try { G.hi = +localStorage.getItem(HI_KEY) || 0; } catch { /* storage unavailable */ }
const P = { x: W / 2, dead: false, respawn: 0, invuln: 0, shieldT: 0, shieldCd: 0, fireCd: 0, deathT: 0 };
const shots = [], bombs = [], birds = [], bigs = [], bursts = [];
let ms = null;
const keys = {};

const stars = Array.from({ length: 48 }, (_, i) => ({ x: Math.floor(rand(0, W)), y: rand(0, H), c: ['#ff4b4b', '#4bd0ff', '#ffe34b', '#7bff7b', '#ffffff'][i % 5], s: i < 24 ? 18 : 36 }));

const difficulty = () => 1 + G.loop * 0.3;
const maxShots = () => (G.round === 1 || G.round === 3 ? 3 : 1);
const roundNo = () => G.loop * 5 + G.round + 1;

// ---------------------------------------------------------------- modals & input

const CONTROLS = `<div class="keys">
  <kbd>&larr; &rarr;</kbd><span>Move (or A / D)</span>
  <kbd>Space</kbd><span>Fire</span>
  <kbd>&darr;</kbd><span>Shield (or S / Shift)</span>
  <kbd>P</kbd><span>Pause</span>
  <kbd>M</kbd><span>Mute</span>
</div>`;

function showModal(kicker, title, body, btn) {
  $('m-kicker').textContent = kicker;
  $('m-title').textContent = title;
  $('m-body').innerHTML = body;
  $('m-btn').textContent = btn;
  $('modal').classList.add('open');
  $('m-btn').focus();
}
const hideModal = () => $('modal').classList.remove('open');
const showMenu = () => showModal('Classic 1980 mode', 'PHOENIX', `A pixel-for-pixel-spirited recreation of the arcade cabinet: five rounds, one shot at a time, the force field, and the mothership.${CONTROLS}`, 'Insert Coin');

function modalAction() {
  audio();
  if (G.mode === 'paused') { hideModal(); G.mode = 'play'; }
  else if (G.mode !== 'play') newGame();
}
$('m-btn').addEventListener('click', modalAction);

function togglePause() {
  if (G.mode === 'play') { G.mode = 'paused'; showModal('Classic 1980 mode', 'PAUSED', CONTROLS, 'Resume'); }
  else if (G.mode === 'paused') modalAction();
}

function gameOver() {
  G.mode = 'over';
  showModal('Final score', 'GAME OVER', `<span class="big">${G.score.toLocaleString()}</span>High score <strong>${G.hi.toLocaleString()}</strong><br>You reached round <strong>${roundNo()}</strong>.`, 'Play Again');
}

const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'fire', ArrowUp: 'fire', KeyW: 'fire', ArrowDown: 'shield', KeyS: 'shield', ShiftLeft: 'shield', ShiftRight: 'shield' };
addEventListener('keydown', e => {
  const k = KEYMAP[e.code];
  if (k) { keys[k] = true; if (G.mode === 'play') e.preventDefault(); }
  if (e.repeat) return;
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (e.code === 'KeyM') G.muted = !G.muted;
  if (e.code === 'Enter' && G.mode !== 'play') { e.preventDefault(); modalAction(); }
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play') togglePause(); });
document.querySelectorAll('[data-k]').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); audio(); keys[k] = true; });
  for (const n of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(n, e => { e.preventDefault(); keys[k] = false; });
});

// ---------------------------------------------------------------- game flow

function newGame() {
  shots.length = bombs.length = birds.length = bigs.length = bursts.length = 0;
  ms = null;
  Object.assign(G, { mode: 'play', score: 0, lives: 3, round: 0, loop: 0, nextLife: 5000, bonus: null, flash: 0 });
  Object.assign(P, { x: W / 2, dead: false, invuln: 2, shieldT: 0, shieldCd: 0, fireCd: 0 });
  hideModal();
  cv.classList.add('active');
  sfx.romance();
  startRound();
}

function startRound() {
  shots.length = bombs.length = 0;
  G.clearT = -1;
  G.diveT = 3;
  const r = G.round;
  if (r === 0) {
    const slots = [];
    for (let row = 0; row < 4; row++) for (let i = 0; i < 4; i++) slots.push([40 + i * 40 + (row % 2) * 12, 40 + row * 16]);
    spawnBirds(slots, 'scout', 'top');
  } else if (r === 1) {
    const slots = [];
    for (let i = 0; i < 8; i++) slots.push([20 + i * 24, 36 + Math.abs(i - 3.5) * 8]);
    for (let i = 0; i < 8; i++) slots.push([32 + i * 21, 84 - Math.abs(i - 3.5) * 6]);
    spawnBirds(slots, 'raider', 'bottom');
  } else if (r < 4) {
    spawnBigs(8, r === 2 ? 'hatch' : 'fury');
  } else {
    ms = makeMothership();
    spawnBirds([[24, 150], [184, 150], [40, 166], [168, 166]], 'escort', 'top');
    sfx.elise();
  }
}

function spawnBirds(slots, kind, from) {
  slots.forEach(([sx, sy], i) => {
    const side = i % 2 ? 1 : -1;
    const ox = from === 'bottom' ? sx : W / 2 + side * (W / 2 + 20);
    const oy = from === 'bottom' ? H + 16 : -16 - i * 6;
    birds.push({ kind, sx, sy, x: ox, y: oy, ox, oy, state: 'enter', t: -i * 0.08, dur: 1.8, ph: rand(0, 6.28), spin: 0, flip: false, bombs: 0, amp: rand(30, 70), sp: rand(0, 20) });
  });
}

function spawnBigs(n, kind) {
  for (let i = 0; i < n; i++) {
    bigs.push({ kind, x: 24 + i * 23, y: -10, t: 0, hatched: false, stage: 0, hatchAt: rand(2, 6), ph: (i / n) * Math.PI * 2, ph2: rand(0, 6.28), dir: i % 2 ? 1 : -1, speed: rand(28, 40), swoop: 0, wing: [0, 0], baseY: 40 + (i % 4) * 14 });
  }
}

function makeMothership() {
  const blocks = [];
  const add = (x, y, belt) => blocks.push({ x, y, belt, alive: true, x0: x });
  for (let i = 0; i < 20; i++) add(i * 8 - 80, 16, true);          // conveyor belt
  [[20, 22], [16, 28], [12, 34], [8, 40]].forEach(([n, y]) => { for (let i = 0; i < n; i++) add(i * 8 - n * 4, y, false); });
  return { x: W / 2, y: -60, t: 0, off: 0, blocks, dying: 0 };
}

function addScore(n) {
  G.score += n;
  if (G.score > G.hi) {
    G.hi = G.score;
    try { localStorage.setItem(HI_KEY, G.hi); } catch { /* storage unavailable */ }
  }
  if (G.score >= G.nextLife) { G.nextLife += 5000; G.lives++; sfx.life(); }
}

const burst = (x, y, big = false) => bursts.push({ x, y, t: 0, big });
function dropBomb(x, y, vx = 0) { bombs.push({ x, y, vx: clamp(vx, -20, 20), vy: 70 + G.loop * 8 }); sfx.bomb(); }

function killPlayer() {
  if (P.dead || P.invuln > 0 || P.shieldT > 0) return false;
  P.dead = true; P.respawn = 2.2; P.deathT = 0;
  burst(P.x, PY + 7, true);
  sfx.big();
  G.lives--;
  return true;
}
const shieldHit = (x, y) => P.shieldT > 0 && !P.dead && Math.hypot(x - P.x, y - (PY + 7)) < 15;
const hitsPlayer = (x, y, hw, hh) => !P.dead && Math.abs(x - P.x) < 7 + hw && Math.abs(y - (PY + 7)) < 6 + hh;

function killBird(i, scored) {
  const b = birds[i];
  burst(b.x, b.y);
  sfx.hit();
  birds.splice(i, 1);
  if (scored) addScore(b.state === 'form' ? 20 : b.y < 120 ? 40 : b.y < 180 ? 50 : 80);
}
function killBig(i) {
  const b = bigs[i];
  burst(b.x, b.y, b.hatched);
  b.hatched ? sfx.big() : sfx.hit();
  bigs.splice(i, 1);
  addScore(b.hatched ? (b.kind === 'fury' ? 400 : 200) : 50);
}
function killBoss() {
  const depth = clamp((ms.y - 10) / 110, 0, 1);               // the lower it got, the bigger the bonus
  const bonus = 1000 + Math.floor(depth * 8) * 1000;
  ms.dying = 2.2;
  G.bonus = { v: bonus, t: 3 };
  for (let i = birds.length - 1; i >= 0; i--) killBird(i, false);
  bombs.length = 0;
  addScore(bonus);
  sfx.big();
  G.flash = 0.5;
}

// ---------------------------------------------------------------- update

function updPlayer(dt) {
  if (P.dead) {
    P.deathT += dt;
    P.respawn -= dt;
    if (P.respawn <= 0) {
      if (G.lives <= 0) { gameOver(); return; }
      Object.assign(P, { dead: false, x: W / 2, invuln: 2.5 });
    }
    return;
  }
  P.invuln -= dt; P.shieldCd -= dt; P.fireCd -= dt;
  if (P.shieldT > 0) P.shieldT -= dt;    // the force field roots the ship, as on the cabinet
  else {
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    P.x = clamp(P.x + dir * 64 * dt, 8, W - 8);
    if (keys.shield && P.shieldCd <= 0) { P.shieldT = 1.5; P.shieldCd = 5.5; sfx.shield(); }
    else if (keys.fire && P.fireCd <= 0 && shots.length < maxShots()) {
      shots.push({ x: Math.round(P.x), y: PY - 2 });
      P.fireCd = maxShots() > 1 ? 0.14 : 0.3;
      sfx.shoot();
    }
  }
}

function shotHits(s) {
  for (let i = birds.length - 1; i >= 0; i--) {
    const b = birds[i];
    if (Math.abs(s.x - b.x) < 7 && s.y < b.y + 4 && s.y + 8 > b.y - 4) { killBird(i, true); return true; }
  }
  for (let i = bigs.length - 1; i >= 0; i--) {
    const b = bigs[i], dx = s.x - b.x;
    if (!(s.y < b.y + 8 && s.y + 8 > b.y - 8)) continue;
    if (!b.hatched) { if (Math.abs(dx) < 4) { killBig(i); return true; } continue; }
    if (Math.abs(dx) < 4) { killBig(i); return true; }
    const side = dx < 0 ? 0 : 1;
    if (Math.abs(dx) < 16 && b.wing[side] <= 0) {
      b.wing[side] = 4;
      burst(s.x, s.y);
      sfx.wing();
      addScore(50);
      return true;
    }
  }
  if (ms && !ms.dying) {
    const lx = s.x - ms.x, ly = s.y - ms.y;
    for (const k of ms.blocks) {
      if (k.alive && lx >= k.x && lx < k.x + 8 && ly < k.y + 6 && ly + 8 > k.y) {
        k.alive = false;
        sfx.block();
        addScore(k.belt ? 30 : 20);
        return true;
      }
    }
    if (Math.abs(lx) < 5 && ly < 14 && ly + 8 > 6) { killBoss(); return true; }
  }
  return false;
}

function updShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    let dead = false;
    for (let k = 0; k < 2 && !dead; k++) { s.y -= 120 * dt; dead = s.y < 8 || shotHits(s); }
    if (dead) shots.splice(i, 1);
  }
}

function updBombs(dt) {
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    let dead = b.y > H;
    if (!dead && shieldHit(b.x, b.y)) { dead = true; burst(b.x, b.y); }
    if (!dead && hitsPlayer(b.x, b.y, 1, 2)) dead = killPlayer();
    if (dead) bombs.splice(i, 1);
  }
}

function updBirds(dt) {
  const d = difficulty(), sway = Math.sin(G.t * 0.6) * 14;
  G.diveT -= dt;
  if (G.diveT <= 0) {
    const ready = birds.filter(b => b.state === 'form');
    if (ready.length && !P.dead) {
      const b = ready[Math.floor(Math.random() * ready.length)];
      Object.assign(b, { state: 'dive', t: 0, bombs: 2, ph: rand(0, 6.28), ox: b.x });
    }
    G.diveT = rand(0.6, 1.8) / d * (G.round === 4 ? 1.4 : G.round === 1 ? 0.8 : 1);
  }
  for (let i = birds.length - 1; i >= 0; i--) {
    const b = birds[i];
    b.t += dt;
    const sx = b.sx + sway, sy = b.sy;
    if (b.state === 'enter') {
      const k = clamp(b.t / b.dur, 0, 1), e = 1 - (1 - k) ** 2;
      b.x = lerp(b.ox, sx, e) + Math.sin(k * 9 + b.ph) * (1 - k) * 20;
      b.y = lerp(b.oy, sy, e);
      if (k >= 1) b.state = 'form';
    } else if (b.state === 'form') {
      b.x = sx; b.y = sy;
      if (b.spin <= 0 && Math.random() < dt * 0.5) b.spin = 0.6;   // birds idly wheel around in formation
      if (!P.dead && Math.random() < dt * 0.04 * d) dropBomb(b.x, b.y + 4);
    } else {
      b.x = clamp(b.ox + Math.sin(b.t * 2.6 + b.ph) * b.amp + clamp(P.x - b.ox, -40, 40) * Math.min(1, b.t / 2), 8, W - 8);
      b.y += (55 + G.loop * 6 + b.sp) * dt;
      if (b.bombs > 0 && b.y > 90 && b.y < 190 && Math.random() < dt * 1.4) { b.bombs--; dropBomb(b.x, b.y + 4, (P.x - b.x) * 0.15); }
      if (b.y > H + 8) Object.assign(b, { state: 'enter', t: 0, dur: 1.5, ox: b.x, oy: -10, y: -10 });
    }
    if (b.spin > 0) { b.spin -= dt; b.flip = Math.floor(b.spin * 10) % 2 === 0; } else b.flip = false;
    if (shieldHit(b.x, b.y)) killBird(i, true);
    else if (hitsPlayer(b.x, b.y, 6, 3) && killPlayer()) killBird(i, false);
  }
}

function updBigs(dt) {
  const d = difficulty();
  for (let i = bigs.length - 1; i >= 0; i--) {
    const b = bigs[i];
    b.t += dt;
    if (!b.hatched) {
      b.stage = Math.min(2, Math.floor(b.t / b.hatchAt * 3));
      if (b.t > b.hatchAt) { b.hatched = true; burst(b.x, b.y); sfx.hatch(); }
    } else {
      for (const s of [0, 1]) if (b.wing[s] > 0) b.wing[s] -= dt;
      if (b.swoop <= 0 && !P.dead && Math.random() < dt * 0.12 * d) b.swoop = 3;
      if (!P.dead && b.y < 170 && Math.random() < dt * 0.35 * d) dropBomb(b.x, b.y + 8, (P.x - b.x) * 0.1);
      if (Math.floor(b.t * 6) !== Math.floor((b.t - dt) * 6) && Math.random() < 0.25) sfx.flap();
    }
    const speed = b.hatched ? b.speed : b.speed * 0.4;
    b.x += b.dir * speed * dt;
    if (b.x < 16) { b.x = 16; b.dir = 1; } else if (b.x > W - 16) { b.x = W - 16; b.dir = -1; }
    let dive = 0;
    if (b.swoop > 0) { dive = Math.sin(Math.PI * (1 - b.swoop / 3)) * 120; b.swoop -= dt; }
    const entry = Math.max(0, 1 - b.t / 2) * -40;
    b.y = Math.min(PY - 6, b.baseY + Math.sin(b.t * 0.8 + b.ph2) * 12 + dive + entry);
    const hw = b.hatched ? 14 : 4;
    if (shieldHit(b.x, b.y)) killBig(i);
    else if (hitsPlayer(b.x, b.y, hw, 6) && killPlayer()) killBig(i);
  }
}

function updMothership(dt) {
  ms.t += dt;
  if (ms.dying > 0) {
    ms.dying -= dt;
    if (Math.random() < dt * 14) burst(ms.x + rand(-80, 80), ms.y + rand(0, 46), Math.random() < 0.4);
    if (ms.dying <= 0) ms = null;
    return;
  }
  ms.y = ms.y < 10 ? ms.y + 18 * dt : Math.min(120, ms.y + (2.2 + 0.4 * G.loop) * dt);
  ms.x = W / 2 + Math.sin(ms.t * 0.4) * 10;
  ms.off = (ms.off + dt * 14) % 160;
  for (const k of ms.blocks) if (k.belt) k.x = ((k.x0 + 80 + ms.off) % 160) - 80;
  if (!P.dead && ms.y > 0 && Math.random() < dt * (0.8 + 0.3 * G.loop)) dropBomb(ms.x + rand(-70, 70), ms.y + 46, rand(-10, 10));
}

function update(dt) {
  updPlayer(dt);
  if (G.mode !== 'play') return;
  updShots(dt);
  updBirds(dt);
  updBigs(dt);
  if (ms) updMothership(dt);
  updBombs(dt);
  for (let i = bursts.length - 1; i >= 0; i--) if ((bursts[i].t += dt) > (bursts[i].big ? 0.6 : 0.35)) bursts.splice(i, 1);
  if (G.bonus && (G.bonus.t -= dt) <= 0) G.bonus = null;
  G.flash = Math.max(0, G.flash - dt);

  const cleared = G.round < 4 ? birds.length === 0 && bigs.length === 0 : !ms;
  if (cleared && G.clearT < 0) G.clearT = 2;
  if (G.clearT >= 0 && !P.dead && (G.clearT -= dt) < 0) {
    if (++G.round > 4) { G.round = 0; G.loop++; }
    startRound();
  }
}

// ---------------------------------------------------------------- render

const FONT = '8px "Press Start 2P", monospace';
function text(s, x, y, color = PAL.W, align = 'left') {
  ctx.font = FONT; ctx.textBaseline = 'top'; ctx.textAlign = align; ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}
const blit = (img, x, y) => ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));

function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  for (const s of stars) {
    ctx.fillStyle = s.c;
    ctx.fillRect(s.x, Math.floor(s.y), 1, 1);
  }

  // mothership
  if (ms) {
    const mx = Math.round(ms.x), my = Math.round(ms.y);
    ctx.fillStyle = PAL.N;
    ctx.beginPath(); ctx.moveTo(mx - 88, my + 16); ctx.lineTo(mx - 40, my); ctx.lineTo(mx + 40, my); ctx.lineTo(mx + 88, my + 16); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = PAL.Y; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(mx - 88, my + 16.5); ctx.lineTo(mx - 40, my + 0.5); ctx.lineTo(mx + 40, my + 0.5); ctx.lineTo(mx + 88, my + 16.5); ctx.stroke();
    ctx.fillStyle = '#000'; ctx.fillRect(mx - 7, my + 4, 14, 12);
    if (!ms.dying || Math.floor(ms.t * 12) % 2) blit(ALIEN, mx, my + 10 + Math.round(Math.sin(ms.t * 5)));
    for (const k of ms.blocks) {
      if (!k.alive) continue;
      ctx.fillStyle = k.belt ? PAL.Y : PAL.B;
      ctx.fillRect(mx + k.x, my + k.y, 7, 5);
      ctx.fillStyle = k.belt ? PAL.O : PAL.L;
      ctx.fillRect(mx + k.x, my + k.y, 7, 1);
    }
  }

  // eggs and large birds
  for (const b of bigs) {
    if (!b.hatched) { blit(EGG[b.stage], b.x, b.y); continue; }
    const set = BIG[b.kind], f = [0, 1, 2, 1][Math.floor(b.t * 8) % 4];
    if (b.wing[0] <= 0) blit(set.left[f], b.x - 9, b.y);
    if (b.wing[1] <= 0) blit(set.right[f], b.x + 9, b.y);
    blit(set.body, b.x, b.y);
  }

  // small birds
  for (const b of birds) {
    const f = b.state === 'form' ? [0, 1, 2, 1][Math.floor((G.t + b.ph) * 6) % 4] : [0, 1, 2, 1][Math.floor(b.t * 14) % 4];
    const img = SMALL[b.kind][f];
    if (b.flip) {
      ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.scale(-1, 1);
      ctx.drawImage(img, -8, -4); ctx.restore();
    } else blit(img, b.x, b.y);
  }

  for (const b of bombs) blit(BOMB[Math.floor(G.t * 10) % 2], b.x, b.y);
  ctx.fillStyle = PAL.W;
  for (const s of shots) ctx.fillRect(s.x, Math.round(s.y), 1, 8);

  // player
  if (!P.dead && (P.invuln <= 0 || Math.floor(G.t * 12) % 2 === 0)) {
    ctx.drawImage(PLAYER, Math.round(P.x - 8), PY);
    if (P.shieldT > 0 && Math.floor(G.t * 30) % 3 !== 0) {
      ctx.strokeStyle = PAL.T; ctx.beginPath(); ctx.arc(Math.round(P.x), PY + 7, 14, 0, Math.PI * 2); ctx.stroke();
    }
  }

  for (const b of bursts) {
    const f = Math.min(2, Math.floor(b.t / (b.big ? 0.2 : 0.12)));
    blit(BURST[f], b.x, b.y);
  }
  if (G.bonus && ms) text(String(G.bonus.v), Math.round(ms.x), Math.round(ms.y) + 20, PAL.Y, 'center');
  if (G.flash > 0 && Math.floor(G.flash * 20) % 2) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, 0, W, H); }

  // HUD, drawn last as on the cabinet's top and bottom rows
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 18); ctx.fillRect(0, H - 10, W, 10);
  text('SCORE1', 4, 1, PAL.R); text(String(G.score).padStart(6, '0'), 4, 10);
  text('HI-SCORE', W - 4, 1, PAL.R, 'right'); text(String(G.hi).padStart(6, '0'), W - 4, 10, PAL.W, 'right');
  for (let i = 0; i < Math.min(G.lives, 6); i++) ctx.drawImage(PLAYER, 0, 0, 16, 14, 4 + i * 10, H - 9, 8, 7);
  text(`R${roundNo()}`, W - 4, H - 9, PAL.Y, 'right');
  if (G.mode === 'menu' && Math.floor(G.t * 2) % 2) text('PUSH START', W / 2, 120, PAL.Y, 'center');
  if (G.clearT >= 0 && G.round < 4 && G.mode === 'play') text(`ROUND ${roundNo() + 1}`, W / 2, 120, PAL.Y, 'center');
}

// ---------------------------------------------------------------- main loop

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.t += dt;
  for (const s of stars) { s.y += s.s * dt; if (s.y >= H) s.y -= H; }
  if (G.mode === 'play') update(dt);
  render();
  requestAnimationFrame(frame);
}

document.fonts.load(FONT).catch(() => {}).finally(() => {
  showMenu();
  requestAnimationFrame(frame);
});

// ?debug exposes the simulation so it can be stepped from the console
if (new URLSearchParams(location.search).has('debug')) window.__dbg = { G, P, keys, update, birds, bigs, bombs, shots, startRound, get ms() { return ms; } };
