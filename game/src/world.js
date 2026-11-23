// The simulation: player, traffic, pedestrians, police, wanted level, helicopter,
// roadblocks, combat, missions, day/night, garage/shop, save/load. One fixed step
// (1/60 s) so replays are deterministic from the seed.

import { buildCity, CAR_MODELS, districtAt, isOnRoad, collidesWithBuilding, nearestRoadPoint, WORLD_SIZE } from './city.js';
import { makeRng } from './rng.js';
import { MISSIONS, MISSION_PLACES } from './missions.js';

export const STEP = 1 / 60;
export const TRAFFIC_COUNT = 30;
export const PED_COUNT = 50;
export const SAVE_KEY = 'velmar-bay-save-v1';

const TAU = Math.PI * 2;

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

export function createWorld(seed = 'velmar-bay-1') {
  const rng = makeRng(seed);
  const city = buildCity(seed);
  const state = {
    seed, rng, city,
    time: 0, clock: 8.2, // hours; 8:12 AM start
    screen: 'title',
    cash: 1200, health: 100, armour: 0, ammo: 48, kills: 0,
    wanted: 0, wantedTimer: 0, heat: 0,
    missionIndex: 0, missionStep: 0, missionTimer: 0, missionActive: false,
    missionMessage: '', missionFailed: false, missionDone: false,
    radioStation: 0, score: 0, carsStolen: 0, missionsDone: 0, crimeCooldown: 0,
    camera: { x: 460, y: 460 },
    player: { x: 460, y: 460, angle: 0, speed: 0, inCar: null, shooting: false, shootCooldown: 0, invulnerable: 0 },
    cars: [], peds: [], police: [], bullets: [], particles: [], pickups: [],
    heli: { x: 0, y: 0, angle: 0, active: false },
    roadblocks: [],
    raceCheckpoints: [], raceIndex: 0,
    enemies: [], convoyCar: null,
    garageOpen: false, shopOpen: false, paused: false, mapOpen: false,
    garageCars: [0], ownedCars: [0],
    message: '', messageTimer: 0, objectiveFlash: 0,
    stats: { distance: 0, shotsFired: 0, copsDodged: 0 },
    endReason: '',
  };
  spawnTraffic(state);
  spawnPeds(state);
  return state;
}

function spawnTraffic(state) {
  const { rng, city } = state;
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const road = rng.pick(city.roads);
    const vertical = rng.chance(0.5);
    const model = rng.pick(CAR_MODELS);
    state.cars.push(makeCar(state, vertical ? road : rng.range(150, WORLD_SIZE - 150), vertical ? rng.range(150, WORLD_SIZE - 150) : road, vertical ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2), model, 'traffic'));
  }
}

function spawnPeds(state) {
  const { rng } = state;
  for (let i = 0; i < PED_COUNT; i += 1) {
    state.peds.push({
      x: rng.range(150, WORLD_SIZE - 150), y: rng.range(150, WORLD_SIZE - 150),
      angle: rng.range(0, TAU), speed: rng.range(28, 55),
      color: rng.pick(['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#ecf0f1', '#e67e22']),
      walkPhase: rng.range(0, TAU), targetX: 0, targetY: 0, panic: 0,
    });
  }
}

export function makeCar(state, x, y, angle, model, kind) {
  return {
    x, y, angle, speed: 0, model, kind,
    color: kind === 'police' ? '#1b2631' : model.color,
    maxSpeed: kind === 'police' ? 430 : model.speed,
    health: 100, driver: kind !== 'parked', targetAngle: angle,
    siren: kind === 'police', id: state.rng.int(1000, 9999), ramCooldown: 0,
  };
}

function nearestCar(state, x, y, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of state.cars) {
    const d = dist(x, y, car.x, car.y);
    if (d < bestDist) { bestDist = d; best = car; }
  }
  return best;
}

export function enterCar(state) {
  const player = state.player;
  if (player.inCar) return;
  const car = nearestCar(state, player.x, player.y, 70);
  if (!car) return;
  player.inCar = car;
  player.x = car.x; player.y = car.y; player.angle = car.angle;
  state.carsStolen += 1;
  if (car.kind === 'traffic') { car.kind = 'player'; addWanted(state, 1); }
  showMessage(state, `Stole the ${car.model.name}`);
}

export function exitCar(state) {
  const player = state.player;
  if (!player.inCar) return;
  const car = player.inCar;
  player.inCar = null;
  player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 46;
  player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 46;
  player.angle = car.angle;
  player.speed = 0;
}

export function addWanted(state, stars) {
  state.wanted = clamp(state.wanted + stars, 0, 5);
  state.wantedTimer = 0;
  state.heat = Math.max(state.heat, state.wanted);
}

export function showMessage(state, text, seconds = 3) {
  state.message = text;
  state.messageTimer = seconds;
}

function spawnPolice(state, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = state.rng.range(0, TAU);
    const distance = 500 + state.rng.range(0, 300);
    const x = clamp(state.player.x + Math.cos(angle) * distance, 120, WORLD_SIZE - 120);
    const y = clamp(state.player.y + Math.sin(angle) * distance, 120, WORLD_SIZE - 120);
    const car = makeCar(state, x, y, angleTo(x, y, state.player.x, state.player.y), CAR_MODELS[0], 'police');
    state.police.push(car);
  }
}

function spawnRoadblocks(state) {
  state.roadblocks = [];
  const point = nearestRoadPoint(state.player.x, state.player.y, state.city);
  for (let i = -1; i <= 1; i += 1) {
    const along = point.vertical ? point.y + i * 160 : point.x + i * 160;
    state.roadblocks.push({
      x: point.vertical ? point.x : along,
      y: point.vertical ? along : point.y,
      angle: point.vertical ? 0 : Math.PI / 2,
    });
  }
}

function spawnEnemies(state, place, count) {
  state.enemies = [];
  for (let i = 0; i < count; i += 1) {
    state.enemies.push({
      x: place.x + state.rng.range(-120, 120), y: place.y + state.rng.range(-120, 120),
      angle: 0, health: 60, shootCooldown: state.rng.range(0.5, 2), speed: 62,
      color: '#c0392b',
    });
  }
}

function currentObjective(state) {
  const mission = MISSIONS[state.missionIndex];
  if (!mission || state.missionStep >= mission.objectives.length) return null;
  return mission.objectives[state.missionStep];
}

function objectiveTarget(state, objective) {
  if (objective.type === 'race') {
    return state.raceCheckpoints[state.raceIndex] || null;
  }
  if (objective.type === 'ram' && state.convoyCar) return { x: state.convoyCar.x, y: state.convoyCar.y };
  if (objective.type === 'escape' || objective.type === 'survive') return null;
  return MISSION_PLACES[objective.place] ? MISSION_PLACES[objective.place](state.city) : null;
}

export function startMission(state, index) {
  const mission = MISSIONS[index];
  if (!mission) return;
  state.missionIndex = index;
  state.missionStep = 0;
  state.missionActive = true;
  state.missionFailed = false;
  state.missionDone = false;
  state.missionTimer = 0;
  state.raceCheckpoints = [];
  state.raceIndex = 0;
  state.convoyCar = null;
  state.enemies = [];
  const objective = mission.objectives[0];
  if (objective.type === 'race') buildRace(state);
  if (objective.type === 'eliminate') spawnEnemies(state, objectiveTarget(state, objective), objective.count);
  if (objective.type === 'ram') spawnConvoy(state);
  if (index === 3 || index === 9) addWanted(state, index === 9 ? 5 : 3);
  showMessage(state, `MISSION ${mission.id}: ${mission.title} — ${mission.briefing}`, 6);
  state.objectiveFlash = 1;
}

function buildRace(state) {
  const { rng } = state;
  const roads = state.city.roads;
  const points = [{ x: 1400, y: 200 }];
  for (let i = 0; i < 4; i += 1) {
    // Checkpoints sit on road intersections so the whole race stays on roads.
    points.push({ x: rng.pick(roads), y: rng.pick(roads) });
  }
  state.raceCheckpoints = points;
  state.raceIndex = 0;
}

function spawnConvoy(state) {
  const bridge = state.city.bridge;
  const car = makeCar(state, bridge.x, bridge.y - 260, Math.PI / 2, CAR_MODELS[3], 'convoy');
  car.health = 220;
  state.convoyCar = car;
  state.cars.push(car);
}

function completeMission(state) {
  const mission = MISSIONS[state.missionIndex];
  state.cash += mission.reward;
  state.missionsDone += 1;
  state.score += mission.reward;
  state.missionActive = false;
  state.missionDone = true;
  showMessage(state, `MISSION COMPLETE — ${mission.title}  +$${mission.reward}`, 5);
  state.missionIndex += 1;
  state.missionStep = 0;
  if (state.missionIndex < MISSIONS.length) {
    showMessage(state, `MISSION COMPLETE — ${mission.title}  +$${mission.reward}. Next: ${MISSIONS[state.missionIndex].title} (press N)`, 5);
  } else {
    showMessage(state, 'ALL 12 MISSIONS COMPLETE — Velmar Bay is yours, Rae.', 8);
  }
}

function failMission(state, reason) {
  const mission = MISSIONS[state.missionIndex];
  state.missionActive = false;
  state.missionFailed = true;
  state.endReason = reason || mission.fail;
  showMessage(state, `MISSION FAILED — ${state.endReason} (press N to retry)`, 6);
}

function stepMission(state, dt) {
  if (!state.missionActive) return;
  const mission = MISSIONS[state.missionIndex];
  const objective = currentObjective(state);
  if (!objective) { completeMission(state); return; }
  state.missionTimer += dt;
  const player = state.player;
  const target = objectiveTarget(state, objective);

  if (objective.type === 'goto' || objective.type === 'deliver' || objective.type === 'pickup') {
    if (target && dist(player.x, player.y, target.x, target.y) < 90) {
      if (objective.type === 'pickup') showMessage(state, 'Picked up!', 2);
      state.missionStep += 1;
      const next = currentObjective(state);
      if (next) {
        if (next.type === 'eliminate') spawnEnemies(state, objectiveTarget(state, next), next.count);
        if (next.type === 'ram') spawnConvoy(state);
        if (next.type === 'race') buildRace(state);
        showMessage(state, `Objective: ${next.label}`, 4);
      } else completeMission(state);
    }
  } else if (objective.type === 'race') {
    if (target && dist(player.x, player.y, target.x, target.y) < 110) {
      state.raceIndex += 1;
      showMessage(state, `Checkpoint ${state.raceIndex}/5`, 2);
      if (state.raceIndex >= state.raceCheckpoints.length) completeMission(state);
    }
    if (state.missionTimer > objective.seconds) failMission(state, 'Out of time on the race.');
  } else if (objective.type === 'escape') {
    if (state.wanted === 0) {
      state.missionStep += 1;
      const next = currentObjective(state);
      if (next) showMessage(state, `Objective: ${next.label}`, 4);
      else completeMission(state);
    } else if (state.missionTimer > objective.seconds + 90) {
      failMission(state, 'You never shook the cops.');
    }
  } else if (objective.type === 'survive') {
    if (state.missionTimer >= objective.seconds) completeMission(state);
  } else if (objective.type === 'eliminate') {
    if (state.enemies.length === 0) {
      state.missionStep += 1;
      const next = currentObjective(state);
      if (next) showMessage(state, `Objective: ${next.label}`, 4);
      else completeMission(state);
    }
  } else if (objective.type === 'ram') {
    if (!state.convoyCar || state.convoyCar.health <= 0) {
      addWanted(state, 3);
      state.missionStep += 1;
      const next = currentObjective(state);
      if (next) showMessage(state, `Objective: ${next.label}`, 4);
      else completeMission(state);
    }
  }
}

function stepPlayer(state, input, dt) {
  const player = state.player;
  player.shootCooldown = Math.max(0, player.shootCooldown - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  const driveX = input.axis('a', 'd') || input.axis('ArrowLeft', 'ArrowRight');
  const driveY = input.axis('w', 's') || input.axis('ArrowUp', 'ArrowDown');

  if (player.inCar) {
    const car = player.inCar;
    // driveY is -1 for W (forward) and +1 for S (brake/reverse).
    const accel = driveY < 0 ? 1 : driveY > 0 ? -0.6 : 0;
    const handbrake = input.down(' ') ? 0.86 : 0.985;
    car.speed += accel * 420 * dt;
    car.speed *= Math.pow(handbrake, dt * 60);
    car.speed = clamp(car.speed, -140, car.maxSpeed);
    if (Math.abs(car.speed) > 2) car.angle += driveX * 2.6 * dt * Math.sign(car.speed) * (1 - Math.abs(car.speed) / (car.maxSpeed * 1.6));
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    // Slide along walls: try the full move, then each axis alone, so a car
    // clipping a corner keeps going instead of stopping dead.
    if (!collidesWithBuilding(nx, ny, 22, state.city)) {
      car.x = nx; car.y = ny;
      state.stats.distance += Math.abs(car.speed) * dt;
    } else if (!collidesWithBuilding(nx, car.y, 22, state.city)) {
      car.x = nx;
      car.speed *= 0.9;
      state.stats.distance += Math.abs(car.speed) * dt;
    } else if (!collidesWithBuilding(car.x, ny, 22, state.city)) {
      car.y = ny;
      car.speed *= 0.9;
      state.stats.distance += Math.abs(car.speed) * dt;
    } else {
      if (Math.abs(car.speed) > 120) { car.health -= 8; state.particles.push({ x: nx, y: ny, life: 0.5, color: '#f39c12' }); }
      car.speed *= -0.25;
    }
    car.x = clamp(car.x, 60, WORLD_SIZE - 60);
    car.y = clamp(car.y, 60, WORLD_SIZE - 60);
    player.x = car.x; player.y = car.y; player.angle = car.angle;
    if (car.health <= 0) {
      state.particles.push({ x: car.x, y: car.y, life: 1, color: '#e74c3c' });
      exitCar(state);
      car.health = 0;
      addWanted(state, 1);
      showMessage(state, 'Your car is wrecked!', 3);
    }
  } else {
    const speed = input.down(' ') ? 300 : 185;
    const mx = driveX;
    const my = driveY;
    const len = Math.hypot(mx, my) || 1;
    const nx = player.x + (mx / len) * speed * dt * (mx || my ? 1 : 0);
    const ny = player.y + (my / len) * speed * dt * (mx || my ? 1 : 0);
    if (mx || my) {
      player.angle = Math.atan2(my, mx);
      if (!collidesWithBuilding(nx, player.y, 14, state.city)) player.x = nx;
      if (!collidesWithBuilding(player.x, ny, 14, state.city)) player.y = ny;
      state.stats.distance += speed * dt;
    }
    player.x = clamp(player.x, 40, WORLD_SIZE - 40);
    player.y = clamp(player.y, 40, WORLD_SIZE - 40);
    // Aim with the mouse, shoot with click.
    const cam = state.camera;
    const worldMouseX = input.mouse.x + cam.x - 640;
    const worldMouseY = input.mouse.y + cam.y - 360;
    player.aimAngle = Math.atan2(worldMouseY - player.y, worldMouseX - player.x);
    if (input.mouse.down && player.shootCooldown <= 0 && state.ammo > 0) {
      player.shootCooldown = 0.22;
      state.ammo -= 1;
      state.stats.shotsFired += 1;
      state.bullets.push({
        x: player.x + Math.cos(player.aimAngle) * 24, y: player.y + Math.sin(player.aimAngle) * 24,
        vx: Math.cos(player.aimAngle) * 900, vy: Math.sin(player.aimAngle) * 900, life: 0.7, fromPlayer: true,
      });
      addWanted(state, 0); // shooting in public draws heat via hits below
    }
  }
}

function stepTraffic(state, dt) {
  const player = state.player;
  for (const car of state.cars) {
    if (car === player.inCar || car.kind === 'player') continue;
    if (car.kind === 'convoy') {
      // Convoy flees south along the bridge road.
      car.angle += angleDiff(car.angle, Math.PI / 2) * dt * 1.2;
      car.speed = clamp(car.speed + 260 * dt, 0, 380);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (car.y > WORLD_SIZE - 100) car.y = 200;
      continue;
    }
    // Traffic follows roads: each car keeps its lane direction and stays on its road line.
    const vertical = Math.abs(Math.cos(car.angle)) < 0.5;
    if (vertical) {
      const roadX = nearestRoadPoint(car.x, car.y, state.city).x;
      car.x += (roadX - car.x) * dt * 1.5;
      car.angle += angleDiff(car.angle, car.angle > 0 ? Math.PI / 2 : -Math.PI / 2) * dt * 0.8;
    } else {
      const roadY = nearestRoadPoint(car.x, car.y, state.city).y;
      car.y += (roadY - car.y) * dt * 1.5;
      car.angle += angleDiff(car.angle, Math.abs(car.angle) < Math.PI / 2 ? 0 : Math.PI) * dt * 0.8;
    }
    car.speed = clamp(car.speed + 140 * dt, 0, car.model.speed * 0.55);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!collidesWithBuilding(nx, ny, 22, state.city)) { car.x = nx; car.y = ny; }
    else { car.angle += Math.PI / 2 * dt * 4; car.speed *= 0.5; }
    // Slow down if a car is right ahead.
    for (const other of state.cars) {
      if (other === car) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < 70 && Math.abs(angleDiff(car.angle, angleTo(car.x, car.y, other.x, other.y))) < 0.6) car.speed *= 0.94;
    }
    // Wrap around the city edges so traffic never runs out.
    if (car.x < 80 || car.x > WORLD_SIZE - 80 || car.y < 80 || car.y > WORLD_SIZE - 80) {
      car.x = clamp(car.x, 100, WORLD_SIZE - 100);
      car.y = clamp(car.y, 100, WORLD_SIZE - 100);
      car.angle = state.rng.range(0, TAU);
    }
    // Player ramming a traffic car = a crime (at most one wanted bump per 2 s).
    if (player.inCar && dist(car.x, car.y, player.x, player.y) < 46 && Math.abs(player.inCar.speed) > 120) {
      car.speed = 0;
      car.angle += state.rng.range(-0.4, 0.4);
      if (state.crimeCooldown <= 0) { addWanted(state, 1); state.crimeCooldown = 2; }
      state.particles.push({ x: car.x, y: car.y, life: 0.4, color: '#f1c40f' });
    }
  }
}

function stepPeds(state, dt) {
  const player = state.player;
  for (const ped of state.peds) {
    if (ped.panic > 0) {
      ped.panic -= dt;
      ped.angle = angleTo(player.x, player.y, ped.x, ped.y);
    } else if (state.rng.chance(dt * 0.12)) {
      ped.angle = state.rng.range(0, TAU);
    }
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (!collidesWithBuilding(nx, ny, 10, state.city) && nx > 60 && nx < WORLD_SIZE - 60 && ny > 60 && ny < WORLD_SIZE - 60) {
      ped.x = nx; ped.y = ny;
    } else {
      ped.angle += Math.PI / 2;
    }
    ped.walkPhase += dt * 8;
    if (player.inCar && dist(ped.x, ped.y, player.x, player.y) < 40 && Math.abs(player.inCar.speed) > 60) {
      ped.panic = 3;
      if (state.crimeCooldown <= 0) { addWanted(state, 1); state.crimeCooldown = 2; }
    }
    if (!player.inCar && dist(ped.x, ped.y, player.x, player.y) < 26) {
      ped.panic = 2;
    }
  }
}

function stepPolice(state, dt) {
  const player = state.player;
  const wanted = state.wanted;
  if (wanted > 0) {
    const wantCount = wanted + 1;
    if (state.police.length < wantCount && state.rng.chance(dt * 0.7)) spawnPolice(state, 1);
    if (wanted >= 5 && !state.heli.active) {
      state.heli.active = true;
      state.heli.x = player.x; state.heli.y = player.y - 600;
      showMessage(state, 'AIR ONE overhead — the whole city is hunting you!', 4);
    }
    if (wanted >= 4 && state.roadblocks.length === 0) spawnRoadblocks(state);
  } else {
    if (state.police.length > 0 && state.rng.chance(dt * 0.4)) state.police.pop();
    if (state.heli.active) state.heli.active = false;
    if (state.roadblocks.length > 0) state.roadblocks = [];
  }
  for (const cop of state.police) {
    const targetAngle = angleTo(cop.x, cop.y, player.x, player.y);
    cop.angle += angleDiff(cop.angle, targetAngle) * dt * 2.2;
    cop.speed = clamp(cop.speed + 380 * dt, 0, cop.maxSpeed);
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    if (!collidesWithBuilding(nx, ny, 22, state.city)) { cop.x = nx; cop.y = ny; }
    else { cop.angle += Math.PI * dt; cop.speed *= 0.6; }
    // Ram the player — at most one hit per cop per 0.8 s, so a chase stays drivable.
    const d = dist(cop.x, cop.y, player.x, player.y);
    cop.ramCooldown = Math.max(0, cop.ramCooldown - dt);
    if (d < 52 && cop.ramCooldown <= 0) {
      cop.ramCooldown = 0.8;
      if (player.inCar) {
        player.inCar.speed *= 0.7;
        player.inCar.health -= 4;
        cop.speed *= 0.5;
      } else if (player.invulnerable <= 0) {
        state.health -= 5;
        player.invulnerable = 1;
        showMessage(state, 'Busted? No — fight back or run!', 2);
      }
    }
    // Roadblock collision for the player car: hitting one at speed wrecks it.
    for (const block of state.roadblocks) {
      if (player.inCar && dist(block.x, block.y, player.x, player.y) < 46 && Math.abs(player.inCar.speed) > 100) {
        player.inCar.health -= 25;
        player.inCar.speed *= -0.3;
        state.particles.push({ x: block.x, y: block.y, life: 0.6, color: '#f39c12' });
      }
    }
  }
  // Helicopter circles the player and spots them (slows wanted decay).
  if (state.heli.active) {
    state.heli.angle += dt * 0.9;
    state.heli.x = player.x + Math.cos(state.heli.angle) * 260;
    state.heli.y = player.y + Math.sin(state.heli.angle) * 260;
  }
  // Wanted cools down when the player is far from all cops and out of sight.
  if (wanted > 0) {
    let nearestCop = Infinity;
    for (const cop of state.police) nearestCop = Math.min(nearestCop, dist(cop.x, cop.y, player.x, player.y));
    if (nearestCop > 700 && !state.heli.active) {
      state.wantedTimer += dt;
      if (state.wantedTimer > 14) {
        state.wanted -= 1;
        state.wantedTimer = 0;
        state.stats.copsDodged += 1;
        if (state.wanted === 0) showMessage(state, 'You lost them. Heat is off.', 3);
      }
    } else {
      state.wantedTimer = 0;
    }
  }
  // Busted when health hits zero on foot near cops.
  if (state.health <= 0) {
    state.health = 0;
    state.screen = 'busted';
    state.wanted = 0;
    state.police = [];
    state.heli.active = false;
  }
}

function stepBullets(state, dt) {
  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.fromPlayer) {
      for (const enemy of state.enemies) {
        if (dist(bullet.x, bullet.y, enemy.x, enemy.y) < 22) {
          enemy.health -= 34;
          bullet.life = 0;
          state.particles.push({ x: bullet.x, y: bullet.y, life: 0.3, color: '#e74c3c' });
        }
      }
      for (const cop of state.police) {
        if (dist(bullet.x, bullet.y, cop.x, cop.y) < 26) {
          cop.health -= 30;
          bullet.life = 0;
          addWanted(state, 1);
        }
      }
      if (state.convoyCar && dist(bullet.x, bullet.y, state.convoyCar.x, state.convoyCar.y) < 28) {
        state.convoyCar.health -= 20;
        bullet.life = 0;
      }
    }
    if (collidesWithBuilding(bullet.x, bullet.y, 2, state.city)) bullet.life = 0;
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
  state.enemies = state.enemies.filter((e) => {
    if (e.health <= 0) {
      state.kills += 1;
      state.particles.push({ x: e.x, y: e.y, life: 0.6, color: '#c0392b' });
      return false;
    }
    return true;
  });
  state.police = state.police.filter((cop) => cop.health > 0);
}

function stepEnemies(state, dt) {
  const player = state.player;
  for (const enemy of state.enemies) {
    const d = dist(enemy.x, enemy.y, player.x, player.y);
    enemy.angle = angleTo(enemy.x, enemy.y, player.x, player.y);
    if (d > 320) {
      enemy.x += Math.cos(enemy.angle) * enemy.speed * dt;
      enemy.y += Math.sin(enemy.angle) * enemy.speed * dt;
    }
    enemy.shootCooldown -= dt;
    if (d < 420 && enemy.shootCooldown <= 0) {
      enemy.shootCooldown = 1.4 + state.rng.range(0, 0.8);
      state.bullets.push({
        x: enemy.x, y: enemy.y,
        vx: Math.cos(enemy.angle) * 520, vy: Math.sin(enemy.angle) * 520,
        life: 0.9, fromPlayer: false,
      });
    }
  }
  // Enemy bullets hit the player.
  for (const bullet of state.bullets) {
    if (!bullet.fromPlayer && dist(bullet.x, bullet.y, player.x, player.y) < 18 && player.invulnerable <= 0) {
      state.health -= state.armour > 0 ? 4 : 8;
      if (state.armour > 0) state.armour = Math.max(0, state.armour - 6);
      player.invulnerable = 0.5;
      bullet.life = 0;
    }
  }
}

export function stepWorld(state, input, dt) {
  state.time += dt;
  state.clock = (state.clock + dt / 240) % 24; // a full day in 4 minutes of play
  if (state.messageTimer > 0) state.messageTimer -= dt;
  if (state.crimeCooldown > 0) state.crimeCooldown -= dt;
  if (state.objectiveFlash > 0) state.objectiveFlash -= dt * 0.5;

  stepPlayer(state, input, dt);
  stepTraffic(state, dt);
  stepPeds(state, dt);
  stepPolice(state, dt);
  stepBullets(state, dt);
  stepEnemies(state, dt);
  stepMission(state, dt);

  // Camera follows the player, clamped to the world.
  state.camera.x = clamp(state.player.x - 640, 0, WORLD_SIZE - 1280);
  state.camera.y = clamp(state.player.y - 360, 0, WORLD_SIZE - 720);

  // Particles fade.
  for (const particle of state.particles) particle.life -= dt;
  state.particles = state.particles.filter((p) => p.life > 0);

  // Pickups (cash drops) drift to the player.
  for (const pickup of state.pickups) {
    if (dist(pickup.x, pickup.y, state.player.x, state.player.y) < 40) {
      state.cash += pickup.amount;
      pickup.taken = true;
      showMessage(state, `+$${pickup.amount}`, 1.5);
    }
  }
  state.pickups = state.pickups.filter((p) => !p.taken);
}

export function dayPhase(state) {
  const hour = state.clock;
  if (hour >= 5.5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17.5) return 'day';
  if (hour >= 17.5 && hour < 20) return 'dusk';
  return 'night';
}

export function saveGame(state) {
  const data = {
    cash: state.cash, health: state.health, armour: state.armour, ammo: state.ammo,
    missionIndex: state.missionIndex, missionsDone: state.missionsDone, score: state.score,
    carsStolen: state.carsStolen, kills: state.kills, ownedCars: state.ownedCars,
    playerX: state.player.x, playerY: state.player.y, clock: state.clock,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; }
}

export function loadGame(state) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    state.cash = data.cash; state.health = data.health; state.armour = data.armour;
    state.ammo = data.ammo; state.missionIndex = data.missionIndex;
    state.missionsDone = data.missionsDone; state.score = data.score;
    state.carsStolen = data.carsStolen; state.kills = data.kills;
    state.ownedCars = data.ownedCars || [0];
    state.player.x = data.playerX; state.player.y = data.playerY;
    state.clock = data.clock;
    return true;
  } catch { return false; }
}
