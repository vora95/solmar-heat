// Vehicle types and driving physics. 100% original.
import { collideCircle } from './city.js';

export const CAR_TYPES = {
  sedan:  { name: 'Sedan',  maxSpeed: 330, accel: 260, brake: 420, turn: 2.7, color: '#c94f43', w: 46, h: 22 },
  taxi:   { name: 'Taksi',  maxSpeed: 320, accel: 250, brake: 420, turn: 2.7, color: '#f2c230', w: 46, h: 22 },
  pickup: { name: 'Pickup', maxSpeed: 300, accel: 230, brake: 380, turn: 2.3, color: '#4a7a4e', w: 52, h: 24 },
  sport:  { name: 'Sport',  maxSpeed: 470, accel: 380, brake: 480, turn: 3.2, color: '#d21f5e', w: 48, h: 21 },
  van:    { name: 'Van',    maxSpeed: 260, accel: 190, brake: 340, turn: 2.0, color: '#7a8899', w: 54, h: 25 },
};

export function createCar(type, x, y, angle = 0, opts = {}) {
  const t = CAR_TYPES[type] || CAR_TYPES.sedan;
  return {
    type, name: t.name, color: opts.color || t.color,
    x, y, angle, speed: 0,
    maxSpeed: t.maxSpeed, accel: t.accel, brake: t.brake, turn: t.turn,
    w: t.w, h: t.h, hp: 100,
    ai: !!opts.ai, police: !!opts.police, parked: opts.parked !== false,
    driver: opts.driver || null, // 'player' | 'ped' | null
    siren: !!opts.police,
  };
}

// Drive a car with {up, down, left, right}. Returns true if it hit something hard.
export function updateDrive(car, input, dt) {
  if (input.up) car.speed += car.accel * dt;
  else if (input.down) car.speed -= car.brake * dt * 0.9;
  else {
    // drag / rolling resistance
    const s = Math.sign(car.speed);
    car.speed -= s * 140 * dt;
    if (Math.sign(car.speed) !== s) car.speed = 0;
  }
  car.speed = Math.max(-car.maxSpeed * 0.35, Math.min(car.maxSpeed, car.speed));
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  if (steer !== 0 && Math.abs(car.speed) > 5) {
    car.angle += steer * car.turn * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // axis-separated collision so cars slide along walls instead of sticking
  const cx = collideCircle(nx, car.y, 20);
  car.x = cx.x;
  const cy = collideCircle(car.x, ny, 20);
  car.y = cy.y;
  const hardHit = (cx.hit || cy.hit) && Math.abs(car.speed) > 120;
  if (cx.hit || cy.hit) car.speed *= 0.55;
  return hardHit;
}

export function carDistance(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
