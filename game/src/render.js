// Everything on screen: the city, the cars, the people, the helicopter, the
// effects — and the HUD with minimap, wanted stars, mission tracker and radio.
// Drawn on one canvas; day/night tinting is a final overlay.

import { ROAD_WIDTH, WORLD_SIZE, districtAt, RADIO_STATIONS } from './city.js';
import { MISSIONS, missionTitle } from './missions.js';
import { dayPhase } from './world.js';

const TAU = Math.PI * 2;

function formatClock(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function phaseTint(phase) {
  if (phase === 'night') return { overlay: 'rgba(8,12,40,0.42)', sky: '#0b1030' };
  if (phase === 'dusk') return { overlay: 'rgba(120,50,20,0.18)', sky: '#3a1f3d' };
  if (phase === 'dawn') return { overlay: 'rgba(255,170,90,0.10)', sky: '#7a5a6a' };
  return { overlay: 'rgba(255,240,200,0.03)', sky: '#87b5d6' };
}

function drawCar(ctx, car, phase) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const w = 46;
  const h = 22;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  ctx.fillStyle = car.color;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-w / 2 + 8, -h / 2 + 3, 12, h - 6);
  ctx.fillStyle = '#1a2530';
  ctx.fillRect(-w / 2 + 22, -h / 2 + 3, 10, h - 6);
  // Headlights after dark.
  if (phase === 'night' || phase === 'dusk') {
    ctx.fillStyle = 'rgba(255,240,170,0.9)';
    ctx.fillRect(w / 2 - 2, -h / 2 + 2, 4, 5);
    ctx.fillRect(w / 2 - 2, h / 2 - 7, 4, 5);
  }
  if (car.kind === 'police') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-w / 2 + 2, -h / 2 + 2, 10, 4);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-6, -h / 2 - 2, 6, 5);
    ctx.fillStyle = '#3498db';
    ctx.fillRect(0, -h / 2 - 2, 6, 5);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText('VPD', -8, h / 2 - 4);
  }
  if (car.kind === 'convoy') {
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('VEX', -8, 0);
  }
  ctx.restore();
}

function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.rotate(ped.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 3, 7, 5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f5d0a9';
  ctx.beginPath(); ctx.arc(5, 0, 3.5, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, player, phase) {
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.inCar) { ctx.restore(); return; }
  ctx.rotate(player.aimAngle ?? player.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(2, 3, 11, 9, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e8b64c';
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(8, -3, 14, 6); // gun arm
  ctx.fillStyle = '#f5d0a9';
  ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawWorld(ctx, state) {
  const { city, camera } = state;
  const phase = dayPhase(state);
  const tint = phaseTint(phase);
  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  // Ground: district-tinted blocks, then the bay at the south edge.
  ctx.fillStyle = '#3f6b4f';
  ctx.fillRect(camera.x, camera.y, 1280, 720);
  drawDistrictGround(ctx, state);

  // Parks.
  for (const park of city.parks) {
    ctx.fillStyle = '#4a8f5d';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = '#3a7a4c';
    for (let i = 0; i < 8; i += 1) {
      const px = park.x + 20 + ((i * 37) % park.w);
      const py = park.y + 20 + ((i * 53) % park.h);
      ctx.beginPath(); ctx.arc(px, py, 9, 0, TAU); ctx.fill();
    }
  }
  // Water: the bay along the south edge.
  ctx.fillStyle = '#1e6f8e';
  ctx.fillRect(camera.x, city.waterY, 1280, 720 - (city.waterY - camera.y));
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let x = 0; x < WORLD_SIZE; x += 130) {
    ctx.fillRect(x + ((state.time * 20) % 130), city.waterY + 24, 60, 2);
  }

  // Roads.
  for (const road of city.roads) {
    ctx.fillStyle = '#2f3337';
    ctx.fillRect(road - ROAD_WIDTH / 2, 0, ROAD_WIDTH, WORLD_SIZE);
    ctx.fillRect(0, road - ROAD_WIDTH / 2, WORLD_SIZE, ROAD_WIDTH);
    ctx.fillStyle = '#f7d774';
    for (let at = 0; at < WORLD_SIZE; at += 60) {
      ctx.fillRect(road - 2, at, 4, 28);
      ctx.fillRect(at, road - 2, 28, 4);
    }
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(road - ROAD_WIDTH / 2, 0, 3, WORLD_SIZE);
    ctx.fillRect(road + ROAD_WIDTH / 2 - 3, 0, 3, WORLD_SIZE);
    ctx.fillRect(0, road - ROAD_WIDTH / 2, WORLD_SIZE, 3);
    ctx.fillRect(0, road + ROAD_WIDTH / 2 - 3, WORLD_SIZE, 3);
  }

  // Bay Bridge.
  ctx.fillStyle = '#7a6a55';
  ctx.fillRect(city.bridge.x - 60, city.bridge.y - 120, 120, 240);
  ctx.fillStyle = '#f7d774';
  ctx.fillRect(city.bridge.x - 2, city.bridge.y - 120, 4, 240);

  // Buildings with height shadows and neon signs.
  for (const building of city.buildings) {
    if (building.x + building.w < camera.x - 40 || building.x > camera.x + 1320 ||
        building.y + building.h < camera.y - 40 || building.y > camera.y + 760) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(building.x + 6, building.y + 6 + building.height * 2, building.w, building.h);
    ctx.fillStyle = building.color;
    ctx.fillRect(building.x, building.y, building.w, building.h);
    ctx.fillStyle = building.roof;
    ctx.fillRect(building.x + 5, building.y + 5, building.w - 10, building.h - 10);
    ctx.fillStyle = phase === 'night' ? 'rgba(255,220,120,0.85)' : 'rgba(40,60,90,0.55)';
    for (let wx = building.x + 12; wx < building.x + building.w - 10; wx += 20) {
      for (let wy = building.y + 12; wy < building.y + building.h - 10; wy += 18) {
        ctx.fillRect(wx, wy, 8, 10);
      }
    }
    if (building.neon) {
      ctx.fillStyle = phase === 'night' ? '#ff2e88' : '#c94f7c';
      ctx.fillRect(building.x + 6, building.y - 4, building.w - 12, 5);
    }
  }

  // Fixed places: garage, shops, hideout, docks, casino.
  drawPlace(ctx, city.garage, '#f39c12', 'GARAGE');
  drawPlace(ctx, city.shop, '#2ecc71', 'SHOP');
  drawPlace(ctx, city.shop2, '#2ecc71', 'SHOP');
  drawPlace(ctx, city.hideout, '#9b59b6', 'HIDEOUT');
  drawPlace(ctx, city.docks, '#3498db', 'DOCKS');
  drawPlace(ctx, city.casino, '#ff2e88', 'CASINO');

  // Race checkpoints.
  state.raceCheckpoints.forEach((point, index) => {
    const active = index === state.raceIndex;
    ctx.strokeStyle = active ? '#f1c40f' : '#7f8c8d';
    ctx.lineWidth = active ? 5 : 3;
    ctx.beginPath(); ctx.arc(point.x, point.y, active ? 52 : 34, 0, TAU); ctx.stroke();
    ctx.fillStyle = active ? '#f1c40f' : '#95a5a6';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(index + 1), point.x, point.y + 8);
    ctx.textAlign = 'left';
  });

  // Mission objective marker.
  const target = missionTarget(state);
  if (target) {
    const bob = Math.sin(state.time * 4) * 6;
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.moveTo(target.x, target.y - 46 + bob);
    ctx.lineTo(target.x - 12, target.y - 70 + bob);
    ctx.lineTo(target.x + 12, target.y - 70 + bob);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(241,196,15,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(target.x, target.y, 40 + bob, 0, TAU); ctx.stroke();
  }

  // Roadblocks.
  for (const block of state.roadblocks) {
    ctx.save();
    ctx.translate(block.x, block.y);
    ctx.rotate(block.angle);
    ctx.fillStyle = '#e67e22';
    ctx.fillRect(-40, -10, 80, 20);
    ctx.fillStyle = '#fff';
    for (let i = -30; i < 40; i += 20) ctx.fillRect(i, -10, 10, 20);
    ctx.restore();
  }

  // Pickups.
  for (const pickup of state.pickups) {
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath(); ctx.arc(pickup.x, pickup.y, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('$', pickup.x - 3, pickup.y + 4);
  }

  // Peds, cars, police, enemies, bullets, player.
  for (const ped of state.peds) drawPed(ctx, ped);
  for (const car of state.cars) drawCar(ctx, car, phase);
  for (const cop of state.police) drawCar(ctx, cop, phase);
  // The player's own car draws last so a ramming cop never hides it.
  if (state.player.inCar) drawCar(ctx, state.player.inCar, phase);
  for (const enemy of state.enemies) {
    ctx.fillStyle = enemy.color;
    ctx.beginPath(); ctx.arc(enemy.x, enemy.y, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillRect(enemy.x - 12, enemy.y - 18, 24, 4);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(enemy.x - 12, enemy.y - 18, 24 * (enemy.health / 60), 4);
  }
  for (const bullet of state.bullets) {
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath(); ctx.arc(bullet.x, bullet.y, 3, 0, TAU); ctx.fill();
  }
  for (const particle of state.particles) {
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.fillStyle = particle.color;
    ctx.beginPath(); ctx.arc(particle.x, particle.y, 14 * particle.life + 4, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  drawPlayer(ctx, state.player, phase);
  // A pulsing ring marks the player so they are never lost in traffic.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(state.player.x, state.player.y, 30 + Math.sin(state.time * 3) * 4, 0, TAU);
  ctx.stroke();

  // Helicopter with searchlight.
  if (state.heli.active) {
    ctx.save();
    ctx.translate(state.heli.x, state.heli.y);
    ctx.fillStyle = 'rgba(255,255,200,0.14)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(state.player.x - state.heli.x - 60, state.player.y - state.heli.y - 60);
    ctx.lineTo(state.player.x - state.heli.x + 60, state.player.y - state.heli.y + 60);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(-26, -10, 52, 20);
    ctx.fillStyle = '#888';
    ctx.fillRect(-40, -3, 80, 6);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('AIR ONE', -20, 4);
    ctx.restore();
  }
  ctx.restore();

  // Day/night tint over everything.
  ctx.fillStyle = tint.overlay;
  ctx.fillRect(0, 0, 1280, 720);
}

function drawDistrictGround(ctx, state) {
  const list = state.city.districtList || [];
  for (const district of list) {
    ctx.fillStyle = district.ground;
    ctx.fillRect(district.x, district.y, district.w, district.h);
  }
}

function drawPlace(ctx, place, color, label) {
  ctx.fillStyle = color;
  ctx.fillRect(place.x - 34, place.y - 22, 68, 44);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, place.x, place.y + 4);
  ctx.textAlign = 'left';
}

function missionTarget(state) {
  if (!state.missionActive) return null;
  const mission = MISSIONS[state.missionIndex];
  if (!mission) return null;
  const objective = mission.objectives[state.missionStep];
  if (!objective) return null;
  if (objective.type === 'race') return state.raceCheckpoints[state.raceIndex] || null;
  if (objective.type === 'escape' || objective.type === 'survive') return null;
  if (objective.type === 'ram' && state.convoyCar) return { x: state.convoyCar.x, y: state.convoyCar.y };
  if (objective.type === 'eliminate' && state.enemies.length > 0) return { x: state.enemies[0].x, y: state.enemies[0].y };
  const places = {
    garage: state.city.garage, casino: state.city.casino, docks: state.city.docks,
    plaza: { x: 1430, y: 1400 }, hideout: state.city.hideout,
    flats: { x: 500, y: 1500 }, dockside: { x: 2500, y: 1500 },
    palisades: { x: 1600, y: 2500 }, shop: state.city.shop,
    bridge: state.city.bridge, gardens: { x: 2550, y: 2410 },
  };
  return places[objective.place] || null;
}

export function drawHud(ctx, state) {
  const phase = dayPhase(state);
  const district = districtAt(state.player.x, state.player.y);
  // Top-left: cash, health, armour, ammo.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(16, 14, 250, 92);
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`$${state.cash.toLocaleString('en-US')}`, 28, 44);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.fillText(`HEALTH ${Math.max(0, Math.round(state.health))}`, 28, 68);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(110, 58, 140 * (state.health / 100), 10);
  ctx.fillStyle = '#3498db';
  ctx.fillText(`ARMOUR ${Math.round(state.armour)}`, 28, 92);
  ctx.fillStyle = '#f1c40f';
  ctx.fillText(`AMMO ${state.ammo}  •  KILLS ${state.kills}`, 150, 92);

  // Top-right: wanted stars + clock + district + radio.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(1000, 14, 264, 92);
  ctx.font = 'bold 30px sans-serif';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < state.wanted ? '#f1c40f' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', 1012 + i * 34, 48);
  }
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText(`${formatClock(state.clock)}  •  ${phase.toUpperCase()}`, 1012, 72);
  ctx.fillStyle = '#ffd166';
  ctx.fillText(`${district.name}  •  ${RADIO_STATIONS[state.radioStation].name}`, 1012, 94);

  // Mission tracker (top centre).
  if (state.missionActive) {
    const mission = MISSIONS[state.missionIndex];
    const objective = mission.objectives[state.missionStep];
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const label = objective ? objective.label : '';
    ctx.fillRect(340, 14, 600, 64);
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`MISSION ${mission.id}: ${mission.title}  —  $${mission.reward}`, 356, 38);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    ctx.fillText(`► ${label}`, 356, 62);
    if (objective && (objective.type === 'race' || objective.type === 'survive' || objective.type === 'escape')) {
      const left = Math.max(0, Math.ceil((objective.seconds || 0) - state.missionTimer));
      ctx.fillStyle = '#ff6b6b';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`${left}s`, 900, 62);
    }
  } else if (state.missionIndex < MISSIONS.length) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(340, 14, 600, 40);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    ctx.fillText(`Next mission: ${missionTitle(state.missionIndex)} — press N to start`, 356, 40);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(340, 14, 600, 40);
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('ALL 12 MISSIONS COMPLETE — Velmar Bay is yours!', 356, 40);
  }

  // Bottom-right: speed + car.
  if (state.player.inCar) {
    const car = state.player.inCar;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(1060, 620, 204, 84);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(`${Math.round(Math.abs(car.speed) * 0.36)} km/h`, 1076, 656);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(car.model.name, 1076, 682);
    const carHealth = Math.max(0, Math.min(1, car.health / 100));
    ctx.fillStyle = carHealth > 0.5 ? '#2ecc71' : carHealth > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(1076, 690, 172 * carHealth, 6);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(1060, 620, 204, 84);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText('ON FOOT — press E near a car', 1072, 650);
    ctx.fillText('to steal it. Click to shoot.', 1072, 674);
  }

  // Message banner.
  if (state.messageTimer > 0 && state.message) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.font = 'bold 17px sans-serif';
    const width = ctx.measureText(state.message).width + 32;
    ctx.fillRect((1280 - width) / 2, 120, width, 36);
    ctx.fillStyle = '#ffe27a';
    ctx.textAlign = 'center';
    ctx.fillText(state.message, 640, 144);
    ctx.textAlign = 'left';
  }

  // Controls hint (bottom-centre, clear of the minimap and speed box).
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(240, 682, 800, 28);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '13px sans-serif';
  ctx.fillText('WASD drive/walk  •  E enter car  •  Click shoot  •  Q radio  •  G garage  •  B shop  •  M map  •  P pause', 258, 701);

  drawMinimap(ctx, state);
}

function drawMinimap(ctx, state) {
  const size = 190;
  const x0 = 16;
  const y0 = 516;
  const scale = size / WORLD_SIZE;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x0 - 6, y0 - 6, size + 12, size + 12);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  ctx.fillStyle = '#1d3a2a';
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#2f3337';
  for (const road of state.city.roads) {
    ctx.fillRect(x0 + road * scale - 2, y0, 4, size);
    ctx.fillRect(x0, y0 + road * scale - 2, size, 4);
  }
  ctx.fillStyle = '#1e6f8e';
  ctx.fillRect(x0, y0 + state.city.waterY * scale, size, size);
  // Mission target blip.
  const target = missionTarget(state);
  if (target) {
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(x0 + target.x * scale, y0 + target.y * scale, 6, 0, TAU); ctx.fill();
  }
  // Garage / shop blips.
  ctx.fillStyle = '#f39c12';
  ctx.fillRect(x0 + state.city.garage.x * scale - 3, y0 + state.city.garage.y * scale - 3, 6, 6);
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(x0 + state.city.shop.x * scale - 3, y0 + state.city.shop.y * scale - 3, 6, 6);
  // Police blips.
  ctx.fillStyle = '#3498db';
  for (const cop of state.police) {
    ctx.beginPath(); ctx.arc(x0 + cop.x * scale, y0 + cop.y * scale, 4, 0, TAU); ctx.fill();
  }
  // Player arrow.
  ctx.save();
  ctx.translate(x0 + state.player.x * scale, y0 + state.player.y * scale);
  ctx.rotate(state.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(9, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // North + view box.
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.strokeRect(x0 + state.camera.x * scale, y0 + state.camera.y * scale, 1280 * scale, 720 * scale);
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('N ↑', x0 + size - 26, y0 - 10);
}

export function drawTitle(ctx, state) {
  ctx.fillStyle = '#0b1030';
  ctx.fillRect(0, 0, 1280, 720);
  // Skyline silhouette.
  ctx.fillStyle = '#1a2340';
  for (let x = 0; x < 1280; x += 90) {
    const h = 120 + ((x * 37) % 180);
    ctx.fillRect(x, 720 - 260 - h, 70, h + 260);
  }
  ctx.fillStyle = '#ff2e88';
  ctx.fillRect(0, 430, 1280, 4);
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 92px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VELMAR BAY', 640, 220);
  ctx.fillStyle = '#ff2e88';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('A N   O P E N - W O R L D   C R I M E   G A M E', 640, 268);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('Rae Calloway is back. Twelve missions. Seven districts. One city to take.', 640, 330);
  ctx.fillStyle = '#7ad0ff';
  ctx.font = '17px sans-serif';
  ctx.fillText('WASD move / drive  •  E steal a car  •  Mouse + click to shoot  •  Q radio  •  G garage  •  B shop', 640, 372);
  ctx.fillText('N start next mission  •  M map  •  P pause  •  Progress saves automatically', 640, 400);
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('—  PRESS ENTER TO PLAY  —', 640, 480);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '15px sans-serif';
  ctx.fillText('An original game: Velmar Bay, its people and its story are invented. No Rockstar content.', 640, 540);
  ctx.fillText('12 missions  •  5-star wanted + Air One helicopter  •  30 traffic cars  •  50 pedestrians  •  day/night  •  3 radio stations', 640, 568);
  ctx.textAlign = 'left';
}

export function drawBusted(ctx, state) {
  ctx.fillStyle = 'rgba(10,10,20,0.8)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 84px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BUSTED', 640, 300);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('The VPD hauled you in. Bail posted — you keep your cash, but the heat resets.', 640, 360);
  ctx.fillText('Press ENTER to get back out there.', 640, 400);
  ctx.textAlign = 'left';
}

export function drawPause(ctx, state) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', 640, 260);
  ctx.font = '19px sans-serif';
  ctx.fillText(`Cash $${state.cash}  •  Missions done ${state.missionsDone}/12  •  Cars stolen ${state.carsStolen}  •  Kills ${state.kills}`, 640, 320);
  ctx.fillText('S save game  •  L load game  •  P resume  •  ENTER resume', 640, 360);
  if (state.garageOpen) {
    ctx.fillStyle = '#f39c12';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText("ROOK'S GARAGE — 1 repair ($200)  •  2 armour ($500)  •  3 repaint ($150)", 640, 420);
  }
  if (state.shopOpen) {
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('AMMO-N-GO — 1 ammo +48 ($150)  •  2 armour ($500)  •  3 health ($250)', 640, 420);
  }
  ctx.textAlign = 'left';
}

export function drawMap(ctx, state) {
  ctx.fillStyle = 'rgba(5,8,20,0.92)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VELMAR BAY — CITY MAP', 640, 60);
  ctx.textAlign = 'left';
  const size = 560;
  const x0 = (1280 - size) / 2;
  const y0 = 90;
  const scale = size / WORLD_SIZE;
  ctx.fillStyle = '#1d3a2a';
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#2f3337';
  for (const road of state.city.roads) {
    ctx.fillRect(x0 + road * scale - 3, y0, 6, size);
    ctx.fillRect(x0, y0 + road * scale - 3, size, 6);
  }
  ctx.fillStyle = '#1e6f8e';
  ctx.fillRect(x0, y0 + state.city.waterY * scale, size, size - state.city.waterY * scale);
  ctx.font = 'bold 15px sans-serif';
  for (const district of state.city.districtList || []) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(district.name, x0 + district.x * scale + 6, y0 + district.y * scale + 20);
  }
  const target = missionTarget(state);
  if (target) {
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(x0 + target.x * scale, y0 + target.y * scale, 9, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x0 + state.player.x * scale, y0 + state.player.y * scale, 8, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText('M close map  •  Yellow = mission objective  •  White = you', 360, 690);
}
