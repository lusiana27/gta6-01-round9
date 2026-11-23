// VELMAR BAY — boot, game loop, screens, pause/shop/garage menus, save/load,
// and the ?shot= scene mode used for screenshots.
// The loop runs on requestAnimationFrame with a fixed 1/60 s step; the world is
// deterministic from its seed, so the same seed replays the same game.

import { createWorld, stepWorld, startMission, enterCar, exitCar, saveGame, loadGame, STEP, dayPhase } from './world.js';
import { drawWorld, drawHud, drawTitle, drawBusted, drawPause, drawMap } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { MISSIONS } from './missions.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);
const audio = createAudio();
const params = new URLSearchParams(window.location.search);
const seed = params.get('seed') || 'velmar-bay-1';
const shotName = params.get('shot');

const state = createWorld(seed);
let accumulator = 0;
let lastTime = performance.now();
let shotDone = false;

function handleKeys() {
  if (input.wasPressed('Enter')) {
    audio.unlock();
    if (state.screen === 'title') {
      state.screen = 'play';
      if (state.missionIndex < MISSIONS.length && !state.missionActive) startMission(state, state.missionIndex);
    } else if (state.screen === 'busted') {
      state.screen = 'play';
      state.health = 100;
      state.player.x = state.city.hideout.x;
      state.player.y = state.city.hideout.y;
      if (state.player.inCar) exitCar(state);
    }
  }
  if (state.screen !== 'play') return;
  if (input.wasPressed('p') || input.wasPressed('Escape')) {
    state.paused = !state.paused;
    state.garageOpen = false;
    state.shopOpen = false;
  }
  if (state.paused) {
    if (input.wasPressed('s')) {
      if (saveGame(state)) state.message = 'Game saved.';
    }
    if (input.wasPressed('l')) {
      if (loadGame(state)) state.message = 'Save loaded.';
    }
    if (state.garageOpen || state.shopOpen) buyFromMenu();
    return;
  }
  if (input.wasPressed('m')) state.mapOpen = !state.mapOpen;
  if (state.mapOpen) return;
  if (input.wasPressed('e')) {
    if (state.player.inCar) exitCar(state);
    else enterCar(state);
  }
  if (input.wasPressed('q')) {
    audio.nextStation();
    state.radioStation = audio.station;
    state.message = `Radio: ${audio.stationName}`;
    state.messageTimer = 2;
  }
  if (input.wasPressed('n')) {
    if (!state.missionActive && state.missionIndex < MISSIONS.length) {
      startMission(state, state.missionIndex);
    } else if (state.missionFailed) {
      startMission(state, state.missionIndex);
    }
  }
  if (input.wasPressed('g')) {
    const garage = state.city.garage;
    if (Math.hypot(state.player.x - garage.x, state.player.y - garage.y) < 120) {
      state.paused = true;
      state.garageOpen = true;
    }
  }
  if (input.wasPressed('b')) {
    const shop = state.city.shop;
    const shop2 = state.city.shop2;
    const near = Math.hypot(state.player.x - shop.x, state.player.y - shop.y) < 120 ||
      Math.hypot(state.player.x - shop2.x, state.player.y - shop2.y) < 120;
    if (near) {
      state.paused = true;
      state.shopOpen = true;
    }
  }
  if (input.wasPressed('r')) state.ammo = Math.max(state.ammo, 0);
}

function buyFromMenu() {
  const garage = state.garageOpen;
  const price = { 1: garage ? 200 : 150, 2: 500, 3: garage ? 150 : 250 };
  for (const key of ['1', '2', '3']) {
    if (!input.wasPressed(key)) continue;
    const cost = price[key];
    if (state.cash < cost) { state.message = 'Not enough cash.'; return; }
    state.cash -= cost;
    if (garage) {
      if (key === '1' && state.player.inCar) state.player.inCar.health = 100;
      if (key === '2') state.armour = 100;
      if (key === '3' && state.player.inCar) state.player.inCar.color = '#e91e63';
    } else {
      if (key === '1') state.ammo += 48;
      if (key === '2') state.armour = 100;
      if (key === '3') state.health = 100;
    }
    audio.blip(660);
    state.message = 'Purchased. Thanks for shopping in Velmar Bay.';
    state.messageTimer = 2;
  }
}

function frame(now) {
  const elapsed = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  handleKeys();
  if (state.screen === 'play' && !state.paused && !state.mapOpen) {
    accumulator += elapsed;
    while (accumulator >= STEP) {
      stepWorld(state, input, STEP);
      accumulator -= STEP;
    }
  }
  audio.setEngine(state.player.inCar ? Math.abs(state.player.inCar.speed) / 430 : 0, !!state.player.inCar);
  audio.setSiren(state.wanted > 0, state.wanted);
  render();
  input.endFrame();
  requestAnimationFrame(frame);
}

function render() {
  ctx.clearRect(0, 0, 1280, 720);
  if (state.screen === 'title') {
    drawTitle(ctx, state);
    return;
  }
  drawWorld(ctx, state);
  drawHud(ctx, state);
  if (state.mapOpen) drawMap(ctx, state);
  if (state.screen === 'busted') drawBusted(ctx, state);
  if (state.paused) drawPause(ctx, state);
}

// Screenshot mode: stage the scene synchronously on load, draw one frame,
// and stop — the headless browser then captures exactly this frame.
if (shotName) {
  stageShot(shotName, state);
  render();
  document.title = `Velmar Bay — shot ${shotName} | player ${Math.round(state.player.x)},${Math.round(state.player.y)} angle ${state.player.angle.toFixed(2)} screen ${Math.round(state.player.x - state.camera.x)},${Math.round(state.player.y - state.camera.y)} inCar ${!!state.player.inCar} speed ${state.player.inCar ? Math.round(state.player.inCar.speed) : 0} wanted ${state.wanted} copsNear ${state.police.filter((c) => Math.hypot(c.x - state.player.x, c.y - state.player.y) < 60).length} carHealth ${state.player.inCar ? Math.round(state.player.inCar.health) : 0} | trace ${(state._trace || []).join(' ')}`;
  shotDone = true;
} else {
  // Try to resume a save on the title screen's first play.
  const hadSave = loadGame(state);
  if (hadSave) state.message = 'Save found — press ENTER to continue.';
  requestAnimationFrame(frame);
}
