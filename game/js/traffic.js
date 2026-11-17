// Traffic: AI cars that follow roads and stop at intersections, plus pedestrians
// who walk the sidewalks and flee danger.
import { CITY, ROADS_V, ROADS_H, ROAD_W, WORLD, mulberry32, roadPoint, isOnRoad } from './city.js';
import { createCar, updateDrive, carDistance } from './vehicles.js';

const AI_TYPES = ['sedan', 'taxi', 'pickup', 'van', 'sedan', 'taxi'];

export class Traffic {
  constructor(G) {
    this.G = G;
    this.rng = mulberry32(20261117);
    this.cars = [];
    this.peds = [];
    for (let i = 0; i < 14; i++) this.spawnAICar(true);
    for (let i = 0; i < 26; i++) this.spawnPed(true);
  }
  spawnAICar(anywhere) {
    const p = roadPoint(this.rng);
    const type = AI_TYPES[Math.floor(this.rng() * AI_TYPES.length)];
    const angle = p.axis === 'v' ? (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (this.rng() < 0.5 ? 0 : Math.PI);
    const car = createCar(type, p.x, p.y, angle, { ai: true, parked: false });
    car.axis = p.axis;
    car.dir = this.rng() < 0.5 ? 1 : -1;
    car.wait = 0;
    car.cruise = 130 + this.rng() * 70;
    this.cars.push(car);
    return car;
  }
  spawnPed(anywhere) {
    // on a sidewalk next to a road
    const p = roadPoint(this.rng);
    const off = (ROAD_W / 2 + 14) * (this.rng() < 0.5 ? 1 : -1);
    const x = p.axis === 'v' ? p.x + off : p.x;
    const y = p.axis === 'v' ? p.y : p.y + off;
    const ped = {
      x: Math.max(170, Math.min(WORLD.w - 20, x)),
      y: Math.max(20, Math.min(WORLD.h - 20, y)),
      angle: this.rng() * Math.PI * 2,
      speed: 34 + this.rng() * 26,
      axis: p.axis, dir: this.rng() < 0.5 ? 1 : -1,
      flee: 0, color: ['#e8c07a', '#7ab8e8', '#e87a9a', '#9a7ae8', '#7ae8a8'][Math.floor(this.rng() * 5)],
      phase: this.rng() * 6,
    };
    this.peds.push(ped);
    return ped;
  }
  nearestCar(x, y, maxD, exclude) {
    let best = null, bd = maxD;
    for (const c of this.G.allCars()) {
      if (c === exclude) continue;
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  update(dt) {
    const G = this.G;
    // --- AI cars ---
    for (const car of this.cars) {
      if (car.wait > 0) { car.wait -= dt; car.speed = 0; continue; }
      // stop at intersections sometimes (yield)
      const nearInter = ROADS_V.some((rx) => Math.abs(car.x - rx) < 70) && ROADS_H.some((ry) => Math.abs(car.y - ry) < 70);
      if (nearInter && this.rng() < dt * 0.25) car.wait = 0.8 + this.rng() * 1.6;
      // steer along its road axis
      let input = { up: true, down: false, left: false, right: false };
      const targetAngle = car.axis === 'v' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      let diff = targetAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (diff > 0.08) input.right = true; else if (diff < -0.08) input.left = true;
      // slow down for a car ahead
      const aheadX = car.x + Math.cos(car.angle) * 70, aheadY = car.y + Math.sin(car.angle) * 70;
      const blocker = this.nearestCar(aheadX, aheadY, 60, car);
      if (blocker) input.up = false;
      // cap cruise speed: emulate by easing off throttle
      if (Math.abs(car.speed) > car.cruise) input.up = false;
      updateDrive(car, input, dt);
      // turn at road ends / intersections: occasionally switch axis
      const atEnd = car.axis === 'v'
        ? (car.y < 130 && car.dir < 0) || (car.y > WORLD.h - 130 && car.dir > 0)
        : (car.x < 220 && car.dir < 0) || (car.x > WORLD.w - 130 && car.dir > 0);
      if (atEnd || (nearInter && this.rng() < dt * 0.06)) {
        // snap onto nearest road of the other axis and turn
        if (car.axis === 'v') {
          let best = ROADS_H[0], bd = 1e9;
          for (const ry of ROADS_H) { const d = Math.abs(car.y - ry); if (d < bd) { bd = d; best = ry; } }
          car.y = best; car.axis = 'h'; car.dir = this.rng() < 0.5 ? 1 : -1;
        } else {
          let best = ROADS_V[0], bd = 1e9;
          for (const rx of ROADS_V) { const d = Math.abs(car.x - rx); if (d < bd) { bd = d; best = rx; } }
          car.x = best; car.axis = 'v'; car.dir = this.rng() < 0.5 ? 1 : -1;
        }
        car.angle = car.axis === 'v' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      }
      // keep AI cars apart (soft push)
      for (const other of this.cars) {
        if (other === car) continue;
        const d = carDistance(car, other);
        if (d > 0.1 && d < 42) {
          const push = (42 - d) / 42 * 30 * dt;
          const a = Math.atan2(car.y - other.y, car.x - other.x);
          car.x += Math.cos(a) * push; car.y += Math.sin(a) * push;
        }
      }
    }
    // --- pedestrians ---
    const danger = G.danger; // {x, y, until} or null
    const px = G.player.x, py = G.player.y;
    for (const ped of this.peds) {
      let fleeing = false;
      if (danger && G.time < danger.until) {
        const d = Math.hypot(ped.x - danger.x, ped.y - danger.y);
        if (d < 420) fleeing = true;
      }
      if (G.wanted >= 2) {
        const d = Math.hypot(ped.x - px, ped.y - py);
        if (d < 260) fleeing = true;
      }
      let sp = ped.speed;
      if (fleeing) {
        sp = ped.speed * 3.2;
        const a = Math.atan2(ped.y - (danger ? danger.y : py), ped.x - (danger ? danger.x : px));
        ped.angle = a;
        ped.x += Math.cos(a) * sp * dt;
        ped.y += Math.sin(a) * sp * dt;
      } else {
        ped.phase += dt * 6;
        if (ped.axis === 'v') ped.y += ped.dir * sp * dt;
        else ped.x += ped.dir * sp * dt;
        if (ped.x < 170 || ped.x > WORLD.w - 20 || ped.y < 20 || ped.y > WORLD.h - 20) ped.dir *= -1;
        // stay near sidewalk: drift back toward road edge if wandered off
        if (!isOnRoad(ped.x, ped.y)) {
          // walk back toward nearest road centre line
          let best = null, bd = 1e9;
          for (const rx of ROADS_V) { const d = Math.abs(ped.x - rx); if (d < bd) { bd = d; best = { x: rx, y: ped.y }; } }
          for (const ry of ROADS_H) { const d = Math.abs(ped.y - ry); if (d < bd) { bd = d; best = { x: ped.x, y: ry }; } }
          if (best) {
            const a = Math.atan2(best.y - ped.y, best.x - ped.x);
            ped.x += Math.cos(a) * sp * dt * 0.5;
            ped.y += Math.sin(a) * sp * dt * 0.5;
          }
        }
      }
      ped.x = Math.max(160, Math.min(WORLD.w - 10, ped.x));
      ped.y = Math.max(10, Math.min(WORLD.h - 10, ped.y));
    }
    void CITY;
  }
}
