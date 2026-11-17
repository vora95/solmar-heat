// HUD: wanted stars, health, cash, objective text, speed — plus the minimap canvas.
import { WORLD, ROADS_V, ROADS_H, districtAt } from './city.js';

export class Hud {
  constructor(G) {
    this.G = G;
    this.el = {
      cash: document.getElementById('hud-cash'),
      hp: document.getElementById('hud-hp'),
      hpBar: document.getElementById('hud-hpbar'),
      stars: document.getElementById('hud-stars'),
      speed: document.getElementById('hud-speed'),
      objective: document.getElementById('hud-objective'),
      mission: document.getElementById('hud-mission'),
      timer: document.getElementById('hud-timer'),
      ammo: document.getElementById('hud-ammo'),
      toast: document.getElementById('hud-toast'),
      story: document.getElementById('hud-story'),
      district: document.getElementById('hud-district'),
    };
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map ? this.map.getContext('2d') : null;
  }
  update() {
    const G = this.G, p = G.player;
    if (this.el.cash) this.el.cash.textContent = '$' + Math.round(p.cash);
    if (this.el.hp) this.el.hp.textContent = 'HP ' + Math.max(0, Math.round(p.hp));
    if (this.el.hpBar) {
      this.el.hpBar.style.width = Math.max(0, p.hp) + '%';
      this.el.hpBar.style.background = p.hp > 50 ? '#4caf50' : p.hp > 25 ? '#ff9800' : '#f44336';
    }
    if (this.el.stars) {
      let s = '';
      for (let i = 0; i < 5; i++) s += i < G.wanted ? '★' : '☆';
      this.el.stars.textContent = s;
      this.el.stars.style.color = G.wanted > 0 ? '#ffd54a' : '#888';
    }
    if (this.el.speed) {
      this.el.speed.textContent = p.inCar ? Math.round(Math.abs(p.inCar.speed) * 0.36) + ' km/h' : 'jalan kaki';
    }
    if (this.el.mission) {
      const m = G.missions.current();
      this.el.mission.textContent = m ? m.title : 'SOLMAR BEBAS';
    }
    if (this.el.objective) this.el.objective.textContent = '▶ ' + G.missions.objectiveText();
    if (this.el.timer) {
      this.el.timer.textContent = (G.missions.idx === 1 && G.missions.stage === 'deliver')
        ? '⏱ ' + Math.max(0, Math.ceil(G.missions.timer)) + ' dtk' : '';
    }
    if (this.el.ammo) {
      this.el.ammo.textContent = p.pistol ? ('🔫 ' + p.ammo + ' peluru') : '👊 F = pukul';
    }
    if (this.el.story) this.el.story.textContent = G.story || '';
    if (this.el.district) {
      const px = p.inCar ? p.inCar.x : p.x, py = p.inCar ? p.inCar.y : p.y;
      this.el.district.textContent = districtAt(px, py).name;
    }
    if (this.el.toast) this.el.toast.textContent = G.toastText || '';
    this.drawMinimap();
  }
  drawMinimap() {
    const ctx = this.mapCtx;
    if (!ctx) return;
    const G = this.G;
    const W = this.map.width, H = this.map.height;
    const sx = W / WORLD.w, sy = H / WORLD.h;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#20242c';
    ctx.fillRect(0, 0, W, H);
    // district tint blocks: draw ground + roads
    ctx.fillStyle = '#3a3f47';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1b4d6b';
    ctx.fillRect(0, 0, 150 * sx, H);
    ctx.strokeStyle = '#565d68';
    ctx.lineWidth = 2;
    for (const rx of ROADS_V) { ctx.beginPath(); ctx.moveTo(rx * sx, 0); ctx.lineTo(rx * sx, H); ctx.stroke(); }
    for (const ry of ROADS_H) { ctx.beginPath(); ctx.moveTo(0, ry * sy); ctx.lineTo(W, ry * sy); ctx.stroke(); }
    // mission target
    const t = G.missions.targetPos();
    if (t) {
      const pulse = 4 + Math.sin(G.time * 5) * 2;
      ctx.fillStyle = '#ffd54a';
      ctx.beginPath(); ctx.arc(t.x * sx, t.y * sy, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(t.x * sx, t.y * sy, pulse + 3, 0, Math.PI * 2); ctx.stroke();
    }
    // police
    ctx.fillStyle = '#ff5252';
    for (const u of G.police.units) { ctx.beginPath(); ctx.arc(u.x * sx, u.y * sy, 3, 0, Math.PI * 2); ctx.fill(); }
    for (const rb of G.police.roadblocks) { ctx.fillRect(rb.x * sx - 3, rb.y * sy - 3, 6, 6); }
    // enemies
    ctx.fillStyle = '#ff9800';
    for (const e of G.combat.enemies) { ctx.beginPath(); ctx.arc(e.x * sx, e.y * sy, 3, 0, Math.PI * 2); ctx.fill(); }
    // player
    const p = G.player;
    const px = p.inCar ? p.inCar.x : p.x, py = p.inCar ? p.inCar.y : p.y;
    ctx.fillStyle = '#4caf50';
    ctx.beginPath(); ctx.arc(px * sx, py * sy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(px * sx, py * sy, 6, 0, Math.PI * 2); ctx.stroke();
    // viewport box
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(G.camera.x * sx, G.camera.y * sy, G.view.w * sx, G.view.h * sy);
  }
}
