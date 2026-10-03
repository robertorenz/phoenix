// Phoenix — Classic 1980 mode.
// A from-scratch 2D recreation of the arcade original. The cabinet drew a 208x256 vertical raster; this runs
// at twice that density (416x512) so the hand-drawn sprites can carry more detail while keeping the pixel look.
// Nothing here is taken from the original ROM; it is a tribute built from memory of the cabinet.

const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const flapFrame = (t, speed) => [0, 1, 2, 1][((Math.floor(t * speed) % 4) + 4) % 4];   // safe for negative t

const W = 416, H = 512;
const PY = 452;               // player ship top edge
const PC = PY + 14;           // player ship centre line
const HI_KEY = 'phoenix.classic.hi';
const SCORES_KEY = 'phoenix.classic.scores';
const NAME_KEY = 'phoenix.classic.name';
const MAX_SCORES = 10;

const cv = $('classic'), ctx = cv.getContext('2d');
let view = 1;   // device pixels per logical pixel

// The canvas backing store matches the window at device resolution; the game is drawn through a scale
// transform with smoothing off, so sprites stay pixel-sharp at whatever size the browser gives us.
function fit() {
  const s = Math.min((innerWidth - 16) / W, (innerHeight - 16) / H), dpr = Math.min(devicePixelRatio || 1, 3);
  view = s * dpr;
  cv.width = Math.round(W * view); cv.height = Math.round(H * view);
  cv.style.width = `${Math.round(W * s)}px`;
  cv.style.height = `${Math.round(H * s)}px`;
}
addEventListener('resize', fit);
fit();

// ---------------------------------------------------------------- sprites

const PAL = {
  W: '#ffffff', A: '#9fd4ff', B: '#2255cc', K: '#101014', Y: '#ffe13a', O: '#ff8c1a', R: '#ff2e2e', C: '#ff6a4a',
  G: '#5cff6a', T: '#30e0d0', E: '#f4ecd6', L: '#8bb8ff', N: '#163a6e', M: '#ff78b4', P: '#ffd9a0', D: '#0c2250',
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
const sym = half => half.map(r => r + r.split('').reverse().join(''));   // left half -> symmetric sprite
const mirror = rows => rows.map(r => r.split('').reverse().join(''));

const PLAYER = sprite(sym([
  '...............W',
  '...............W',
  '..............WW',
  '..............WA',
  '.............WAA',
  '.............WAB',
  '............WAAB',
  '............WAAB',
  '...........WAABB',
  '...........WAABB',
  '..........WAAABB',
  '..........WAAABB',
  '.........WAAAABB',
  '........WAAAAABB',
  '.......WAAAAAABB',
  '......WAAAAAAABB',
  '.....WAAAAAAAABB',
  '....WAAAAAAAAABB',
  '...WAAAAAAAAAABB',
  '..WAAAAAAAAAAAAB',
  '.WAAAAAAAAAAAAAA',
  'WAAAABBAAAAAAAAA',
  'WAAA...BBAAAAAAA',
  'WAA.....BBAAAAAA',
  '.AA.......AAACCC',
  '.AA........CCCCC',
  '...........CC...',
  '...........C....',
]));

// Small birds: wings up / level / down, plus the narrow side view the flock shows when it rolls in formation.
const SMALL_HALF = [
  ['ZX..............', 'ZXX.............', '.ZXX............', '..ZXX...........', '...ZXX..........', '....ZXX.....OO..', '.....ZXX...OOOO.', '......ZXXX.OKOOO',
   '.......ZXXXOOOOO', '........ZXXOOOOO', '..........XOOOOO', '...........OOOOO', '............OOOO', '.............OOO', '..............YY', '...............Y'],
  ['................', '................', '................', 'ZZZZZZ..........', 'XXXXXXZZZ...OO..', '...XXXXXXZZOOOO.', '......XXXXXOKOOO', '........XXXOOOOO',
   '..........XOOOOO', '...........OOOOO', '...........OOOOO', '............OOOO', '.............OOO', '..............YY', '...............Y', '................'],
  ['...............Y', '..............YY', '.............OOO', '............OOOO', '...........OOOOO', '...........OOOOO', '..........XOOOOO', '.........XXOOOOO',
   '........XXXOKOOO', '.......XXX.OOOO.', '......XXX...OO..', '.....XXX........', '....XXX.........', '...XXX..........', '..XXZ...........', '.XXZ............'],
  ['................', '..............OO', '.............OOO', '.............OOO', '.............OKO', '.............OOO', '.............OOO', '.............OOO',
   '.............OOO', '.............OOO', '..............OO', '..............OO', '...............Y', '................', '................', '................'],
];
const smallBirdSet = (wing, edge, body) => SMALL_HALF.map(h => sprite(sym(h), { X: wing, Z: edge, O: body }));
const SMALL = { scout: smallBirdSet('Y', 'P', 'R'), raider: smallBirdSet('L', 'W', 'M'), escort: smallBirdSet('C', 'Y', 'Y') };

const BIG_BODY_HALF = [
  'XX..........', '.XX.........', '..XX........', '...XX.......', '....XX......', '.....XXX....', '......XXXX..', '.......XXXXX',
  '........XXXX', '.........XXX', '.........XXX', '........XXXX', '.......XXXXX', '......XXXXXX', '.....XXXXXXX', '....XXXXXXXX',
  '....XXXXXXXX', '...XXXXXXXXX', '...XXXXXXXXX', '...XXXXXXXXX', '...XXXXXXXXX', '...XXXXXXXXX', '....XXXXXXXX', '....XXXXXXXX',
  '.....XXXXXXX', '......XXXXXX', '.......XXXXX', '........XXXX', '.........XXX', '.........XXX', '........XXXX', '.......XXXXX',
  '......XXXXXX', '......XXKKXX', '......XXKKXX', '......XXXXXX', '.......XXXXX', '........XXYY', '..........YY', '...........Y',
];
// Wings are generated: a tapered feather sweeping from the shoulder outward, tilted by the flap phase,
// with the tip split into feathers and a light leading edge.
function wingRows(f) {
  const rows = Array.from({ length: 40 }, () => Array(36).fill('.'));
  const tipY = 20 - f * 15;
  for (let x = 0; x < 36; x++) {
    const k = (35 - x) / 35;                      // 0 at the shoulder, 1 at the tip
    const cy = 20 + (tipY - 20) * k;
    const thick = Math.round(10 - 4 * k);
    for (let t = 0; t < thick; t++) {
      if (x < 12 && t % 3 === 2 && t < thick - 1) continue;   // feather gaps at the tip
      const y = Math.round(cy - thick / 2) + t;
      if (y >= 0 && y < 40) rows[y][x] = t === 0 ? 'Z' : t === thick - 1 ? 'V' : 'X';
    }
  }
  return rows.map(r => r.join(''));
}
const bigSet = (body, wing, edge, shade) => ({
  body: sprite(sym(BIG_BODY_HALF), { X: body }),
  left: [1, 0, -1].map(f => sprite(wingRows(f), { X: wing, Z: edge, V: shade })),
  right: [1, 0, -1].map(f => sprite(mirror(wingRows(f)), { X: wing, Z: edge, V: shade })),
});
const BIG = { hatch: bigSet('L', 'B', 'A', 'N'), fury: bigSet('P', 'R', 'Y', 'K') };

function eggRows(r) {
  const rows = [];
  for (let y = 0; y < r * 2; y++) {
    let s = '';
    for (let x = 0; x < r * 2; x++) {
      const dx = x + 0.5 - r, dy = y + 0.5 - r, inside = dx * dx + dy * dy < r * r;
      s += inside ? ((x * 7 + y * 5) % 11 === 0 ? 'K' : 'E') : '.';
    }
    rows.push(s);
  }
  return rows;
}
const EGG = [6, 9, 12].map(r => sprite(eggRows(r)));

const ALIEN = sprite(sym([
  '.......GGGGG', '.....GGGGGGG', '....GGGGGGGG', '...GGGGGGGGG', '...GGGKKKGGG', '...GGGKKKGGG', '...GGGGGGGGG', '....GGGGGGGG',
  '.....GGGGGGG', '.......GGGGG', '........GGGG', '.......GG.GG', '......GG..GG', '.....GG...GG', '....GG......',
]));

const BOMB = [
  sprite(['...RR...', '..RYYR..', '.RYYYYR.', 'RYYYYYYR', 'RYYYYYYR', '.RYYYYR.', '..RYYR..', '...RR...', '...R....', '...R....']),
  sprite(['...YY...', '..YRRY..', '.YRRRRY.', 'YRRRRRRY', 'YRRRRRRY', '.YRRRRY.', '..YRRY..', '...YY...', '...Y....', '...Y....']),
];

const BURST = [1, 2, 3].map(n => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.translate(32, 32);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6 + n * 0.3, r = n * 9;
    g.fillStyle = i % 2 ? PAL.Y : PAL.W;
    g.fillRect(Math.round(Math.cos(a) * r) - 2, Math.round(Math.sin(a) * r) - 2, 4, 4);
    if (n > 1) { g.fillStyle = PAL.R; g.fillRect(Math.round(Math.cos(a) * r * 0.5) - 1, Math.round(Math.sin(a) * r * 0.5) - 1, 3, 3); }
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

// High score table: top MAX_SCORES entries, kept in this browser only and separate from the 2.5D board.
const cleanName = v => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
let scores = [];
try {
  const raw = JSON.parse(localStorage.getItem(SCORES_KEY) || '[]');
  if (Array.isArray(raw)) {
    scores = raw.map(e => ({ name: cleanName(e?.name) || '---', score: Math.max(0, Math.floor(+e?.score || 0)), round: Math.max(1, Math.floor(+e?.round || 1)) }))
      .filter(e => e.score > 0).sort((a, b) => b.score - a.score).slice(0, MAX_SCORES);
  }
} catch { /* storage unavailable or corrupt */ }
if (scores.length) G.hi = Math.max(G.hi, scores[0].score);
const scoreRank = n => { const i = scores.findIndex(e => n > e.score); return i < 0 ? scores.length : i; };
const qualifies = n => n > 0 && scoreRank(n) < MAX_SCORES;
function saveScore(name, score, round) {
  const i = scoreRank(score);
  scores.splice(i, 0, { name, score, round });
  scores.length = Math.min(scores.length, MAX_SCORES);
  try { localStorage.setItem(SCORES_KEY, JSON.stringify(scores)); localStorage.setItem(NAME_KEY, name); } catch { /* storage unavailable */ }
  return i;
}
function scoresTable(mark = -1) {
  if (!scores.length) return '<p class="empty">No scores yet. Be the first on the board.</p>';
  const rows = scores.map((e, i) => `<tr${i === mark ? ' class="mark"' : ''}><td>${i + 1}</td><td>${e.name}</td><td>${e.score.toLocaleString()}</td><td>${e.round}</td></tr>`).join('');
  return `<table class="scores"><thead><tr><th>#</th><th>Name</th><th>Score</th><th>Round</th></tr></thead><tbody>${rows}</tbody></table>`;
}

const P = { x: W / 2, dead: false, respawn: 0, invuln: 0, shieldT: 0, shieldCd: 0, fireCd: 0, deathT: 0 };
const shots = [], bombs = [], birds = [], bigs = [], bursts = [];
let ms = null;
const keys = {};

const STAR_COLORS = ['#ff4b4b', '#4bd0ff', '#ffe34b', '#7bff7b', '#ffffff', '#ff9c4b'];
const stars = Array.from({ length: 110 }, (_, i) => ({ x: Math.floor(rand(0, W / 2)) * 2, y: rand(0, H), c: STAR_COLORS[i % STAR_COLORS.length], s: i < 55 ? 36 : 72 }));

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

let modalBack = null;       // set while the High Scores view is open: re-shows the modal underneath
let pendingEntry = false;   // the game-over modal is waiting for initials
function showModal(kicker, title, body, btn, links = false) {
  $('m-links').hidden = !links;
  $('m-kicker').textContent = kicker;
  $('m-title').textContent = title;
  $('m-body').innerHTML = body;
  $('m-btn').textContent = btn;
  $('modal').classList.add('open');
  $('m-btn').focus();
}
const hideModal = () => $('modal').classList.remove('open');
const showMenu = () => showModal('Classic 1980 mode', 'PHOENIX', `A recreation of the arcade cabinet: five rounds, one shot at a time, the force field, and the mothership.${CONTROLS}`, 'Insert Coin', true);
const showPause = () => showModal('Classic 1980 mode', 'PAUSED', CONTROLS, 'Resume', true);

function modalAction() {
  audio();
  if (pendingEntry) submitEntry();
  else if (modalBack) { const back = modalBack; modalBack = null; back(); }
  else if (G.mode === 'paused') { hideModal(); G.mode = 'play'; }
  else if (G.mode !== 'play') newGame();
}
$('m-btn').addEventListener('click', modalAction);
$('m-scores').addEventListener('click', () => {
  if (G.mode === 'play') return;
  modalBack = G.mode === 'paused' ? showPause : showMenu;
  showModal('Top 10', 'HIGH SCORES', scoresTable(), 'Back');
});

function togglePause() {
  if (G.mode === 'play') { G.mode = 'paused'; showPause(); }
  else if (G.mode === 'paused') modalAction();
}

function gameOver() {
  G.mode = 'over';
  if (!qualifies(G.score)) { showGameOver(-1); return; }
  let last = '';
  try { last = cleanName(localStorage.getItem(NAME_KEY)); } catch { /* storage unavailable */ }
  const body = `<span class="big">${G.score.toLocaleString()}</span>` +
    `<span class="new">Rank ${scoreRank(G.score) + 1} on the board</span>` +
    `<label class="entry">Enter your initials<input id="m-name" type="text" maxlength="3" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${last}"></label>`;
  showModal('Final score', 'GAME OVER', body, 'Save Score');
  pendingEntry = true;
  const input = $('m-name');
  input.addEventListener('input', () => { input.value = cleanName(input.value); });
  input.focus();
  input.select();
}

function submitEntry() {
  pendingEntry = false;
  showGameOver(saveScore(cleanName($('m-name').value) || 'AAA', G.score, roundNo()));
}

function showGameOver(mark) {
  showModal('Final score', 'GAME OVER', `<span class="big">${G.score.toLocaleString()}</span>You reached round <strong>${roundNo()}</strong>.${scoresTable(mark)}`, 'Play Again');
}

const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'fire', ArrowUp: 'fire', KeyW: 'fire', ArrowDown: 'shield', KeyS: 'shield', ShiftLeft: 'shield', ShiftRight: 'shield' };
addEventListener('keydown', e => {
  const k = KEYMAP[e.code];
  const typing = e.target instanceof HTMLInputElement;   // initials entry: only Enter is ours
  if (k && !typing) { keys[k] = true; if (G.mode === 'play') e.preventDefault(); }
  if (e.repeat) return;
  if (typing && e.code !== 'Enter') return;
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
    for (let row = 0; row < 4; row++) for (let i = 0; i < 4; i++) slots.push([80 + i * 80 + (row % 2) * 24, 80 + row * 32]);
    spawnBirds(slots, 'scout', 'top');
  } else if (r === 1) {
    const slots = [];
    for (let i = 0; i < 8; i++) slots.push([40 + i * 48, 72 + Math.abs(i - 3.5) * 16]);
    for (let i = 0; i < 8; i++) slots.push([64 + i * 42, 168 - Math.abs(i - 3.5) * 12]);
    spawnBirds(slots, 'raider', 'bottom');
  } else if (r < 4) {
    spawnBigs(8, r === 2 ? 'hatch' : 'fury');
  } else {
    ms = makeMothership();
    spawnBirds([[48, 300], [368, 300], [80, 332], [336, 332]], 'escort', 'top');
    sfx.elise();
  }
}

function spawnBirds(slots, kind, from) {
  slots.forEach(([sx, sy], i) => {
    const side = i % 2 ? 1 : -1;
    const ox = from === 'bottom' ? sx : W / 2 + side * (W / 2 + 40);
    const oy = from === 'bottom' ? H + 32 : -32 - i * 12;
    birds.push({ kind, sx, sy, x: ox, y: oy, ox, oy, state: 'enter', t: -i * 0.08, dur: 1.8, ph: rand(0, 6.28), spin: 0, roll: 0, bombs: 0, amp: rand(60, 140), sp: rand(0, 40) });
  });
}

function spawnBigs(n, kind) {
  for (let i = 0; i < n; i++) {
    bigs.push({ kind, x: 48 + i * 46, y: -20, t: 0, hatched: false, stage: 0, hatchAt: rand(2, 6), ph: (i / n) * Math.PI * 2, ph2: rand(0, 6.28), dir: i % 2 ? 1 : -1, speed: rand(56, 80), swoop: 0, wing: [0, 0], baseY: 80 + (i % 4) * 28 });
  }
}

// Bricks are 16x12. The dome rows frame the alien's cockpit, the belt row scrolls, and the hull steps in below.
function makeMothership() {
  const blocks = [];
  const add = (x, y, kind) => blocks.push({ x, y, kind, alive: true, x0: x });
  for (let i = 0; i < 13; i++) if (i < 5 || i > 7) add(i * 16 - 104, 0, 'dome');
  for (let i = 0; i < 17; i++) if (i < 7 || i > 9) add(i * 16 - 136, 12, 'dome');
  for (let i = 0; i < 20; i++) add(i * 16 - 160, 24, 'belt');
  [[20, 36], [16, 48], [12, 60], [8, 72]].forEach(([n, y]) => { for (let i = 0; i < n; i++) add(i * 16 - n * 8, y, 'hull'); });
  return { x: W / 2, y: -150, t: 0, off: 0, blocks, dying: 0 };
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
function dropBomb(x, y, vx = 0) { bombs.push({ x, y, vx: clamp(vx, -40, 40), vy: 140 + G.loop * 16 }); sfx.bomb(); }

function killPlayer() {
  if (P.dead || P.invuln > 0 || P.shieldT > 0) return false;
  P.dead = true; P.respawn = 2.2; P.deathT = 0;
  burst(P.x, PC, true);
  sfx.big();
  G.lives--;
  return true;
}
const shieldHit = (x, y) => P.shieldT > 0 && !P.dead && Math.hypot(x - P.x, y - PC) < 34;
const hitsPlayer = (x, y, hw, hh) => !P.dead && Math.abs(x - P.x) < 14 + hw && Math.abs(y - PC) < 12 + hh;

function killBird(i, scored) {
  const b = birds[i];
  burst(b.x, b.y);
  sfx.hit();
  birds.splice(i, 1);
  if (scored) addScore(b.state === 'form' ? 20 : b.y < 240 ? 40 : b.y < 360 ? 50 : 80);
}
function killBig(i) {
  const b = bigs[i];
  burst(b.x, b.y, b.hatched);
  b.hatched ? sfx.big() : sfx.hit();
  bigs.splice(i, 1);
  addScore(b.hatched ? (b.kind === 'fury' ? 400 : 200) : 50);
}
function killBoss() {
  const depth = clamp((ms.y - 20) / 220, 0, 1);               // the lower it got, the bigger the bonus
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
    P.x = clamp(P.x + dir * 128 * dt, 18, W - 18);
    if (keys.shield && P.shieldCd <= 0) { P.shieldT = 1.5; P.shieldCd = 5.5; sfx.shield(); }
    else if (keys.fire && P.fireCd <= 0 && shots.length < maxShots()) {
      shots.push({ x: Math.round(P.x), y: PY - 4 });
      P.fireCd = maxShots() > 1 ? 0.14 : 0.3;
      sfx.shoot();
    }
  }
}

function shotHits(s) {
  for (let i = birds.length - 1; i >= 0; i--) {
    const b = birds[i];
    if (Math.abs(s.x - b.x) < 16 && s.y < b.y + 8 && s.y + 16 > b.y - 8) { killBird(i, true); return true; }
  }
  for (let i = bigs.length - 1; i >= 0; i--) {
    const b = bigs[i], dx = s.x - b.x;
    if (!(s.y < b.y + 20 && s.y + 16 > b.y - 20)) continue;
    if (Math.abs(dx) < 12) { killBig(i); return true; }
    if (!b.hatched) continue;
    const side = dx < 0 ? 0 : 1;
    if (Math.abs(dx) < 48 && b.wing[side] <= 0) {
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
      if (k.alive && lx >= k.x && lx < k.x + 16 && ly < k.y + 12 && ly + 16 > k.y) {
        k.alive = false;
        sfx.block();
        addScore(k.kind === 'belt' ? 30 : k.kind === 'hull' ? 20 : 10);
        return true;
      }
    }
    if (Math.abs(lx) < 12 && ly < 24 && ly + 16 > 0) { killBoss(); return true; }
  }
  return false;
}

function updShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    let dead = false;
    for (let k = 0; k < 2 && !dead; k++) { s.y -= 240 * dt; dead = s.y < 16 || shotHits(s); }
    if (dead) shots.splice(i, 1);
  }
}

function updBombs(dt) {
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    let dead = b.y > H;
    if (!dead && shieldHit(b.x, b.y)) { dead = true; burst(b.x, b.y); }
    if (!dead && hitsPlayer(b.x, b.y, 2, 4)) dead = killPlayer();
    if (dead) bombs.splice(i, 1);
  }
}

function updBirds(dt) {
  const d = difficulty(), sway = Math.sin(G.t * 0.6) * 28;
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
      b.x = lerp(b.ox, sx, e) + Math.sin(k * 9 + b.ph) * (1 - k) * 40;
      b.y = lerp(b.oy, sy, e);
      if (k >= 1) b.state = 'form';
    } else if (b.state === 'form') {
      b.x = sx; b.y = sy;
      if (b.spin <= 0 && Math.random() < dt * 0.5) b.spin = 0.8;   // birds idly wheel around in formation
      if (!P.dead && Math.random() < dt * 0.04 * d) dropBomb(b.x, b.y + 8);
    } else {
      b.x = clamp(b.ox + Math.sin(b.t * 2.6 + b.ph) * b.amp + clamp(P.x - b.ox, -80, 80) * Math.min(1, b.t / 2), 16, W - 16);
      b.y += (110 + G.loop * 12 + b.sp) * dt;
      if (b.bombs > 0 && b.y > 180 && b.y < 380 && Math.random() < dt * 1.4) { b.bombs--; dropBomb(b.x, b.y + 8, (P.x - b.x) * 0.15); }
      if (b.y > H + 16) Object.assign(b, { state: 'enter', t: 0, dur: 1.5, ox: b.x, oy: -20, y: -20 });
    }
    // the roll: 0 = normal, 1 = narrow side view, 2 = mirrored, 3 = narrow again, then back
    if (b.spin > 0) { b.spin -= dt; b.roll = Math.floor(b.spin * 10) % 4; } else b.roll = 0;
    if (shieldHit(b.x, b.y)) killBird(i, true);
    else if (hitsPlayer(b.x, b.y, 14, 7) && killPlayer()) killBird(i, false);
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
      if (!P.dead && b.y < 340 && Math.random() < dt * 0.35 * d) dropBomb(b.x, b.y + 16, (P.x - b.x) * 0.1);
      if (Math.floor(b.t * 6) !== Math.floor((b.t - dt) * 6) && Math.random() < 0.25) sfx.flap();
    }
    const speed = b.hatched ? b.speed : b.speed * 0.4;
    b.x += b.dir * speed * dt;
    if (b.x < 48) { b.x = 48; b.dir = 1; } else if (b.x > W - 48) { b.x = W - 48; b.dir = -1; }
    let dive = 0;
    if (b.swoop > 0) { dive = Math.sin(Math.PI * (1 - b.swoop / 3)) * 240; b.swoop -= dt; }
    const entry = Math.max(0, 1 - b.t / 2) * -80;
    b.y = Math.min(PY - 24, b.baseY + Math.sin(b.t * 0.8 + b.ph2) * 24 + dive + entry);
    const hw = b.hatched ? 40 : 10;
    if (shieldHit(b.x, b.y)) killBig(i);
    else if (hitsPlayer(b.x, b.y, hw, 16) && killPlayer()) killBig(i);
  }
}

function updMothership(dt) {
  ms.t += dt;
  if (ms.dying > 0) {
    ms.dying -= dt;
    if (Math.random() < dt * 14) burst(ms.x + rand(-160, 160), ms.y + rand(0, 92), Math.random() < 0.4);
    if (ms.dying <= 0) ms = null;
    return;
  }
  ms.y = ms.y < 20 ? ms.y + 36 * dt : Math.min(240, ms.y + (4.4 + 0.8 * G.loop) * dt);
  ms.x = W / 2 + Math.sin(ms.t * 0.4) * 20;
  ms.off = (ms.off + dt * 28) % 320;
  for (const k of ms.blocks) if (k.kind === 'belt') k.x = ((k.x0 + 160 + ms.off) % 320) - 160;
  if (!P.dead && ms.y > 0 && Math.random() < dt * (0.8 + 0.3 * G.loop)) dropBomb(ms.x + rand(-140, 140), ms.y + 84, rand(-20, 20));
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

const FONT = '16px "Press Start 2P", monospace';
function text(s, x, y, color = PAL.W, align = 'left') {
  ctx.font = FONT; ctx.textBaseline = 'top'; ctx.textAlign = align; ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}
const blit = (img, x, y) => ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));
const BRICK = { dome: [PAL.T, '#9ff5ea'], belt: [PAL.Y, '#fff3a0'], hull: [PAL.B, PAL.L] };

function render() {
  ctx.setTransform(view, 0, 0, view, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  for (const s of stars) {
    ctx.fillStyle = s.c;
    ctx.fillRect(s.x, Math.floor(s.y / 2) * 2, 2, 2);
  }

  // mothership: cockpit, alien, then the brickwork
  if (ms) {
    const mx = Math.round(ms.x), my = Math.round(ms.y);
    ctx.fillStyle = PAL.D; ctx.fillRect(mx - 24, my, 48, 24);
    if (!ms.dying || Math.floor(ms.t * 12) % 2) blit(ALIEN, mx, my + 13 + Math.round(Math.sin(ms.t * 5)));
    for (const k of ms.blocks) {
      if (!k.alive) continue;
      const [c, e] = BRICK[k.kind];
      ctx.fillStyle = c; ctx.fillRect(mx + k.x, my + k.y, 15, 11);
      ctx.fillStyle = e; ctx.fillRect(mx + k.x, my + k.y, 15, 2);
      ctx.fillStyle = '#000'; ctx.fillRect(mx + k.x + 15, my + k.y, 1, 12); ctx.fillRect(mx + k.x, my + k.y + 11, 16, 1);
    }
  }

  // eggs and large birds
  for (const b of bigs) {
    if (!b.hatched) { blit(EGG[b.stage], b.x, b.y); continue; }
    const set = BIG[b.kind], f = flapFrame(b.t, 8);
    if (b.wing[0] <= 0) blit(set.left[f], b.x - 28, b.y);
    if (b.wing[1] <= 0) blit(set.right[f], b.x + 28, b.y);
    blit(set.body, b.x, b.y);
  }

  // small birds
  for (const b of birds) {
    const f = b.roll === 1 || b.roll === 3 ? 3 : b.state === 'form' ? flapFrame(G.t + b.ph, 6) : flapFrame(b.t, 14);
    const img = SMALL[b.kind][f];
    if (b.roll === 2) {
      ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.scale(-1, 1);
      ctx.drawImage(img, -16, -8); ctx.restore();
    } else blit(img, b.x, b.y);
  }

  for (const b of bombs) blit(BOMB[Math.floor(G.t * 10) % 2], b.x, b.y);
  ctx.fillStyle = PAL.W;
  for (const s of shots) ctx.fillRect(s.x - 1, Math.round(s.y), 2, 16);

  // player
  if (!P.dead && (P.invuln <= 0 || Math.floor(G.t * 12) % 2 === 0)) {
    ctx.drawImage(PLAYER, Math.round(P.x - 16), PY);
    if (P.shieldT > 0 && Math.floor(G.t * 30) % 3 !== 0) {
      ctx.strokeStyle = PAL.T; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(Math.round(P.x), PC, 32, 0, Math.PI * 2); ctx.stroke();
    }
  }

  for (const b of bursts) {
    const f = clamp(Math.floor(b.t / (b.big ? 0.2 : 0.12)), 0, 2);
    blit(BURST[f], b.x, b.y);
  }
  if (G.bonus && ms) text(String(G.bonus.v), Math.round(ms.x), Math.round(ms.y) + 40, PAL.Y, 'center');
  if (G.flash > 0 && Math.floor(G.flash * 20) % 2) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, 0, W, H); }

  // HUD, drawn last as on the cabinet's top and bottom rows
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 38); ctx.fillRect(0, H - 24, W, 24);
  text('SCORE1', 8, 3, PAL.R); text(String(G.score).padStart(6, '0'), 8, 20);
  text('HI-SCORE', W / 2, 3, PAL.R, 'center'); text(String(G.hi).padStart(6, '0'), W / 2, 20, PAL.W, 'center');
  text('SCORE2', W - 8, 3, PAL.R, 'right'); text('000000', W - 8, 20, PAL.W, 'right');
  for (let i = 0; i < Math.min(G.lives, 6); i++) ctx.drawImage(PLAYER, 0, 0, 32, 28, 8 + i * 20, H - 20, 16, 14);
  text(`R${roundNo()}`, W - 8, H - 19, PAL.Y, 'right');
  if (G.mode === 'menu' && Math.floor(G.t * 2) % 2) text('PUSH START', W / 2, 240, PAL.Y, 'center');
  if (G.clearT >= 0 && G.round < 4 && G.mode === 'play') text(`ROUND ${roundNo() + 1}`, W / 2, 240, PAL.Y, 'center');
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
if (new URLSearchParams(location.search).has('debug')) window.__dbg = { G, P, keys, update, frame, render, birds, bigs, bombs, shots, startRound, get ms() { return ms; } };
