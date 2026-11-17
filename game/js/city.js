// Solmar city data: districts, roads, buildings, collision. 100% original setting.
export const WORLD = { w: 3600, h: 2700 };
export const ROADS_V = [350, 950, 1550, 2150, 2750];
export const ROADS_H = [350, 850, 1350, 1850, 2350];
export const ROAD_W = 110;
export const SEA_X = 150; // harbour water strip on the west edge (Marina Bay)

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DISTRICTS = [
  { name: 'Marina Bay', color: '#2e6f8e', ground: '#c9b489', label: 'MARINA BAY' },
  { name: 'Old Town', color: '#a8763e', ground: '#cbb28a', label: 'OLD TOWN' },
  { name: 'Downtown', color: '#5a6b8c', ground: '#b8bcc4', label: 'DOWNTOWN' },
  { name: 'Palm Heights', color: '#4e8a4a', ground: '#a9c08a', label: 'PALM HEIGHTS' },
  { name: 'Industrial Docks', color: '#7a6a55', ground: '#9a938a', label: 'INDUSTRIAL DOCKS' },
];

export function districtAt(x, y) {
  if (x < 650 && y < 950) return DISTRICTS[0]; // Marina Bay
  if (y >= 1900) return DISTRICTS[4]; // Industrial Docks (south)
  if (x >= 1500 && x < 2750 && y >= 700 && y < 1850) return DISTRICTS[2]; // Downtown
  if (x >= 2750) return DISTRICTS[3]; // Palm Heights
  return DISTRICTS[1]; // Old Town
}

export function isOnRoad(x, y) {
  const hw = ROAD_W / 2;
  for (const rx of ROADS_V) if (Math.abs(x - rx) <= hw) return true;
  for (const ry of ROADS_H) if (Math.abs(y - ry) <= hw) return true;
  return false;
}

// Deterministic building layout, generated once at boot.
function buildCity() {
  const rng = mulberry32(1337);
  const buildings = [];
  const parks = [];
  const xs = [SEA_X, ...ROADS_V, WORLD.w];
  const ys = [0, ...ROADS_H, WORLD.h];
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const x0 = xs[bi] + ROAD_W / 2 + 14;
      const x1 = xs[bi + 1] - ROAD_W / 2 - 14;
      const y0 = ys[bj] + ROAD_W / 2 + 14;
      const y1 = ys[bj + 1] - ROAD_W / 2 - 14;
      const w = x1 - x0, h = y1 - y0;
      if (w < 60 || h < 60) continue;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const d = districtAt(cx, cy);
      if ((bi * 3 + bj * 7) % 9 === 4) { parks.push({ x: x0, y: y0, w, h, district: d.name }); continue; }
      const palette = {
        'Marina Bay': ['#7fa8b8', '#8fb4c2', '#6d9aa9'],
        'Old Town': ['#c98f5a', '#b97f4e', '#d9a06b', '#a9713f'],
        'Downtown': ['#5a6b8c', '#6b7a99', '#4a5a78', '#7a8aa8'],
        'Palm Heights': ['#e0a080', '#d18a6a', '#c9b18a', '#b98a7a'],
        'Industrial Docks': ['#8a7a66', '#7a6a55', '#99876f', '#6e6252'],
      }[d.name];
      const pick = () => palette[Math.floor(rng() * palette.length)];
      if (d.name === 'Downtown') {
        buildings.push({ x: x0 + w * 0.12, y: y0 + h * 0.12, w: w * 0.76, h: h * 0.76, color: pick(), tall: true, district: d.name });
      } else if (d.name === 'Industrial Docks') {
        buildings.push({ x: x0 + 6, y: y0 + h * 0.18, w: w - 12, h: h * 0.3, color: pick(), tall: false, district: d.name });
        buildings.push({ x: x0 + 6, y: y0 + h * 0.58, w: w - 12, h: h * 0.3, color: pick(), tall: false, district: d.name });
      } else if (d.name === 'Old Town') {
        const cw = w / 2 - 8, ch = h / 2 - 8;
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++)
          buildings.push({ x: x0 + i * (cw + 8), y: y0 + j * (ch + 8), w: cw, h: ch, color: pick(), tall: false, district: d.name });
      } else if (d.name === 'Palm Heights') {
        buildings.push({ x: x0 + 10, y: y0 + 10, w: w * 0.42, h: h * 0.42, color: pick(), tall: false, district: d.name });
        buildings.push({ x: x0 + w * 0.52, y: y0 + h * 0.5, w: w * 0.42, h: h * 0.42, color: pick(), tall: false, district: d.name });
      } else {
        buildings.push({ x: x0 + w * 0.1, y: y0 + h * 0.15, w: w * 0.8, h: h * 0.32, color: pick(), tall: false, district: d.name });
        buildings.push({ x: x0 + w * 0.15, y: y0 + h * 0.58, w: w * 0.7, h: h * 0.3, color: pick(), tall: false, district: d.name });
      }
    }
  }
  return { buildings, parks };
}

export const CITY = buildCity();

export function pointInBuilding(x, y) {
  for (const b of CITY.buildings) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  return null;
}

// Push a circle out of buildings and world bounds. Returns corrected position + hit flag.
export function collideCircle(x, y, r) {
  let hit = false;
  x = Math.max(SEA_X + r, Math.min(WORLD.w - r, x));
  y = Math.max(r, Math.min(WORLD.h - r, y));
  for (const b of CITY.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx, dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r; y = ny + (dy / d) * r;
      } else {
        // centre inside the building: push out along the smallest penetration axis
        const pl = x - b.x, pr = b.x + b.w - x, pt = y - b.y, pb = b.y + b.h - y;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.x - r; else if (m === pr) x = b.x + b.w + r;
        else if (m === pt) y = b.y - r; else y = b.y + b.h + r;
      }
    }
  }
  return { x, y, hit };
}

// A free point on a road, for spawning cars / peds.
export function roadPoint(rng) {
  if (rng() < 0.5) {
    const rx = ROADS_V[Math.floor(rng() * ROADS_V.length)];
    return { x: rx + (rng() - 0.5) * (ROAD_W - 40), y: 120 + rng() * (WORLD.h - 240), axis: 'v' };
  }
  const ry = ROADS_H[Math.floor(rng() * ROADS_H.length)];
  return { x: 220 + rng() * (WORLD.w - 440), y: ry + (rng() - 0.5) * (ROAD_W - 40), axis: 'h' };
}
