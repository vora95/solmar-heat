// Renderer: camera + top-down drawing of Solmar (roads, buildings, sea, cars, people).
import { WORLD, CITY, ROADS_V, ROADS_H, ROAD_W, SEA_X, districtAt } from './city.js';

export function drawWorld(G) {
  const ctx = G.ctx;
  const cam = G.camera;
  const vw = G.view.w, vh = G.view.h;
  ctx.fillStyle = '#0e1420';
  ctx.fillRect(0, 0, vw, vh);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  const x0 = Math.max(0, cam.x - 60), x1 = Math.min(WORLD.w, cam.x + vw + 60);
  const y0 = Math.max(0, cam.y - 60), y1 = Math.min(WORLD.h, cam.y + vh + 60);

  // ground: district-tinted base
  ctx.fillStyle = '#b9ac8e';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // district washes
  const washes = [
    [0, 0, 650, 950, 'rgba(46,111,142,0.25)'],
    [0, 1900, 3600, 800, 'rgba(122,106,85,0.30)'],
    [1500, 700, 1250, 1150, 'rgba(90,107,140,0.28)'],
    [2750, 0, 850, 1900, 'rgba(78,138,74,0.25)'],
  ];
  for (const [wx, wy, ww, wh, col] of washes) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.max(wx, x0), Math.max(wy, y0), Math.min(wx + ww, x1) - Math.max(wx, x0), Math.min(wy + wh, y1) - Math.max(wy, y0));
  }
  // sea (Marina Bay harbour) + piers
  ctx.fillStyle = '#1f6f8b';
  ctx.fillRect(0, y0, SEA_X, y1 - y0);
  ctx.fillStyle = '#2b8aa8';
  for (let y = Math.floor(y0 / 90) * 90; y < y1; y += 90) {
    ctx.beginPath(); ctx.arc(60 + Math.sin(y * 0.05 + G.time) * 8, y + 40, 14, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#8a6f4d';
  for (const py of [300, 600, 850]) ctx.fillRect(60, py, 110, 16);
  // parks
  for (const pk of CITY.parks) {
    if (pk.x + pk.w < x0 || pk.x > x1 || pk.y + pk.h < y0 || pk.y > y1) continue;
    ctx.fillStyle = '#5d9153';
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
    ctx.fillStyle = '#4a7a42';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(pk.x + 30 + i * 46, pk.y + pk.h / 2, 16, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // roads
  ctx.fillStyle = '#33373f';
  for (const rx of ROADS_V) ctx.fillRect(rx - ROAD_W / 2, y0, ROAD_W, y1 - y0);
  for (const ry of ROADS_H) ctx.fillRect(x0, ry - ROAD_W / 2, x1 - x0, ROAD_W);
  // sidewalks
  ctx.fillStyle = '#9aa0a8';
  for (const rx of ROADS_V) {
    ctx.fillRect(rx - ROAD_W / 2 - 12, y0, 12, y1 - y0);
    ctx.fillRect(rx + ROAD_W / 2, y0, 12, y1 - y0);
  }
  for (const ry of ROADS_H) {
    ctx.fillRect(x0, ry - ROAD_W / 2 - 12, x1 - x0, 12);
    ctx.fillRect(x0, ry + ROAD_W / 2, x1 - x0, 12);
  }
  // lane dashes
  ctx.fillStyle = '#e8d44d';
  for (const rx of ROADS_V) {
    for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) ctx.fillRect(rx - 2, y, 4, 22);
  }
  for (const ry of ROADS_H) {
    for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) ctx.fillRect(x, ry - 2, 22, 4);
  }
  // buildings
  for (const b of CITY.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // roof detail: inner rect + windows for tall downtown towers
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, Math.min(14, b.h - 12));
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,240,180,0.55)';
      const cols = Math.max(1, Math.floor(b.w / 26)), rows = Math.max(1, Math.floor(b.h / 30));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 3) % 4 === 0) ctx.fillRect(b.x + 10 + i * 26, b.y + 24 + j * 30, 12, 14);
      }
    }
  }
  // district label on the ground near the bottom-centre of the view (kept clear of the top help pill)
  const dc = districtAt(cam.x + vw / 2, cam.y + vh / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(dc.label, cam.x + vw / 2, cam.y + vh - 100);

  // mission marker (pulsing beacon + line from player)
  const t = G.missions.targetPos();
  if (t) {
    const pulse = 26 + Math.sin(G.time * 4) * 6;
    ctx.strokeStyle = '#ffd54a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(t.x, t.y, pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,213,74,0.85)';
    ctx.beginPath(); ctx.arc(t.x, t.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 4;
    ctx.strokeText(t.label || 'Tujuan', t.x, t.y - pulse - 10);
    ctx.fillText(t.label || 'Tujuan', t.x, t.y - pulse - 10);
  }

  // pickups
  for (const pk of G.combat.pickups) {
    if (pk.taken) continue;
    ctx.fillStyle = pk.kind === 'health' ? '#ff5252' : pk.kind === 'pistol' ? '#222' : '#ffd54a';
    ctx.beginPath(); ctx.arc(pk.x, pk.y, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'pistol' ? 'P' : 'A', pk.x, pk.y + 5);
  }

  // parked + traffic + police cars
  for (const car of G.allCars()) drawCar(ctx, car, G);
  // pedestrians
  for (const ped of G.traffic.peds) {
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(ped.x, ped.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(ped.x, ped.y - 2, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // enemies
  for (const e of G.combat.enemies) {
    ctx.fillStyle = '#b71c1c';
    ctx.beginPath(); ctx.arc(e.x, e.y, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = e.hurtCd > 0 ? '#fff' : '#7f0000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(e.x, e.y, 13, 0, Math.PI * 2); ctx.stroke();
    // hp bar
    ctx.fillStyle = '#000';
    ctx.fillRect(e.x - 14, e.y - 24, 28, 5);
    ctx.fillStyle = '#ff5252';
    ctx.fillRect(e.x - 14, e.y - 24, 28 * Math.max(0, e.hp / 70), 5);
  }
  // bullets
  ctx.fillStyle = '#ffe082';
  for (const b of G.combat.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // player
  drawPlayer(ctx, G);
  ctx.restore();

  // wanted vignette flash
  if (G.wanted >= 4) {
    const a = 0.06 + Math.sin(G.time * 6) * 0.03;
    ctx.fillStyle = 'rgba(255,0,0,' + Math.max(0, a) + ')';
    ctx.fillRect(0, 0, vw, vh);
  }
}

function drawCar(ctx, car, G) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h);
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.w / 2, -car.h / 2, car.w, car.h, 7);
  ctx.fill();
  // cabin + windshield
  ctx.fillStyle = 'rgba(180,220,240,0.9)';
  ctx.fillRect(-car.w * 0.18, -car.h / 2 + 3, car.w * 0.3, car.h - 6);
  ctx.fillStyle = '#1c2733';
  ctx.fillRect(car.w * 0.12, -car.h / 2 + 4, 4, car.h - 8);
  // headlights
  ctx.fillStyle = '#fff8c9';
  ctx.fillRect(car.w / 2 - 3, -car.h / 2 + 2, 3, 5);
  ctx.fillRect(car.w / 2 - 3, car.h / 2 - 7, 3, 5);
  if (car.police) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLISI', 0, 3);
    // light bar flashing
    const on = Math.floor(G.time * 6) % 2 === 0;
    ctx.fillStyle = on ? '#ff1744' : '#2979ff';
    ctx.beginPath(); ctx.arc(-6, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = on ? '#2979ff' : '#ff1744';
    ctx.beginPath(); ctx.arc(6, 0, 4, 0, Math.PI * 2); ctx.fill();
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (car.mission) {
    ctx.strokeStyle = '#ffd54a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 34 + Math.sin(G.time * 4) * 3, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer(ctx, G) {
  const p = G.player;
  if (p.inCar) return; // driver is inside the car
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  const bob = p.moving ? Math.sin(p.walkPhase) * 2 : 0;
  ctx.fillStyle = '#e63946';
  ctx.beginPath(); ctx.arc(0, bob, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(4, bob, 6, 0, Math.PI * 2); ctx.fill();
  // facing nose + punch arm
  ctx.fillStyle = '#222';
  ctx.fillRect(10, -3 + bob, 8, 6);
  if (p.punchAnim > 0) {
    ctx.fillStyle = '#f1c27d';
    ctx.fillRect(16, -4, 14, 8);
  }
  if (p.pistol) {
    ctx.fillStyle = '#111';
    ctx.fillRect(12, 4, 10, 4);
  }
  ctx.restore();
  // hurt ring
  if (p.hurtCd > 0) {
    ctx.strokeStyle = 'rgba(255,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, Math.PI * 2); ctx.stroke();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
