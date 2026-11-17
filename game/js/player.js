// Rico, the player on foot. Movement, health, punch.
import { collideCircle } from './city.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, radius: 14,
    hp: 100, maxHp: 100, cash: 0,
    inCar: null, onFoot: true,
    pistol: false, ammo: 0,
    punchCd: 0, punchAnim: 0, hurtCd: 0,
    walkPhase: 0, moving: false,
  };
}

export function updateOnFoot(p, input, dt) {
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  p.moving = len > 0;
  if (len > 0) {
    mx /= len; my /= len;
    p.angle = Math.atan2(my, mx);
    p.walkPhase += dt * 10;
    const sp = 195;
    const pos = collideCircle(p.x + mx * sp * dt, p.y + my * sp * dt, p.radius);
    p.x = pos.x; p.y = pos.y;
  }
  if (p.punchCd > 0) p.punchCd -= dt;
  if (p.punchAnim > 0) p.punchAnim -= dt;
  if (p.hurtCd > 0) p.hurtCd -= dt;
}
