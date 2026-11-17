// Combat: fists (F), pistol pickups with limited ammo, enemy AI, health, bullets.
import { collideCircle, mulberry32 } from './city.js';

export class Combat {
  constructor(G) {
    this.G = G;
    this.rng = mulberry32(4242);
    this.enemies = []; // {x,y,hp,angle,attackCd,speed}
    this.bullets = []; // {x,y,vx,vy,life,fromPlayer}
    this.pickups = []; // {kind:'pistol'|'health'|'ammo', x,y}
    this.pickups.push({ kind: 'pistol', x: 950, y: 1850, taken: false });
    this.pickups.push({ kind: 'health', x: 950, y: 350, taken: false });
    this.pickups.push({ kind: 'health', x: 2750, y: 1350, taken: false });
    this.pickups.push({ kind: 'ammo', x: 2150, y: 1850, taken: false });
  }
  spawnEnemies(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.enemies.push({
        x: x + Math.cos(a) * 90, y: y + Math.sin(a) * 90,
        hp: 70, angle: 0, attackCd: 0, speed: 165 + i * 8, hurtCd: 0,
      });
    }
  }
  playerPunch() {
    const G = this.G, p = G.player;
    if (p.punchCd > 0 || p.inCar) return;
    p.punchCd = 0.45; p.punchAnim = 0.25;
    G.audio.punch();
    G.danger = { x: p.x + Math.cos(p.angle) * 40, y: p.y + Math.sin(p.angle) * 40, until: G.time + 1.5 };
    let hitAny = false;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < 58) {
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        let diff = Math.abs(a - p.angle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < 1.2) {
          e.hp -= 34; e.hurtCd = 0.3;
          e.x += Math.cos(a) * 14; e.y += Math.sin(a) * 14;
          hitAny = true;
        }
      }
    }
    // shoving a nearby pedestrian counts as a crime if police can see it
    for (const ped of G.traffic.peds) {
      const d = Math.hypot(ped.x - p.x, ped.y - p.y);
      if (d < 50) { hitAny = true; break; }
    }
    if (hitAny) G.addHeat(1, true);
  }
  playerShoot(tx, ty) {
    const G = this.G, p = G.player;
    if (p.inCar || !p.pistol || p.ammo <= 0) return;
    p.ammo -= 1;
    G.audio.shot();
    G.danger = { x: p.x, y: p.y, until: G.time + 2 };
    const a = Math.atan2(ty - p.y, tx - p.x);
    this.bullets.push({ x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22, vx: Math.cos(a) * 720, vy: Math.sin(a) * 720, life: 0.9, fromPlayer: true });
    G.addHeat(1, true);
  }
  enemyShoot(e) {
    const G = this.G, p = G.player;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    this.bullets.push({ x: e.x + Math.cos(a) * 20, y: e.y + Math.sin(a) * 20, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, life: 1.1, fromPlayer: false });
  }
  update(dt) {
    const G = this.G, p = G.player;
    // enemies chase + attack
    for (const e of this.enemies) {
      if (e.hurtCd > 0) e.hurtCd -= dt;
      if (e.attackCd > 0) e.attackCd -= dt;
      const tx = p.inCar ? p.inCar.x : p.x;
      const ty = p.inCar ? p.inCar.y : p.y;
      const dx = tx - e.x, dy = ty - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.angle = Math.atan2(dy, dx);
      if (d > 34) {
        const pos = collideCircle(e.x + (dx / d) * e.speed * dt, e.y + (dy / d) * e.speed * dt, 13);
        e.x = pos.x; e.y = pos.y;
      } else if (e.attackCd <= 0) {
        e.attackCd = 0.9;
        if (p.inCar) { p.inCar.hp -= 4; }
        else if (p.hurtCd <= 0) { p.hp -= 6; p.hurtCd = 0.5; G.audio.hurt(); }
        if (p.hp <= 0) G.wasted();
      }
      // rivals occasionally shoot if the player is far
      if (d > 200 && d < 520 && this.rng() < dt * 0.15) this.enemyShoot(e);
    }
    // rivals keep their distance from each other so they don't stack on the player
    for (let i = 0; i < this.enemies.length; i++) {
      for (let j = i + 1; j < this.enemies.length; j++) {
        const a = this.enemies[i], b = this.enemies[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.1 && d < 30) {
          const push = (30 - d) / 2;
          const nx = dx / d, ny = dy / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
        }
      }
    }
    this.enemies = this.enemies.filter((e) => {
      if (e.hp <= 0) { G.player.cash += 50; G.toast('Rival tumbang! +$50'); return false; }
      return true;
    });
    // bullets
    for (const b of this.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.fromPlayer) {
        for (const e of this.enemies) {
          if (Math.hypot(e.x - b.x, e.y - b.y) < 20) { e.hp -= 40; e.hurtCd = 0.25; b.life = 0; break; }
        }
      } else if (!p.inCar && Math.hypot(p.x - b.x, p.y - b.y) < 16 && p.hurtCd <= 0) {
        p.hp -= 5; p.hurtCd = 0.4; G.audio.hurt(); b.life = 0;
        if (p.hp <= 0) G.wasted();
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < 3600 && b.y > 0 && b.y < 2700);
    // pickups
    const px = p.inCar ? p.inCar.x : p.x, py = p.inCar ? p.inCar.y : p.y;
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      if (Math.hypot(pk.x - px, pk.y - py) < 34) {
        pk.taken = true;
        if (pk.kind === 'pistol') { p.pistol = true; p.ammo += 12; G.toast('Pistol didapat! +12 peluru (G / klik untuk tembak).'); }
        if (pk.kind === 'ammo') { p.ammo += 12; G.toast('Amunisi +12.'); }
        if (pk.kind === 'health') { p.hp = Math.min(p.maxHp, p.hp + 40); G.toast('Health +40.'); }
        G.audio.pickup();
      }
    }
  }
}
