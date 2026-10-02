// Phoenix 2.5D — a remake of the 1980 arcade classic.
// Gameplay runs on a flat XY plane; everything is rendered as 3D models under a tilted perspective camera.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;

const FW = 13;      // half width of the play field
const PY = -9;      // player row
const TOP = 12;     // top of the play field
const HI_KEY = 'phoenix25d.hi';
const STAGE_NAMES = ['Scout Flock', 'Raider Flock', 'Phoenix Hatchery', 'Phoenix Fury', 'Mothership'];
const C = { bg: 0x050b14, teal: 0x2dd4bf, amber: 0xf5b041, coral: 0xef5d50, blue: 0x3b9eff, steel: 0x8fa3b8, hull: 0xdfe7ef, green: 0x9be564 };

// ---------------------------------------------------------------- renderer

const renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(C.bg);
scene.fog = new THREE.Fog(C.bg, 45, 120);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
const camBase = new THREE.Vector3();
const LOOK = new THREE.Vector3(0, -1, 0);

scene.add(new THREE.AmbientLight(0x9fb4c8, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(6, -8, 14);
scene.add(sun);
const rim = new THREE.DirectionalLight(C.teal, 1.2);
rim.position.set(-10, 8, 4);
scene.add(rim);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.5, 0.8);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = innerWidth, h = innerHeight, aspect = w / h;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  // pull back until every corner of the play field projects inside the viewport
  const v = new THREE.Vector3();
  for (let f = 0.8; f < 4; f += 0.02) {
    camBase.set(0, -13 * f - 1, 21 * f);
    camera.position.copy(camBase);
    camera.lookAt(LOOK);
    camera.updateMatrixWorld();
    const fits = [[FW + 1.5, PY - 1.6], [FW + 1.5, TOP + 1]].every(([x, y]) => {
      v.set(x, y, 0).project(camera);
      return Math.abs(v.x) < 1 && v.y > -1 && v.y < 0.8;
    });
    if (fits) break;
  }
}
addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- materials & geometry

const std = (color, emissive = 0x000000, ei = 1) =>
  new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: 0.45, metalness: 0.4, flatShading: true });
const basic = color => new THREE.MeshBasicMaterial({ color });
const M = {
  hull: std(C.hull), teal: std(C.teal, C.teal, 0.25), amber: std(C.amber, C.amber, 0.3), coral: std(C.coral, C.coral, 0.3),
  blue: std(C.blue, C.blue, 0.25), steel: std(C.steel), dark: std(0x1b2a3c), egg: std(0xf2ead8, 0xf2ead8, 0.15), green: std(C.green, C.green, 0.3),
  gTeal: basic(0x7ff5e6), gAmber: basic(0xffd27a), gCoral: basic(0xff8a7a), gGreen: basic(0xc8ff9a), white: basic(0xffffff), black: basic(0x0a1420),
};
const GEO = {
  body: new THREE.OctahedronGeometry(0.42), wing: new THREE.ConeGeometry(0.42, 1.3, 3), beak: new THREE.ConeGeometry(0.14, 0.45, 4),
  eye: new THREE.SphereGeometry(0.09, 8, 6), bullet: new THREE.CapsuleGeometry(0.07, 0.5, 2, 6), bomb: new THREE.OctahedronGeometry(0.2),
  block: new THREE.BoxGeometry(0.94, 0.44, 0.8), egg: new THREE.SphereGeometry(0.5, 12, 10),
};

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d'), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, '#fff'); grad.addColorStop(0.4, 'rgba(255,255,255,.6)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
const DOT = dotTexture();

// ---------------------------------------------------------------- backdrop

const starLayers = [[-10, 200, 0.22, 3], [-30, 300, 0.34, 1.6], [-60, 400, 0.55, 0.8]].map(([z, n, size, speed]) => {
  const span = 30 + Math.abs(z) * 1.3, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pos.set([rand(-span, span), rand(-span, span), z + rand(-4, 4)], i * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: DOT, color: 0xcfe4ff, transparent: true, depthWrite: false, fog: false }));
  pts.frustumCulled = false;
  scene.add(pts);
  return { pos, geo, span, speed, n };
});

const grid = new THREE.GridHelper(160, 80, 0x1b4763, 0x10293f);
grid.rotation.x = Math.PI / 2;
grid.position.z = -5;
grid.material.transparent = true;
grid.material.opacity = 0.55;
scene.add(grid);

const planet = new THREE.Mesh(new THREE.SphereGeometry(20, 48, 32), new THREE.MeshStandardMaterial({ color: 0x1c4a66, roughness: 0.9, fog: false }));
planet.position.set(-105, 125, -110);
scene.add(planet);

function updBackdrop(dt) {
  for (const L of starLayers) {
    for (let i = 0; i < L.n; i++) {
      const j = i * 3 + 1;
      L.pos[j] -= L.speed * dt;
      if (L.pos[j] < -L.span) L.pos[j] += L.span * 2;
    }
    L.geo.attributes.position.needsUpdate = true;
  }
  grid.position.y = -((G.t * 3) % 2);
  planet.rotation.y += dt * 0.02;
}

// ---------------------------------------------------------------- particles

const PN = 1200;
const pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pBase = new Float32Array(PN * 3);
const pLife = new Float32Array(PN), pMax = new Float32Array(PN);
let pNext = 0;
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.5, map: DOT, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
particles.frustumCulled = false;
scene.add(particles);
const tmpC = new THREE.Color();

function boom(x, y, color, n = 18, speed = 7) {
  tmpC.set(color);
  for (let k = 0; k < n; k++) {
    const i = pNext; pNext = (pNext + 1) % PN;
    const a = rand(0, Math.PI * 2), s = rand(0.2, 1) * speed;
    pPos.set([x, y, rand(-0.3, 0.3)], i * 3);
    pVel.set([Math.cos(a) * s, Math.sin(a) * s, rand(-0.5, 0.5) * speed], i * 3);
    pBase.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
    pLife[i] = pMax[i] = rand(0.35, 0.9);
  }
}

function updParticles(dt) {
  const damp = Math.pow(0.12, dt);
  for (let i = 0; i < PN; i++) {
    if (pLife[i] <= 0) continue;
    pLife[i] -= dt;
    const k = Math.max(0, pLife[i] / pMax[i]);
    for (let j = i * 3; j < i * 3 + 3; j++) {
      pPos[j] += pVel[j] * dt;
      pVel[j] *= damp;
      pCol[j] = pBase[j] * k;
    }
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
}

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
function tone(type, f0, f1, dur, vol = 0.1) {
  if (!ac || G.muted) return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
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
const sfx = {
  shoot: () => tone('square', 900, 240, 0.12, 0.05),
  hit: () => { noise(0.2, 0.16, 1500); tone('triangle', 320, 60, 0.2, 0.1); },
  big: () => { noise(0.6, 0.3, 700); tone('sawtooth', 160, 30, 0.5, 0.12); },
  wing: () => tone('square', 520, 260, 0.08, 0.05),
  block: () => tone('square', 240, 120, 0.06, 0.05),
  shield: () => tone('sine', 220, 880, 0.5, 0.1),
  hatch: () => tone('triangle', 300, 900, 0.2, 0.07),
  life: () => { tone('sine', 660, 1320, 0.3, 0.1); },
  wave: () => tone('triangle', 330, 660, 0.4, 0.07),
};

// ---------------------------------------------------------------- models

function makeShip() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2, 6), M.hull);
  body.position.y = 0.2;
  g.add(body);
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.4, 3), M.teal);
    w.scale.set(1, 1, 0.25);
    w.rotation.z = sx * 0.45;
    w.position.set(sx * 0.62, -0.35, 0);
    g.add(w);
    const e = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.3, 8), M.gAmber);
    e.position.set(sx * 0.3, -0.85, 0);
    g.add(e);
  }
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), M.gTeal);
  cockpit.scale.set(1, 1.7, 1);
  cockpit.position.set(0, 0.1, 0.3);
  g.add(cockpit);
  return g;
}

function makeBird(bodyMat, wingMat, s = 1) {
  const g = new THREE.Group(), bird = new THREE.Group();
  g.add(bird);
  const body = new THREE.Mesh(GEO.body, bodyMat);
  body.scale.set(0.85, 1.25, 0.85);
  bird.add(body);
  const beak = new THREE.Mesh(GEO.beak, M.gAmber);
  beak.rotation.z = Math.PI;
  beak.position.y = -0.65;
  bird.add(beak);
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(GEO.eye, M.white);
    e.position.set(sx * 0.16, -0.2, 0.3);
    bird.add(e);
  }
  const pivots = [-1, 1].map(sx => {
    const p = new THREE.Group();
    p.position.x = sx * 0.2;
    const w = new THREE.Mesh(GEO.wing, wingMat);
    w.rotation.z = -sx * Math.PI / 2;
    w.scale.set(1, 1, 0.22);
    w.position.x = sx * 0.75;
    p.add(w);
    bird.add(p);
    return p;
  });
  g.scale.setScalar(s);
  return { g, bird, pivots };
}

function flap(pivots, t, speed, amp) {
  const a = Math.sin(t * speed) * amp;
  pivots[0].rotation.y = a;
  pivots[1].rotation.y = -a;
}

function makeMothership() {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.steel);
  dome.scale.set(9.6, 3.6, 1.4);
  dome.position.z = -1.5;
  g.add(dome);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(20, 0.3, 1.3), M.dark);
  bar.position.set(0, -0.05, -0.3);
  g.add(bar);
  const lights = [];
  for (let i = 0; i < 11; i++) {
    const l = new THREE.Mesh(GEO.eye, i % 2 ? M.gAmber : M.gTeal);
    l.scale.setScalar(1.6);
    l.position.set((i - 5) * 1.9, -0.05, 0.4);
    g.add(l);
    lights.push(l);
  }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 0.2), M.black);
  plate.position.set(0, 0.95, -0.15);
  g.add(plate);
  const alien = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), M.gGreen);
  head.position.y = 0.25;
  alien.add(head);
  const torso = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.7, 6), M.green);
  torso.position.y = -0.35;
  alien.add(torso);
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(GEO.eye, M.black);
    e.scale.set(1.3, 1.8, 1);
    e.position.set(sx * 0.15, 0.28, 0.36);
    alien.add(e);
  }
  alien.position.set(0, 0.8, 0.2);
  g.add(alien);

  const blocks = [];
  const add = (x, y, mat, belt) => {
    const mesh = new THREE.Mesh(GEO.block, mat);
    mesh.position.set(x, y, 0);
    g.add(mesh);
    blocks.push({ mesh, x, y, alive: true, belt, x0: x });
  };
  for (const [n, y] of [[8, -2], [12, -1.5], [16, -1]])
    for (let i = 0; i < n; i++) add(i - (n - 1) / 2, y, M.amber, false);
  for (let i = 0; i < 18; i++) add(i - 8.5, -0.45, M.coral, true);

  return { g, alien, blocks, lights, x: 0, y: TOP + 6, t: 0, off: 0, dying: 0 };
}

// ---------------------------------------------------------------- state

const G = { mode: 'menu', score: 0, hi: 0, lives: 3, stage: 0, loop: 0, t: 0, clearT: -1, bannerT: 0, diveT: 2, nextLife: 10000, muted: false, shake: 0, newHi: false };
try { G.hi = +localStorage.getItem(HI_KEY) || 0; } catch { /* storage unavailable */ }

const P = { x: 0, vx: 0, dead: false, respawn: 0, invuln: 0, shieldT: 0, shieldCd: 0, fireCd: 0 };
const ship = makeShip();
ship.position.set(0, PY, 0);
scene.add(ship);
const shieldMesh = new THREE.Group();
shieldMesh.add(new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 16), new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })));
shieldMesh.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.65, 1), new THREE.MeshBasicMaterial({ color: 0x7ff5e6, wireframe: true, transparent: true, opacity: 0.5 })));
shieldMesh.visible = false;
scene.add(shieldMesh);

const bullets = [], bombs = [], birds = [], bigs = [];
let ms = null;

const keys = {};
const difficulty = () => 1 + G.loop * 0.3;
const maxBullets = () => (G.stage === 1 || G.stage === 3 ? 3 : 2);

// ---------------------------------------------------------------- HUD & modals

function updateHUD() {
  $('score').textContent = G.score.toLocaleString();
  $('hi').textContent = G.hi.toLocaleString();
  $('wave').textContent = G.loop * 5 + G.stage + 1;
  $('lives').innerHTML = '<i></i>'.repeat(Math.max(0, G.lives));
}

function banner(title, sub) {
  $('banner-title').textContent = title;
  $('banner-sub').textContent = sub;
  $('banner').classList.add('show');
  G.bannerT = 2.2;
}

const CONTROLS = `<div class="keys">
  <kbd>&larr; &rarr;</kbd><span>Move (or A / D)</span>
  <kbd>Space</kbd><span>Fire</span>
  <kbd>&darr;</kbd><span>Shield (or S / Shift) &mdash; recharges</span>
  <kbd>P</kbd><span>Pause</span>
  <kbd>M</kbd><span>Mute</span>
</div>`;

const ABOUT = `<div class="about">
  <h2>The original</h2>
  <p><strong>Phoenix</strong> reached arcades in 1980. It is generally credited to Amstar Electronics of Phoenix, Arizona, and was distributed by Centuri in North America and Taito in Japan.</p>
  <p>It was among the first full-colour shooters built from distinct stages, and its mothership finale is remembered as one of the earliest boss fights in video games. The force-field shield and the birds whose wings grow back were its signatures.</p>
  <h2>This remake</h2>
  <p>An unofficial, non-commercial fan tribute written from scratch. It uses no code, graphics or sound from the original, and is not affiliated with or endorsed by its rights holders.</p>
  <h2>Credits</h2>
  <p>Created by <strong>Roberto Renz</strong>, built with Claude Code.<br>
  Rendering: <a href="https://threejs.org" target="_blank" rel="noopener">Three.js</a> (MIT).
  Typeface: Chakra Petch by Cadson Demak (SIL OFL).<br>
  Source: <a href="https://github.com/robertorenz/phoenix" target="_blank" rel="noopener">github.com/robertorenz/phoenix</a> (MIT).</p>
</div>`;

let modalBack = null;   // set while the About view is open: re-shows the modal underneath
function showModal(kicker, title, body, btn, about = false) {
  $('m-kicker').textContent = kicker;
  $('m-title').textContent = title;
  $('m-body').innerHTML = body;
  $('m-btn').textContent = btn;
  $('m-alt').hidden = !about;
  $('modal').classList.add('open');
  $('m-btn').focus();
}
const hideModal = () => $('modal').classList.remove('open');
const showMenu = () => showModal('A 2.5D arcade remake', 'PHOENIX', `Clear the flocks, crack the eggs, and bring down the mothership.${CONTROLS}`, 'Start Game', true);
const showPause = () => showModal('Game', 'Paused', CONTROLS, 'Resume', true);

function modalAction() {
  audio();
  if (modalBack) { const back = modalBack; modalBack = null; back(); }
  else if (G.mode === 'paused') { hideModal(); G.mode = 'play'; }
  else if (G.mode !== 'play') newGame();
}
$('m-btn').addEventListener('click', modalAction);
$('m-alt').addEventListener('click', () => {
  if (G.mode === 'play') return;
  modalBack = G.mode === 'paused' ? showPause : showMenu;
  showModal('Arcade, 1980', 'About', ABOUT, 'Back');
});

function togglePause() {
  if (G.mode === 'play') {
    G.mode = 'paused';
    showPause();
  } else if (G.mode === 'paused') modalAction();
}

function gameOver() {
  G.mode = 'over';
  const body = `<span class="big">${G.score.toLocaleString()}</span>` +
    (G.newHi ? '<span class="new">New high score</span>' : `High score <strong>${G.hi.toLocaleString()}</strong>`) +
    `<br>You reached wave <strong>${G.loop * 5 + G.stage + 1}</strong>.`;
  showModal('Final score', 'Game Over', body, 'Play Again');
}

// ---------------------------------------------------------------- input

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

function clearList(list) {
  for (const e of list) scene.remove(e.g || e.mesh);
  list.length = 0;
}

function newGame() {
  for (const l of [bullets, bombs, birds, bigs]) clearList(l);
  if (ms) { scene.remove(ms.g); ms = null; }
  Object.assign(G, { mode: 'play', score: 0, lives: 3, stage: 0, loop: 0, nextLife: 10000, newHi: false, shake: 0 });
  Object.assign(P, { x: 0, vx: 0, dead: false, invuln: 2, shieldT: 0, shieldCd: 0, fireCd: 0 });
  ship.visible = true;
  hideModal();
  startStage();
}

function startStage() {
  clearList(bullets); clearList(bombs);
  G.clearT = -1;
  G.diveT = 2.5;
  const s = G.stage;
  banner(`WAVE ${G.loop * 5 + s + 1}`, STAGE_NAMES[s]);
  sfx.wave();
  updateHUD();
  if (s === 0) {
    const slots = [];
    [[6, 9.5], [5, 8], [4, 6.5], [3, 5]].forEach(([n, y]) => { for (let i = 0; i < n; i++) slots.push([(i - (n - 1) / 2) * 2.2, y]); });
    spawnBirds(slots);
  } else if (s === 1) {
    const slots = [];
    for (let k = 0; k < 9; k++) slots.push([(k - 4) * 2.4, 9.5 - Math.abs(k - 4) * 1.1]);
    for (let k = 0; k < 7; k++) slots.push([(k - 3) * 2.4, 6.2 - Math.abs(k - 3) * 1.1]);
    spawnBirds(slots);
  } else if (s < 4) {
    spawnBigs(s === 2 ? 7 : 9);
  } else {
    ms = makeMothership();
    scene.add(ms.g);
    spawnBirds([[-6, -1.5], [6, -1.5], [-8.5, -0.3], [8.5, -0.3], [-10.5, 1], [10.5, 1]]);
  }
}

function spawnBirds(slots) {
  slots.forEach(([sx, sy], i) => {
    const raider = G.stage === 1;
    const m = makeBird(raider ? M.amber : M.coral, raider ? M.coral : M.amber);
    const side = i % 2 ? 1 : -1;
    const b = { ...m, sx, sy, x: side * (FW + 4), y: TOP + 4, ox: side * (FW + 4), oy: TOP + 4, state: 'enter', t: -i * 0.07, dur: 1.8, ph: rand(0, 6.28), sp: rand(0, 2.5), bombs: 0 };
    b.g.position.set(b.x, b.y, 0);
    scene.add(b.g);
    birds.push(b);
  });
}

function spawnBigs(n) {
  for (let i = 0; i < n; i++) {
    const m = makeBird(M.blue, M.teal, 1.6);
    const crest = new THREE.Mesh(GEO.beak, M.gCoral);
    crest.position.y = 0.6;
    m.bird.add(crest);
    const egg = new THREE.Mesh(GEO.egg, M.egg);
    egg.scale.set(0.8, 1.05, 0.8);
    m.g.add(egg);
    m.bird.visible = false;
    const b = { ...m, egg, x: 0, y: TOP + 6, t: 0, hatched: false, hatchAt: rand(2.5, 6.5), grow: 0, amp: 5, sp: rand(0.45, 0.8) * (i % 2 ? 1 : -1), ph: (i / n) * Math.PI * 2, ph2: rand(0, 6.28), swoop: 0, wing: [0, 0] };
    scene.add(b.g);
    bigs.push(b);
  }
}

function addScore(n) {
  G.score += n;
  if (G.score > G.hi) {
    G.hi = G.score; G.newHi = true;
    try { localStorage.setItem(HI_KEY, G.hi); } catch { /* storage unavailable */ }
  }
  if (G.score >= G.nextLife) { G.nextLife += 10000; G.lives++; sfx.life(); }
  updateHUD();
}

function dropBomb(x, y, vx = 0) {
  const mesh = new THREE.Mesh(GEO.bomb, M.gCoral);
  mesh.scale.set(0.8, 1.6, 0.8);
  mesh.position.set(x, y, 0);
  scene.add(mesh);
  bombs.push({ mesh, x, y, vx: clamp(vx, -3, 3), vy: -(8 + G.loop * 0.8) });
}

function killPlayer() {
  if (P.dead || P.invuln > 0 || P.shieldT > 0) return false;
  P.dead = true; P.respawn = 1.8; P.vx = 0;
  ship.visible = false;
  boom(P.x, PY, C.teal, 50, 12); boom(P.x, PY, 0xffffff, 25, 7);
  sfx.big();
  G.shake = 0.7;
  G.lives--;
  updateHUD();
  return true;
}

const shieldHit = (x, y, r) => P.shieldT > 0 && !P.dead && Math.hypot(x - P.x, y - PY) < 1.7 + r;

function killBird(i, scored) {
  const e = birds[i];
  boom(e.x, e.y, C.amber, 16);
  sfx.hit();
  scene.remove(e.g);
  birds.splice(i, 1);
  if (scored) addScore(e.state === 'form' ? 20 : 80);
}

function killBig(i) {
  const e = bigs[i];
  boom(e.x, e.y, e.hatched ? C.blue : 0xf2ead8, e.hatched ? 34 : 14, e.hatched ? 9 : 6);
  if (e.hatched) boom(e.x, e.y, C.teal, 16, 5);
  e.hatched ? sfx.big() : sfx.hit();
  scene.remove(e.g);
  bigs.splice(i, 1);
  addScore(e.hatched ? 200 : 50);
}

function killBoss() {
  ms.dying = 1.8;
  for (let i = birds.length - 1; i >= 0; i--) killBird(i, false);
  clearList(bombs);
  sfx.big();
  G.shake = 1;
  addScore(2000 + 1000 * Math.min(G.loop, 7));
}

// ---------------------------------------------------------------- update

function updPlayer(dt) {
  if (P.dead) {
    P.respawn -= dt;
    if (P.respawn <= 0) {
      if (G.lives <= 0) { gameOver(); return; }
      Object.assign(P, { dead: false, x: 0, invuln: 2.5 });
    }
    shieldMesh.visible = false;
    return;
  }
  P.invuln -= dt; P.shieldCd -= dt; P.fireCd -= dt;
  if (P.shieldT > 0) {
    P.shieldT -= dt;   // as in the original, the ship is rooted while the shield is up
  } else {
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    P.vx = lerp(P.vx, dir * 14, Math.min(1, dt * 14));
    P.x = clamp(P.x + P.vx * dt, -FW, FW);
    if (keys.shield && P.shieldCd <= 0) {
      P.shieldT = 1.4; P.shieldCd = 6; P.vx = 0;
      sfx.shield();
    } else if (keys.fire && P.fireCd <= 0 && bullets.length < maxBullets()) {
      const mesh = new THREE.Mesh(GEO.bullet, M.gTeal);
      mesh.position.set(P.x, PY + 1.2, 0);
      scene.add(mesh);
      bullets.push({ mesh, x: P.x, y: PY + 1.2 });
      P.fireCd = 0.16;
      sfx.shoot();
    }
  }
  ship.position.set(P.x, PY, 0);
  ship.rotation.y = P.vx * 0.04;
  ship.visible = P.invuln > 0 ? Math.floor(G.t * 14) % 2 === 0 : true;
  shieldMesh.visible = P.shieldT > 0;
  if (shieldMesh.visible) {
    shieldMesh.position.copy(ship.position);
    shieldMesh.rotation.z += dt * 2; shieldMesh.rotation.x += dt * 1.3;
    shieldMesh.scale.setScalar(1 + Math.sin(G.t * 30) * 0.04);
  }
}

function bulletHits(b) {
  for (let i = birds.length - 1; i >= 0; i--) {
    const e = birds[i];
    if (Math.abs(b.x - e.x) < 0.75 && Math.abs(b.y - e.y) < 0.65) { killBird(i, true); return true; }
  }
  for (let i = bigs.length - 1; i >= 0; i--) {
    const e = bigs[i], dx = b.x - e.x;
    if (Math.abs(b.y - e.y) > 0.85) continue;
    if (Math.abs(dx) < 0.62) { killBig(i); return true; }
    if (!e.hatched) continue;
    const side = dx < 0 ? 0 : 1;
    if (Math.abs(dx) < 2.4 && e.wing[side] <= 0) {   // clipped wings grow back
      e.wing[side] = 5;
      e.pivots[side].visible = false;
      boom(b.x, b.y, C.teal, 10, 5);
      sfx.wing();
      addScore(20);
      return true;
    }
  }
  if (ms && !ms.dying) {
    const lx = b.x - ms.x, ly = b.y - ms.y;
    for (const k of ms.blocks) {
      if (k.alive && Math.abs(lx - k.x) < 0.55 && Math.abs(ly - k.y) < 0.36) {
        k.alive = false; k.mesh.visible = false;
        boom(b.x, b.y, k.belt ? C.coral : C.amber, 7, 4);
        sfx.block();
        addScore(k.belt ? 20 : 10);
        return true;
      }
    }
    if (Math.abs(lx) < 0.7 && Math.abs(ly - 0.8) < 0.7) { killBoss(); return true; }
  }
  return false;
}

function updBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    let dead = false;
    for (let s = 0; s < 2 && !dead; s++) {
      b.y += 15 * dt;
      dead = b.y > TOP + 2 || bulletHits(b);
    }
    if (dead) { scene.remove(b.mesh); bullets.splice(i, 1); }
    else b.mesh.position.y = b.y;
  }
}

function updBombs(dt) {
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.mesh.position.set(b.x, b.y, 0);
    b.mesh.rotation.y += dt * 8;
    let dead = b.y < PY - 2.5;
    if (!dead && shieldHit(b.x, b.y, 0.2)) { dead = true; boom(b.x, b.y, C.teal, 6, 4); }
    if (!dead && !P.dead && Math.abs(b.x - P.x) < 0.6 && Math.abs(b.y - PY) < 0.8) dead = killPlayer();
    if (dead) { scene.remove(b.mesh); bombs.splice(i, 1); }
  }
}

function updBirds(dt) {
  const sway = Math.sin(G.t * 0.7) * 2.5, d = difficulty();
  G.diveT -= dt;
  if (G.diveT <= 0) {
    const ready = birds.filter(b => b.state === 'form');
    if (ready.length && !P.dead) {
      const b = ready[Math.floor(Math.random() * ready.length)];
      b.state = 'dive'; b.t = 0; b.bombs = 2;
    }
    G.diveT = rand(0.5, 1.5) / d * (G.stage === 4 ? 1.6 : G.stage === 1 ? 0.75 : 1);
  }
  for (let i = birds.length - 1; i >= 0; i--) {
    const b = birds[i];
    b.t += dt;
    const sx = b.sx + sway, sy = b.sy + Math.sin(G.t * 1.3 + b.ph) * 0.25;
    let lean = 0;
    if (b.state === 'enter') {
      const k = clamp(b.t / b.dur, 0, 1), e = 1 - (1 - k) ** 3, r = (1 - k) * 4, a = k * 7 + b.ph;
      b.x = lerp(b.ox, sx, e) + Math.cos(a) * r;
      b.y = lerp(b.oy, sy, e) + Math.sin(a) * r;
      if (k >= 1) b.state = 'form';
    } else if (b.state === 'form') {
      b.x = sx; b.y = sy;
      if (!P.dead && Math.random() < dt * 0.035 * d) dropBomb(b.x, b.y - 0.6);
    } else {
      const vx = Math.cos(b.t * 3.2 + b.ph) * 7 + clamp(P.x - b.x, -1, 1) * 3.5;
      b.x = clamp(b.x + vx * dt, -FW, FW);
      b.y -= (5.5 + G.loop * 0.8 + b.sp) * dt;
      lean = vx * 0.06;
      if (b.bombs > 0 && b.y < 5 && b.y > PY + 3 && Math.random() < dt * 1.3) { b.bombs--; dropBomb(b.x, b.y - 0.6, (P.x - b.x) * 0.2); }
      if (b.y < PY - 3) Object.assign(b, { state: 'enter', t: 0, dur: 1.6, ox: b.x, oy: TOP + 3, y: TOP + 3 });
    }
    b.g.position.set(b.x, b.y, 0);
    b.g.rotation.z = lerp(b.g.rotation.z, lean, Math.min(1, dt * 8));
    flap(b.pivots, G.t + b.ph, b.state === 'form' ? 9 : 16, 0.65);
    if (shieldHit(b.x, b.y, 0.5)) killBird(i, true);
    else if (!P.dead && Math.abs(b.x - P.x) < 0.95 && Math.abs(b.y - PY) < 0.95 && killPlayer()) killBird(i, false);
  }
}

function updBigs(dt) {
  const d = difficulty();
  for (let i = bigs.length - 1; i >= 0; i--) {
    const b = bigs[i];
    b.t += dt;
    if (!b.hatched && b.t > b.hatchAt) {
      b.hatched = true;
      b.egg.visible = false; b.bird.visible = true;
      boom(b.x, b.y, 0xf2ead8, 12, 5);
      sfx.hatch();
    }
    if (b.hatched) {
      b.grow = Math.min(1, b.grow + dt * 2.5);
      b.bird.scale.setScalar(b.grow);
      b.amp = lerp(b.amp, 10.5, Math.min(1, dt));
      for (const s of [0, 1]) {
        if (b.wing[s] > 0 && (b.wing[s] -= dt) <= 0) b.pivots[s].visible = true;
      }
      if (b.swoop <= 0 && !P.dead && Math.random() < dt * 0.1 * d) b.swoop = 3;
      if (!P.dead && b.y > PY + 4 && Math.random() < dt * 0.4 * d) dropBomb(b.x, b.y - 1, (P.x - b.x) * 0.15);
    }
    let dive = 0;
    if (b.swoop > 0) { dive = Math.sin(Math.PI * (1 - b.swoop / 3)) * 7; b.swoop -= dt; }
    const px = b.x;
    b.x = Math.sin(b.t * b.sp + b.ph) * b.amp;
    b.y = Math.max(PY + 0.8, 5.4 + Math.sin(b.t * 0.45 + b.ph2) * 3.6 + Math.sin(b.t * 1.7 + b.ph) * 0.8 - dive) + Math.max(0, 1 - b.t / 1.5) * 14;
    b.g.position.set(b.x, b.y, 0);
    b.g.rotation.z = lerp(b.g.rotation.z, clamp((b.x - px) / Math.max(dt, 1e-3) * 0.05, -0.5, 0.5), Math.min(1, dt * 6));
    b.egg.rotation.z = Math.sin(b.t * 5) * 0.25;
    flap(b.pivots, b.t, 7, 0.75);
    const reach = b.hatched ? 1.7 : 0.6;
    if (shieldHit(b.x, b.y, 0.8)) killBig(i);
    else if (!P.dead && Math.abs(b.x - P.x) < reach && Math.abs(b.y - PY) < 1 && killPlayer()) killBig(i);
  }
}

function updMothership(dt) {
  ms.t += dt;
  if (ms.dying > 0) {
    ms.dying -= dt;
    if (Math.random() < dt * 22) boom(ms.x + rand(-9, 9), ms.y + rand(-2.2, 3), Math.random() < 0.5 ? C.amber : C.coral, 16, 8);
    ms.g.position.set(ms.x + rand(-0.15, 0.15), ms.y + rand(-0.15, 0.15), 0);
    if (ms.dying <= 0) {
      boom(ms.x, ms.y, 0xffffff, 90, 16); boom(ms.x, ms.y, C.amber, 90, 11);
      sfx.big();
      G.shake = 1.2;
      scene.remove(ms.g);
      ms = null;
    }
    return;
  }
  ms.y = ms.y > 7.5 ? ms.y - 5 * dt : Math.max(2.6, ms.y - (0.1 + 0.03 * G.loop) * dt);
  ms.x = Math.sin(ms.t * 0.35) * 2;
  ms.g.position.set(ms.x, ms.y, 0);
  ms.off = (ms.off + dt * 2.4) % 18;
  for (const k of ms.blocks) {
    if (!k.belt) continue;
    k.x = ((k.x0 + 9 + ms.off) % 18) - 9;
    k.mesh.position.x = k.x;
  }
  ms.alien.position.y = 0.8 + Math.sin(ms.t * 4) * 0.08;
  ms.alien.rotation.y = Math.sin(ms.t * 2) * 0.5;
  ms.lights.forEach((l, i) => l.scale.setScalar(1.2 + 0.7 * Math.max(0, Math.sin(ms.t * 6 - i * 0.9))));
  if (!P.dead && ms.y < 8 && Math.random() < dt * (0.9 + 0.3 * G.loop)) dropBomb(ms.x + rand(-7.5, 7.5), ms.y - 2.4, rand(-1, 1));
}

function update(dt) {
  if (G.bannerT > 0 && (G.bannerT -= dt) <= 0) $('banner').classList.remove('show');
  updPlayer(dt);
  if (G.mode !== 'play') return;
  updBullets(dt);
  updBirds(dt);
  updBigs(dt);
  if (ms) updMothership(dt);
  updBombs(dt);

  const cleared = G.stage < 4 ? birds.length === 0 && bigs.length === 0 : !ms;
  if (cleared && G.clearT < 0) G.clearT = 1.6;
  if (G.clearT >= 0 && !P.dead && (G.clearT -= dt) < 0) {
    if (++G.stage > 4) { G.stage = 0; G.loop++; }
    startStage();
  }

  const fill = $('shield-fill');
  fill.style.width = `${clamp(1 - P.shieldCd / 6, 0, 1) * 100}%`;
  fill.classList.toggle('charging', P.shieldCd > 0);
}

// ---------------------------------------------------------------- main loop

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.t += dt;
  updBackdrop(dt);
  if (G.mode === 'play') update(dt);
  else if (G.mode === 'menu') {
    ship.position.x = Math.sin(G.t * 0.8) * 4;
    ship.rotation.y = Math.cos(G.t * 0.8) * 0.4;
  }
  if (G.mode !== 'paused') updParticles(dt);
  G.shake = Math.max(0, G.shake - dt * 1.5);
  camera.position.set(camBase.x + rand(-1, 1) * G.shake * 0.5, camBase.y + rand(-1, 1) * G.shake * 0.5, camBase.z);
  camera.lookAt(LOOK);
  composer.render();
  requestAnimationFrame(frame);
}

updateHUD();
showMenu();
requestAnimationFrame(frame);

// ?debug exposes the simulation so it can be stepped from the console
if (new URLSearchParams(location.search).has('debug')) window.__dbg = { G, P, keys, update, birds, bigs, bombs, bullets, startStage, get ms() { return ms; } };
