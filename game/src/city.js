// Velmar Bay — the city itself. A fixed 3200x3200 world built once from a seed:
// a road grid, 7 named districts, buildings packed into the blocks, and the
// fixed places missions use (garage, shops, docks, the bridge, hideouts).

import { makeRng } from './rng.js';

export const WORLD_SIZE = 3200;
export const ROAD_SPACING = 400;
export const ROAD_WIDTH = 96;

export const DISTRICTS = [
  { name: 'OLD HARBOR', color: '#5b7a8c', x: 0, y: 0, w: 1100, h: 1100, mood: 'docks' },
  { name: 'NEON ROW', color: '#c94f7c', x: 1100, y: 0, w: 1000, h: 1100, mood: 'neon' },
  { name: 'MARLOWE HEIGHTS', color: '#7a6fb0', x: 2100, y: 0, w: 1100, h: 1100, mood: 'towers' },
  { name: 'CINDER FLATS', color: '#a8763e', x: 0, y: 1100, w: 1100, h: 1000, mood: 'industrial' },
  { name: 'PALM COURT', color: '#4f9e6a', x: 1100, y: 1100, w: 1000, h: 1000, mood: 'plaza' },
  { name: 'DOCKSIDE', color: '#3e7a6a', x: 2100, y: 1100, w: 1100, h: 1000, mood: 'docks' },
  { name: 'THE PALISADES', color: '#b08a3e', x: 0, y: 2100, w: 3200, h: 1100, mood: 'mansions' },
];

export const CAR_MODELS = [
  { name: 'Vexor Sedan', color: '#c0392b', speed: 340, price: 0 },
  { name: 'Bayline Coupe', color: '#2980b9', speed: 380, price: 1200 },
  { name: 'Palms Taxi', color: '#f1c40f', speed: 330, price: 900 },
  { name: 'Dune Pickup', color: '#7f8c8d', speed: 350, price: 1500 },
  { name: 'Neon GT', color: '#e91e63', speed: 430, price: 4200 },
  { name: 'Harbor Van', color: '#16a085', speed: 300, price: 1100 },
  { name: 'Palisade Luxe', color: '#2c3e50', speed: 410, price: 6000 },
  { name: 'Cinder Muscle', color: '#d35400', speed: 400, price: 3500 },
];

export const RADIO_STATIONS = [
  { name: 'VELMAR FM', tag: 'SYNTHWAVE', color: '#ff2e88' },
  { name: 'BAY 94', tag: 'FUNKY BASS', color: '#ffb400' },
  { name: 'STATIC 88', tag: 'LO-FI NIGHT', color: '#7ad0ff' },
];

function roadLines() {
  const lines = [];
  for (let at = 200; at < WORLD_SIZE; at += ROAD_SPACING) lines.push(at);
  return lines;
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const roads = roadLines();
  const buildings = [];
  const palette = ['#8d7d6b', '#a89f91', '#7d8ca3', '#9c8a7a', '#6f7f6a', '#b0a08a', '#847b8a', '#93827a'];
  // Buildings fill every block between roads.
  for (let gx = 0; gx < roads.length - 1; gx += 1) {
    for (let gy = 0; gy < roads.length - 1; gy += 1) {
      const x0 = roads[gx] + ROAD_WIDTH / 2 + 14;
      const y0 = roads[gy] + ROAD_WIDTH / 2 + 14;
      const x1 = roads[gx + 1] - ROAD_WIDTH / 2 - 14;
      const y1 = roads[gy + 1] - ROAD_WIDTH / 2 - 14;
      const count = rng.int(2, 4);
      for (let b = 0; b < count; b += 1) {
        const w = rng.range(70, 130);
        const h = rng.range(60, 120);
        const x = rng.range(x0, Math.max(x0 + 1, x1 - w));
        const y = rng.range(y0, Math.max(y0 + 1, y1 - h));
        const district = districtAt(x + w / 2, y + h / 2);
        buildings.push({
          x, y, w, h,
          color: rng.pick(palette),
          height: district.mood === 'towers' ? rng.int(3, 9) : district.mood === 'mansions' ? rng.int(1, 2) : rng.int(1, 4),
          neon: district.mood === 'neon' && rng.chance(0.55),
          roof: rng.pick(['#5d6d7e', '#7b6d5d', '#4a6741', '#6e5a4e']),
        });
      }
    }
  }
  // Parks and the bay: a water strip along the south edge, a plaza in Palm Court.
  const parks = [
    { x: 1300, y: 1300, w: 260, h: 200, name: 'Palm Court Plaza' },
    { x: 2400, y: 2300, w: 300, h: 220, name: 'Palisade Gardens' },
    { x: 300, y: 2400, w: 280, h: 200, name: 'Harbor Green' },
  ];
  return {
    seed, roads, buildings, parks,
    districtList: DISTRICTS.map((d) => ({ ...d, ground: '#46684f' })),
    waterY: 3050,
    garage: { x: 1560, y: 1760, name: "Rook's Garage" },
    shop: { x: 620, y: 620, name: 'Ammo-N-Go' },
    shop2: { x: 2380, y: 1420, name: 'Harbor Outfitters' },
    hideout: { x: 460, y: 460, name: "Rae's Hideout" },
    bridge: { x: 1600, y: 3080, name: 'Bay Bridge' },
    docks: { x: 300, y: 900, name: 'Old Harbor Docks' },
    casino: { x: 1450, y: 300, name: 'Neon Row Casino' },
  };
}

export function districtAt(x, y) {
  for (const district of DISTRICTS) {
    if (x >= district.x && x < district.x + district.w && y >= district.y && y < district.y + district.h) return district;
  }
  return DISTRICTS[DISTRICTS.length - 1];
}

export function nearestRoadPoint(x, y, city) {
  let bestX = city.roads[0];
  let bestY = city.roads[0];
  let bestDx = Infinity;
  let bestDy = Infinity;
  for (const road of city.roads) {
    const dx = Math.abs(road - x);
    const dy = Math.abs(road - y);
    if (dx < bestDx) { bestDx = dx; bestX = road; }
    if (dy < bestDy) { bestDy = dy; bestY = road; }
  }
  return bestDx < bestDy ? { x: bestX, y, vertical: true } : { x, y: bestY, vertical: false };
}

export function collidesWithBuilding(x, y, radius, city) {
  for (const building of city.buildings) {
    if (x + radius > building.x && x - radius < building.x + building.w &&
        y + radius > building.y && y - radius < building.y + building.h) return building;
  }
  return null;
}

export function isOnRoad(x, y, city) {
  for (const road of city.roads) {
    if (Math.abs(x - road) < ROAD_WIDTH / 2 + 6 || Math.abs(y - road) < ROAD_WIDTH / 2 + 6) return true;
  }
  return false;
}
