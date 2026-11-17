// Solmar Heat — bootstrap, input, game loop, scene hooks (?scene=chase|drive|mission|foot).
import { WORLD, ROADS_V, ROADS_H, mulberry32, isOnRoad } from './city.js';
import { createPlayer, updateOnFoot } from './player.js';
import { createCar, updateDrive } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { Hud } from './hud.js';
import { AudioSys } from './audio.js';
import { loadSave, saveGame } from './save.js';
import { drawWorld } from './render.js';

window.__errors = [];
window.addEventListener('error', (e) => { window.__errors.push(String(e.message || e.error)); });

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const sceneParam = params.get('scene') || params.get('shot') || '';
const SCENE_MAP = { start: 'foot', play: 'drive', end: 'chase' };
const scene = SCENE_MAP[sceneParam] || sceneParam || null;

const G = {
  ctx, canvas,
  view: { w: 1280, h: 800 },
  camera: { x: 0, y: 0 },
  time: 0,
  state: 'menu', // menu | playing | paused
  wanted: 0,
  story: '',
  toastText: '', toastUntil: 0,
  danger: null,
  lastRamT: 0,
  saveT: 0,
  autoPilot: false,
  mouse: { x: 640, y: 400 },
  keys: {},
};

G.player = createPlayer(880, 1150);
G.audio = new AudioSys();
G.traffic = new Traffic(G);
G.police = new Police(G);
G.combat = new Combat(G);
G.missions = new Missions(G);
G.hud = new Hud(G);
G.parkedCars = [];
G.missionCar = null;

// ---- parked cars around the city (stealable) ----
const PARKED_SPOTS = [
  ['sedan', 420, 900, 0], ['taxi', 1020, 420, Math.PI / 2], ['pickup', 1620, 900, 0],
  ['van', 2220, 1420, Math.PI / 2], ['sedan', 2820, 900, 0], ['pickup', 420, 1920, 0],
  ['taxi', 1620, 2420, Math.PI / 2], ['van', 2820, 1920, 0], ['sedan', 1020, 1920, Math.PI / 2],
  ['sport', 2820, 1420, 0], ['sedan', 2220, 420, Math.PI / 2], ['taxi', 420, 1420, 0],
];
for (const [type, x, y, a] of PARKED_SPOTS) {
  G.parkedCars.push(createCar(type, x, y, a, { parked: true }));
}

G.allCars = function () {
  const list = [...G.parkedCars, ...G.traffic.cars, ...G.police.roadblocks];
  for (const u of G.police.units) if (u.car) list.push(u.car);
  if (G.player.inCar && !list.includes(G.player.inCar)) list.push(G.player.inCar);
  return list;
};

G.spawnMissionCar = function (type, x, y, angle) {
  const car = createCar(type, x, y, angle, { parked: true });
  G.parkedCars.push(car);
  return car;
};

G.toast = function (text, big) {
  G.toastText = text;
  G.toastUntil = G.time + (big ? 5 : 3);
  const el = document.getElementById('hud-toast');
  if (el) el.textContent = text;
};

G.setWanted = function (level, silent) {
  G.wanted = Math.max(0, Math.min(5, level));
  if (!silent && level > 0) G.toast('WANTED LEVEL ' + G.wanted + ' — polisi mengejarmu!');
};

G.addHeat = function (n, witnessed) {
  if (!n) return;
  const nearPolice = G.police.units.some((u) => Math.hypot(u.x - G.player.x, u.y - G.player.y) < 700);
  const nearPed = G.traffic.peds.some((pd) => Math.hypot(pd.x - G.player.x, pd.y - G.player.y) < 160);
  if (nearPolice || nearPed || witnessed) {
    G.setWanted(Math.min(5, G.wanted + n));
  }
};

G.busted = function () {
  const p = G.player;
  const lost = Math.round(p.cash * 0.2);
  p.cash -= lost;
  p.hp = 50;
  G.setWanted(0, true);
  G.police.clearAll();
  if (p.inCar) { p.inCar.driver = null; p.inCar = null; }
  p.x = 1550; p.y = 350;
  G.toast('DITANGKAP! Polisi menyita $' + lost + '. Kamu dibebaskan di safehouse.', true);
  G.audio.fail();
  G.saveSoon();
};

G.wasted = function () {
  const p = G.player;
  const lost = Math.round(p.cash * 0.3);
  p.cash -= lost;
  p.hp = p.maxHp;
  G.setWanted(0, true);
  G.police.clearAll();
  G.combat.enemies = [];
  if (p.inCar) { p.inCar.driver = null; p.inCar = null; }
  p.x = 1550; p.y = 350;
  G.toast('KAMU TUMBANG! Kehilangan $' + lost + '. Bangun di safehouse.', true);
  G.audio.fail();
  G.saveSoon();
};

G.saveSoon = function () { G.saveT = 0; };

// ---- entering / exiting cars ----
G.tryEnterCar = function () {
  const p = G.player;
  if (p.inCar) {
    // exit: step out beside the car
    const car = p.inCar;
    car.driver = null;
    car.speed = 0;
    p.inCar = null;
    p.onFoot = true;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 36;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 36;
    G.audio.blip();
    return;
  }
  let best = null, bd = 70;
  for (const car of G.allCars()) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bd) { bd = d; best = car; }
  }
  if (!best) { G.toast('Tidak ada mobil di dekatmu.'); return; }
  // stealing a traffic car: its driver bails out and flees
  const ti = G.traffic.cars.indexOf(best);
  if (ti !== -1) {
    G.traffic.cars.splice(ti, 1);
    const ped = G.traffic.spawnPed();
    ped.x = best.x + 30; ped.y = best.y + 30;
    G.parkedCars.push(best);
    G.addHeat(1, false);
    G.toast('Kamu mencuri mobil! Sopirnya kabur.');
  } else if (!G.parkedCars.includes(best)) {
    G.parkedCars.push(best);
  } else {
    // parked car: stealing it counts if anyone sees it
    if (best.mission) G.toast('Mobil target didapat!');
    else G.addHeat(1, false);
  }
  best.driver = 'player';
  best.parked = false;
  p.inCar = best;
  p.onFoot = false;
  p.x = best.x; p.y = best.y;
  G.audio.blip();
};

// ---- input ----
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  G.audio.ensure();
  const dir = KEYMAP[e.code];
  if (dir) G.keys[dir] = true;
  if (e.repeat) return;
  if (e.code === 'KeyE') { if (G.state === 'playing') G.tryEnterCar(); }
  if (e.code === 'KeyF') { if (G.state === 'playing') G.combat.playerPunch(); }
  if (e.code === 'KeyG') {
    if (G.state === 'playing') {
      const wx = G.camera.x + G.mouse.x, wy = G.camera.y + G.mouse.y;
      G.combat.playerShoot(wx, wy);
    }
  }
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (e.code === 'Enter' && G.state === 'menu') startGame();
});
window.addEventListener('keyup', (e) => {
  const dir = KEYMAP[e.code];
  if (dir) G.keys[dir] = false;
});
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  G.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
  G.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
});
canvas.addEventListener('mousedown', (e) => {
  G.audio.ensure();
  if (G.state !== 'playing') return;
  const wx = G.camera.x + G.mouse.x, wy = G.camera.y + G.mouse.y;
  G.combat.playerShoot(wx, wy);
});

// ---- menu / pause ----
const menuEl = document.getElementById('menu');
const pauseEl = document.getElementById('pause');
function show(el, on) { if (el) el.style.display = on ? 'flex' : 'none'; }
function startGame() {
  G.audio.ensure();
  G.state = 'playing';
  show(menuEl, false);
  show(pauseEl, false);
  if (!G.missions.announced) {
    G.missions.announced = true;
    G.missions.startMission(G.missions.idx);
  }
  G.audio.jingle();
}
function togglePause() {
  if (G.state === 'playing') { G.state = 'paused'; show(pauseEl, true); }
  else if (G.state === 'paused') { G.state = 'playing'; show(pauseEl, false); }
}
const startBtn = document.getElementById('btn-start');
if (startBtn) startBtn.addEventListener('click', startGame);
const resumeBtn = document.getElementById('btn-resume');
if (resumeBtn) resumeBtn.addEventListener('click', togglePause);
const restartBtn = document.getElementById('btn-restart');
if (restartBtn) restartBtn.addEventListener('click', () => {
  const p = G.player;
  p.hp = p.maxHp; p.cash = 0; p.x = 880; p.y = 1150;
  if (p.inCar) { p.inCar.driver = null; p.inCar = null; }
  G.wanted = 0; G.police.clearAll();
  G.missions.idx = 0; G.missions.completed = [];
  G.missions.startMission(0);
  G.state = 'playing';
  show(pauseEl, false);
});

// ---- autopilot (drives the car toward the mission target; used by ?scene) ----
// Road-seeking: when off-road, head for the nearest road centre line first.
// Stuck recovery: if barely moving while throttling, reverse briefly and turn.
let autoStuckT = 0, autoReverseT = 0;
function autopilotInput(dt) {
  const p = G.player;
  const car = p.inCar;
  const input = { up: true, down: false, left: false, right: false };
  if (!car) return input;
  if (Math.abs(car.speed) < 25) autoStuckT += dt; else autoStuckT = 0;
  if (autoStuckT > 1.2) { autoReverseT = 0.9; autoStuckT = 0; }
  let t = G.missions.targetPos() || { x: 1550, y: 1350 };
  if (!isOnRoad(car.x, car.y)) {
    // nearest point on any road centre line
    let best = null, bd = 1e9;
    for (const rx of ROADS_V) { const d = Math.abs(car.x - rx); if (d < bd) { bd = d; best = { x: rx, y: car.y }; } }
    for (const ry of ROADS_H) { const d = Math.abs(car.y - ry); if (d < bd) { bd = d; best = { x: car.x, y: ry }; } }
    if (best) t = best;
  }
  const want = Math.atan2(t.y - car.y, t.x - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (autoReverseT > 0) {
    autoReverseT -= dt;
    input.up = false; input.down = true;
    if (diff > 0.1) input.left = true;
    else if (diff < -0.1) input.right = true;
    return input;
  }
  if (diff > 0.1) input.right = true;
  else if (diff < -0.1) input.left = true;
  return input;
}

// ---- scene setup (dev hook: ?scene=chase|drive|mission|foot) ----
function setupScene(name) {
  const p = G.player;
  G.autoPilot = true;
  if (name === 'foot') {
    p.x = 950; p.y = 1250;
    G.missions.idx = 0;
    G.missions.startMission(0);
  } else if (name === 'drive') {
    const car = G.parkedCars[0];
    p.inCar = car; p.onFoot = false; car.driver = 'player'; car.parked = false;
    car.x = 1550; car.y = 1350; car.angle = 0; car.speed = 200;
    G.missions.idx = 1; G.missions.startMission(1);
    G.missions.timer = 88;
  } else if (name === 'chase') {
    const car = G.spawnMissionCar('sport', 1550, 1350, 0);
    p.inCar = car; p.onFoot = false; car.driver = 'player'; car.parked = false;
    car.speed = 260;
    p.cash = 1250;
    G.missions.idx = 5; G.missions.stage = 'flee';
    G.missions.announced = true;
    G.story = 'Mama Luz: "Sport itu milikmu sekarang — tapi seluruh Solmar mengejarmu. Ke Marina, Rico!"';
    G.setWanted(3, true);
    for (let i = 0; i < 3; i++) G.police.spawnUnit();
    // pull the chase pack in close behind the player so the pursuit is on screen
    const pack = [[-380, 60], [-470, -90], [300, 320]];
    G.police.units.forEach((u, i) => {
      if (!u.car || !pack[i]) return;
      u.car.x = p.inCar.x + pack[i][0];
      u.car.y = p.inCar.y + pack[i][1];
      u.car.angle = Math.atan2(p.inCar.y - u.car.y, p.inCar.x - u.car.x);
      u.car.speed = 220;
      u.x = u.car.x; u.y = u.car.y;
    });
    G.toast('KEJARAN POLISI! Wanted 3 — kabur ke Marina Bay!', true);
  } else if (name === 'mission') {
    p.x = 950; p.y = 2120; p.pistol = true; p.ammo = 18; p.cash = 900;
    G.missions.idx = 3; G.missions.stage = 'fight';
    G.missions.announced = true;
    G.story = 'Mama Luz: "Kru rival mau merampok deal di docks. Habisi mereka, amankan uangnya."';
    G.combat.spawnEnemies(950, 2350, 3);
    G.toast('MISi 4 — Dockside Deal: kalahkan kru rival!', true);
  }
  G.state = 'playing';
  show(menuEl, false);
  show(pauseEl, false);
}

// ---- restore save ----
const saved = loadSave();
if (saved) {
  G.player.cash = saved.cash;
  G.player.pistol = saved.pistol;
  G.player.ammo = saved.ammo;
  G.missions.idx = saved.missionIdx;
  G.missions.completed = saved.completed || [];
  G.story = 'Save dimuat: $' + saved.cash + ', misi ' + (saved.missionIdx + 1) + ' terbuka.';
}

// ---- update ----
function update(dt) {
  G.time += dt;
  const p = G.player;
  // input: autopilot overrides in scene mode
  let input = { up: !!G.keys.up, down: !!G.keys.down, left: !!G.keys.left, right: !!G.keys.right };
  if (G.autoPilot && p.inCar) input = autopilotInput(dt);
  if (p.inCar) {
    const hardHit = updateDrive(p.inCar, input, dt);
    if (hardHit) {
      G.danger = { x: p.inCar.x, y: p.inCar.y, until: G.time + 1.5 };
      G.audio.punch();
      p.inCar.hp -= 5;
      if (p.inCar.hp <= 0) {
        G.toast('Mobilmu hancur! Keluar sebelum meledak.');
        p.inCar.hp = 40; p.inCar.speed = 0;
      }
    }
    p.x = p.inCar.x; p.y = p.inCar.y; p.angle = p.inCar.angle;
    // speeding past police raises heat
    if (Math.abs(p.inCar.speed) > 380) {
      const nearCop = G.police.units.some((u) => Math.hypot(u.x - p.x, u.y - p.y) < 420);
      if (nearCop && Math.random() < dt * 0.5) G.setWanted(Math.min(5, G.wanted + 1));
    }
    G.audio.setEngine(Math.abs(p.inCar.speed) / 470, true);
  } else {
    updateOnFoot(p, input, dt);
    G.audio.setEngine(0, false);
  }
  G.traffic.update(dt);
  G.police.update(dt);
  G.combat.update(dt);
  G.missions.update(dt);
  G.audio.update(dt, G.wanted);
  // camera follows player / car
  const tx = p.x - G.view.w / 2, ty = p.y - G.view.h / 2;
  G.camera.x = Math.max(0, Math.min(WORLD.w - G.view.w, tx));
  G.camera.y = Math.max(0, Math.min(WORLD.h - G.view.h, ty));
  // toast expiry
  if (G.toastText && G.time > G.toastUntil) G.toastText = '';
  // autosave every 8s while playing
  G.saveT += dt;
  if (G.saveT > 8) { G.saveT = 0; saveGame(G); }
  G.hud.update();
}

// ---- main loop ----
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  if (G.state === 'playing') update(dt);
  else if (G.state === 'menu') {
    // idle attract: slow camera pan over Downtown
    G.time += dt;
    G.camera.x = 1500 + Math.sin(G.time * 0.05) * 300;
    G.camera.y = 900 + Math.cos(G.time * 0.04) * 200;
    drawWorld(G);
    G.hud.update();
  }
  if (G.state === 'playing') drawWorld(G);
  requestAnimationFrame(frame);
}

// boot
if (scene) setupScene(scene);
else {
  // menu attract frame behind the menu overlay
  drawWorld(G);
}
window.__solmar = G;
window.__solmarReady = true;
requestAnimationFrame(frame);
