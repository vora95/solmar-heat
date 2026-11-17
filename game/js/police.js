// Police: wanted level, spawning, chasing, ramming, arrest, roadblocks (wanted 5).
import { WORLD, mulberry32 } from './city.js';
import { createCar, updateDrive } from './vehicles.js';

export class Police {
  constructor(G) {
    this.G = G;
    this.rng = mulberry32(777);
    this.units = []; // {car|null, x, y, onFoot, arrestT}
    this.roadblocks = []; // static police cars
    this.spawnT = 0;
    this.unseenT = 0;
  }
  wantedCount() {
    const w = this.G.wanted;
    return w <= 0 ? 0 : w >= 5 ? 6 : w + 1;
  }
  update(dt) {
    const G = this.G;
    const w = G.wanted;
    this.spawnT -= dt;
    // spawn units up to the wanted count
    if (w > 0 && this.units.length < this.wantedCount() && this.spawnT <= 0) {
      this.spawnT = 1.2;
      this.spawnUnit();
    }
    if (w === 0) {
      // stand down gradually
      if (this.units.length > 0 && this.rng() < dt * 0.5) this.units.pop();
      this.roadblocks = [];
    }
    if (w >= 5 && this.roadblocks.length < 3) this.placeRoadblock();
    // chase
    const p = G.player;
    const targetCar = p.inCar;
    let nearest = 1e9;
    for (const u of this.units) {
      const tx = targetCar ? targetCar.x : p.x;
      const ty = targetCar ? targetCar.y : p.y;
      const dx = tx - u.x, dy = ty - u.y;
      const d = Math.hypot(dx, dy);
      if (d < nearest) nearest = d;
      if (u.car) {
        const wantAngle = Math.atan2(dy, dx);
        let diff = wantAngle - u.car.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        // stuck recovery: reverse briefly when wedged against a building
        if (Math.abs(u.car.speed) < 25 && d > 100) u.stuckT = (u.stuckT || 0) + dt; else u.stuckT = 0;
        if (u.stuckT > 1.2) { u.reverseT = 0.9; u.stuckT = 0; }
        let input;
        if (u.reverseT > 0) {
          u.reverseT -= dt;
          input = { up: false, down: true, left: diff > 0.06, right: diff < -0.06 };
        } else {
          input = { up: d > 60, down: false, left: diff < -0.06, right: diff > 0.06 };
        }
        const before = updateDrive(u.car, input, dt);
        u.x = u.car.x; u.y = u.car.y;
        void before;
        // ram the player's car / player
        if (targetCar && d < 52) {
          targetCar.speed *= 0.82;
          targetCar.hp -= 6 * dt * 10 * 0.1;
          if (G.time - (G.lastRamT || 0) > 0.7) {
            G.lastRamT = G.time;
            G.audio.hurt();
            if (!targetCar) {}
          }
          G.addHeat(0);
          if (targetCar.hp <= 0) { targetCar.hp = 0; targetCar.speed = 0; }
        } else if (!targetCar && d < 30) {
          // on-foot arrest pressure
          u.arrestT = (u.arrestT || 0) + dt;
          if (u.arrestT > 1.6) { G.busted(); u.arrestT = 0; }
        } else {
          u.arrestT = 0;
        }
      } else {
        // on-foot officer runs at the player
        const sp = 205;
        u.x += (dx / (d || 1)) * sp * dt;
        u.y += (dy / (d || 1)) * sp * dt;
        if (!targetCar && d < 28) {
          u.arrestT = (u.arrestT || 0) + dt;
          if (u.arrestT > 1.6) { G.busted(); u.arrestT = 0; }
        } else u.arrestT = 0;
      }
    }
    // wanted decay when unseen for a while
    if (w > 0) {
      if (nearest > 520) {
        this.unseenT += dt;
        if (this.unseenT > 9) {
          G.wanted = Math.max(0, w - 1);
          G.toast('Kamu lolos dari pantauan — wanted turun ke ' + G.wanted);
          this.unseenT = 0;
        }
      } else this.unseenT = 0;
    }
    // despawn far units when wanted is 0
    if (w === 0) this.units = this.units.filter((u) => Math.hypot(u.x - p.x, u.y - p.y) < 1400);
  }
  spawnUnit() {
    const G = this.G;
    const p = G.player;
    const a = this.rng() * Math.PI * 2;
    const dist = 650 + this.rng() * 250;
    const x = Math.max(180, Math.min(WORLD.w - 60, p.x + Math.cos(a) * dist));
    const y = Math.max(60, Math.min(WORLD.h - 60, p.y + Math.sin(a) * dist));
    if (G.wanted >= 2 || p.inCar) {
      const car = createCar('sedan', x, y, 0, { police: true, color: '#20344f', parked: false, ai: true });
      car.siren = true;
      this.units.push({ car, x, y, onFoot: false, arrestT: 0 });
    } else {
      this.units.push({ car: null, x, y, onFoot: true, arrestT: 0 });
    }
  }
  placeRoadblock() {
    const G = this.G;
    const p = G.player;
    const tx = p.inCar ? p.inCar.x : p.x;
    const ty = p.inCar ? p.inCar.y : p.y;
    const a = (p.inCar ? p.inCar.angle : p.angle) + (this.rng() < 0.5 ? 0 : Math.PI);
    const x = Math.max(200, Math.min(WORLD.w - 100, tx + Math.cos(a) * 420));
    const y = Math.max(100, Math.min(WORLD.h - 100, ty + Math.sin(a) * 420));
    const car = createCar('sedan', x, y, a + Math.PI / 2, { police: true, color: '#20344f', parked: true });
    this.roadblocks.push(car);
  }
  clearAll() {
    this.units = [];
    this.roadblocks = [];
    this.unseenT = 0;
  }
}
