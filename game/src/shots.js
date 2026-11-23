// Screenshot scenes: each one plays the real game forward from a fresh world
// for a fixed number of steps, steered by a scripted autopilot, so the frame is
// what real play looks like — and the same seed always gives the same frame.
//   chase  — 5-star chase at dusk, Air One overhead, roadblocks, mission active (cover)
//   night  — night in Neon Row, on foot by the casino, garage marker in view
//   race   — the Neon Sprint race, mid-checkpoint, timer on the HUD
//   street — on-foot combat near the shop, enemies and wanted stars

import { createScriptedInput } from './input.js';
import { startMission, stepWorld, STEP } from './world.js';
import { CAR_MODELS } from './city.js';

const STEPS_PER_SECOND = 60;

function driveToward(state, input, targetX, targetY) {
  const player = state.player;
  // Manhattan routing on the road grid: first travel along the current road to
  // the target's vertical road, then along it to the target's horizontal road,
  // then to the target — never diagonally through city blocks.
  const roads = state.city.roads;
  let vRoad = roads[0];
  let hRoad = roads[0];
  for (const road of roads) {
    if (Math.abs(road - targetX) < Math.abs(vRoad - targetX)) vRoad = road;
    if (Math.abs(road - targetY) < Math.abs(hRoad - targetY)) hRoad = road;
  }
  let wx = targetX;
  let wy = targetY;
  // Nearest horizontal road to the car: travelling along it pulls the car back
  // onto the road centre instead of letting it drift into a building.
  let hCur = roads[0];
  for (const road of roads) {
    if (Math.abs(road - player.y) < Math.abs(hCur - player.y)) hCur = road;
  }
  if (Math.abs(player.x - vRoad) > 50) {
    // Travel along the current road to the target's vertical road.
    wx = vRoad;
    wy = hCur;
  } else if (Math.abs(player.y - hRoad) > 50) {
    wx = vRoad;
    wy = hRoad;
  }
  const dx = wx - player.x;
  const dy = wy - player.y;
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - player.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const near = Math.hypot(dx, dy) < 60;
  const bigTurn = Math.abs(diff) > 1.0;
  const reversing = player.inCar ? player.inCar.speed < 0 : false;
  const speedNow = player.inCar ? Math.abs(player.inCar.speed) : 0;
  // A fast car cannot make a 90° turn inside a road: scrub speed first, then
  // creep through the turn (a stopped car cannot steer). Brake hard while
  // turning, and brake on approach to any waypoint so the car never coasts
  // past an intersection into a building.
  if ((bigTurn && speedNow > 150) || (Math.hypot(dx, dy) < 150 && speedNow > 150)) {
    input.setKey('w', false);
    input.setKey('s', true);
  } else {
    // Creep forward while turning whenever the car is slow: a stopped car
    // cannot steer, so braking to a standstill mid-turn is a deadlock.
    input.setKey('w', !near && (Math.abs(diff) <= 0.6 || bigTurn || speedNow < 40));
    input.setKey('s', !bigTurn && !reversing && Math.abs(diff) > 0.6 && speedNow >= 40);
  }
  input.setKey('a', diff < -0.12);
  input.setKey('d', diff > 0.12);
  input.setKey(' ', false);
}

function runSteps(state, input, seconds, steer) {
  const total = Math.round(seconds * STEPS_PER_SECOND);
  for (let i = 0; i < total; i += 1) {
    steer(state, input, i);
    stepWorld(state, input, STEP);
    input.endFrame();
    if (i % 60 === 0) {
      state._trace = state._trace || [];
      state._trace.push(`${Math.round(state.player.x)},${Math.round(state.player.y)}@${Math.round(state.player.inCar ? state.player.inCar.speed : 0)}`);
    }
  }
}

function putPlayerInCar(state, modelIndex, x, y, angle) {
  const car = {
    x, y, angle, speed: 0, model: CAR_MODELS[modelIndex], kind: 'player',
    color: CAR_MODELS[modelIndex].color, maxSpeed: CAR_MODELS[modelIndex].speed,
    health: 100, driver: true, targetAngle: angle, siren: false, id: 4242,
  };
  state.cars.push(car);
  state.player.inCar = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
}

export function stageShot(name, state) {
  const input = createScriptedInput();
  state.screen = 'play';
  if (name === 'chase') {
    state.clock = 18.4; // dusk
    putPlayerInCar(state, 4, 1560, 1760, Math.PI / 2);
    state.player.inCar.speed = 200;
    state.player.inCar.maxSpeed = 300;
    state.player.inCar.health = 500;
    startMission(state, 9); // FIVE STAR FRENZY — 5-star chase
    state.wanted = 5;
    state.health = 100;
    state.cash = 48250;
    state.armour = 100;
    state.ammo = 96;
    // A head start for the chase, then a winding drive through the city —
    // every leg ends on a road intersection, so the car never leaves the road.
    runSteps(state, input, 4, (s, inp) => driveToward(s, inp, 1400, 2200));
    runSteps(state, input, 3, (s, inp) => driveToward(s, inp, 2200, 2200));
    runSteps(state, input, 3, (s, inp) => driveToward(s, inp, 2200, 1400));
    runSteps(state, input, 2, (s, inp) => driveToward(s, inp, 2200, 600)); // cruise north, mid-chase
    state.messageTimer = 0;
    return { screen: 'play' };
  }
  if (name === 'night') {
    state.clock = 22.6; // night
    state.player.x = 1400;
    state.player.y = 420;
    state.player.angle = Math.PI / 2;
    state.cash = 12840;
    state.health = 100;
    state.armour = 25;
    state.ammo = 48;
    state.wanted = 1;
    startMission(state, 1); // FIRST WHEELS — steal the coupe at the casino
    runSteps(state, input, 1.5, (s, inp) => {
      inp.setKey('s', true); // walk south along the road, toward the casino
      inp.mouse.x = 700;
      inp.mouse.y = 300;
    });
    input.clear();
    state.messageTimer = 0;
    return { screen: 'play' };
  }
  if (name === 'race') {
    state.clock = 11.2; // bright day
    putPlayerInCar(state, 7, 1400, 200, Math.PI / 2);
    state.player.inCar.speed = 200;
    state.player.inCar.maxSpeed = 300;
    state.player.inCar.health = 300;
    state.cash = 21300;
    state.health = 100;
    state.armour = 0;
    state.ammo = 24;
    startMission(state, 4); // NEON SPRINT
    state.wanted = 0;
    runSteps(state, input, 4, (s, inp) => {
      const target = s.raceCheckpoints[s.raceIndex];
      if (target) driveToward(s, inp, target.x, target.y);
    });
    runSteps(state, input, 2, (s, inp) => {
      const target = s.raceCheckpoints[s.raceIndex];
      if (target) driveToward(s, inp, target.x, target.y);
    });
    state.messageTimer = 0;
    return { screen: 'play' };
  }
  // street — on-foot combat at the shop, mission 7.
  state.clock = 15.8; // afternoon
  state.player.x = 620;
  state.player.y = 700;
  state.player.angle = -Math.PI / 2;
  state.cash = 9600;
  state.health = 76;
  state.armour = 50;
  state.ammo = 120;
  state.wanted = 2;
  startMission(state, 6); // GUN RUNNER
  runSteps(state, input, 0.6, (s, inp) => {
    inp.setKey('w', true); // step up to the shop front
    inp.mouse.x = 620;
    inp.mouse.y = 280;
    inp.mouse.down = true;
  });
  input.clear();
  runSteps(state, input, 2.5, (s, inp) => {
    inp.mouse.x = 620;
    inp.mouse.y = 280;
    inp.mouse.down = true; // hold fire on the gunmen
  });
  input.mouse.down = false;
  state.messageTimer = 0;
  return { screen: 'play' };
}
