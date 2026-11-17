// Six chained story missions for Rico, driver for fixer Mama Luz.
// Markers (all in-world, original locations): garage Old Town, safehouses, docks, penthouse.
export const MISSION_SPOTS = {
  garage:   { x: 950,  y: 850,  label: 'Bengkel Solmar' },
  safehouseOld: { x: 1550, y: 350, label: 'Safehouse Old Town' },
  contact:  { x: 2150, y: 1350, label: 'Kontak Downtown' },
  docks:    { x: 950,  y: 2350, label: 'Industrial Docks' },
  safehousePalm: { x: 2750, y: 350, label: 'Safehouse Palm Heights' },
  penthouse:{ x: 2150, y: 850,  label: 'Garasi Penthouse' },
  marina:   { x: 350,  y: 350,  label: 'Marina Bay' },
  dropoff:  { x: 2750, y: 1850, label: 'Titik Antar' },
};

export const MISSIONS = [
  {
    id: 1, title: 'Misi 1 — First Wheels',
    briefing: 'Mama Luz: "Rico, pendatang baru butuh roda. Curi sedan itu, antar ke bengkelku. Jangan bikin ribut."',
    objective: 'Curi sedan yang ditandai, lalu antar ke Bengkel Solmar.',
    reward: 250,
  },
  {
    id: 2, title: 'Misi 2 — Courier Run',
    briefing: 'Mama Luz: "Paket ini harus sampai sebelum 100 detik. Polisi tidak boleh lihat isinya. Gas!"',
    objective: 'Antar paket ke Titik Antar sebelum waktu habis.',
    reward: 400, timeLimit: 100,
  },
  {
    id: 3, title: 'Misi 3 — The Pickup',
    briefing: 'Mama Luz: "Jemput kontakku di Downtown. Polisi sudah mengendus — begitu dia naik, kabur ke safehouse."',
    objective: 'Jemput kontak di Downtown, lalu kabur ke Safehouse Old Town.',
    reward: 600,
  },
  {
    id: 4, title: 'Misi 4 — Dockside Deal',
    briefing: 'Mama Luz: "Kru rival mau merampok deal di docks. Habisi mereka, amankan uangnya."',
    objective: 'Ke Industrial Docks dan kalahkan 3 anggota kru rival.',
    reward: 900,
  },
  {
    id: 5, title: 'Misi 5 — Getaway Driver',
    briefing: 'Mama Luz: "Seluruh kota mencarimu sekarang. Bawa mobil ini ke safehouse Palm Heights. Jangan berhenti."',
    objective: 'Kabur dari kejaran wanted 4 ke Safehouse Palm Heights.',
    reward: 1200,
  },
  {
    id: 6, title: 'Misi 6 — King of Solmar',
    briefing: 'Mama Luz: "Satu pekerjaan terakhir: curi mobil sport dari garasi penthouse Downtown, bawa ke Marina. Kalau berhasil, Solmar milikmu."',
    objective: 'Curi mobil sport dari Garasi Penthouse, kabur wanted 5 ke Marina Bay.',
    reward: 2500,
  },
];

export class Missions {
  constructor(G) {
    this.G = G;
    this.idx = 0; // 0-based into MISSIONS
    this.stage = 'start'; // start | drive | deliver | pickup | escape | fight | steal | flee | done
    this.timer = 0;
    this.completed = [];
    this.contactPicked = false;
    this.announced = false;
  }
  current() { return MISSIONS[this.idx] || null; }
  get done() { return this.idx >= MISSIONS.length; }

  objectiveText() {
    if (this.done) return 'Kamu Raja Solmar. Kota ini milikmu — bebas berkeliling, cari mobil, hindari polisi.';
    const m = this.current();
    const map = {
      start: m.objective,
      drive: 'Antar mobil ke tujuan yang ditandai.',
      deliver: 'Antar paket sebelum waktu habis!',
      pickup: 'Jemput kontak di Downtown.',
      escape: 'Kabur! Bawa kontak ke Safehouse Old Town.',
      fight: 'Kalahkan kru rival di docks! Sisa: ' + (this.G.combat ? this.G.combat.enemies.length : 0),
      steal: 'Curi mobil sport dari Garasi Penthouse!',
      flee: 'Kabur ke Marina Bay — wanted 5!',
    };
    return map[this.stage] || m.objective;
  }
  targetPos() {
    if (this.done) return null;
    const S = MISSION_SPOTS;
    switch (this.idx) {
      case 0: return this.stage === 'start' ? (this.G.missionCar || S.garage) : S.garage;
      case 1: return this.stage === 'deliver' ? S.dropoff : S.garage;
      case 2: return this.stage === 'escape' ? S.safehouseOld : S.contact;
      case 3: return S.docks;
      case 4: return S.safehousePalm;
      case 5: return this.stage === 'flee' ? S.marina : S.penthouse;
      default: return null;
    }
  }
  startMission(i) {
    const G = this.G;
    this.idx = i;
    this.stage = 'start';
    this.timer = 0;
    this.contactPicked = false;
    const m = this.current();
    if (!m) return;
    G.toast(m.title, true);
    G.story = m.briefing;
    G.audio.jingle();
    if (i === 0) {
      // the sedan to steal, parked near the player start
      G.missionCar = G.spawnMissionCar('sedan', 950, 1350, 0);
      G.missionCar.mission = true;
    }
    if (i === 1) { this.stage = 'deliver'; this.timer = m.timeLimit; }
    if (i === 4) { G.setWanted(4, true); }
    if (i === 5) {
      G.missionCar = G.spawnMissionCar('sport', 2150, 850, Math.PI / 2);
      G.missionCar.mission = true;
    }
    G.saveSoon();
  }
  completeMission() {
    const G = this.G;
    const m = this.current();
    if (!m) return;
    G.player.cash += m.reward;
    this.completed.push(m.id);
    G.toast(m.title + ' SELESAI! +$' + m.reward, true);
    G.story = m.title + ' selesai. Mama Luz mentransfer $' + m.reward + '.';
    G.audio.jingle();
    G.setWanted(0, true);
    G.police.clearAll();
    this.idx += 1;
    if (this.idx < MISSIONS.length) {
      this.startMission(this.idx);
    } else {
      this.stage = 'done';
      G.story = 'KING OF SOLMAR — Rico menguasai kota. Mama Luz bangga. Bebas berkeliling Solmar!';
      G.toast('KING OF SOLMAR!', true);
    }
    G.saveSoon();
  }
  failMission(reason) {
    const G = this.G;
    G.toast('Misi gagal: ' + reason + ' — coba lagi.', true);
    G.audio.fail();
    G.setWanted(0, true);
    G.police.clearAll();
    this.startMission(this.idx);
  }
  near(x, y, tx, ty, r = 70) { return Math.hypot(x - tx, y - ty) < r; }
  update(dt) {
    const G = this.G;
    if (this.done) return;
    const p = G.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    const S = MISSION_SPOTS;
    if (this.idx === 1 && this.stage === 'deliver') {
      this.timer -= dt;
      if (this.timer <= 0) { this.failMission('waktu habis'); return; }
      if (this.near(px, py, S.dropoff.x, S.dropoff.y, 80)) this.completeMission();
      return;
    }
    switch (this.idx) {
      case 0:
        if (this.stage === 'start' && G.missionCar && p.inCar === G.missionCar) {
          this.stage = 'drive';
          G.toast('Mobil didapat! Antar ke Bengkel Solmar.');
        } else if (this.stage === 'drive' && this.near(px, py, S.garage.x, S.garage.y, 85)) {
          this.completeMission();
        }
        break;
      case 2:
        if (this.stage === 'start' && this.near(px, py, S.contact.x, S.contact.y, 70)) {
          this.stage = 'escape';
          this.contactPicked = true;
          G.setWanted(2, true);
          G.toast('Kontak naik! Kabur ke Safehouse Old Town — wanted 2!');
        } else if (this.stage === 'escape' && this.near(px, py, S.safehouseOld.x, S.safehouseOld.y, 85)) {
          this.completeMission();
        }
        break;
      case 3:
        if (this.stage === 'start' && this.near(px, py, S.docks.x, S.docks.y, 130)) {
          this.stage = 'fight';
          G.combat.spawnEnemies(S.docks.x, S.docks.y, 3);
          G.toast('Kru rival menyerang! Kalahkan mereka (F = pukul, G / klik = tembak).');
          if (!p.pistol) { p.pistol = true; p.ammo = 12; G.toast('Kamu dapat pistol + 12 peluru.'); }
        } else if (this.stage === 'fight' && G.combat.enemies.length === 0) {
          this.completeMission();
        }
        break;
      case 4:
        if (this.near(px, py, S.safehousePalm.x, S.safehousePalm.y, 85)) this.completeMission();
        break;
      case 5:
        if (this.stage === 'start' && G.missionCar && p.inCar === G.missionCar) {
          this.stage = 'flee';
          G.setWanted(5, true);
          G.toast('Sport dicuri! Kabur ke Marina Bay — wanted 5!');
        } else if (this.stage === 'flee' && this.near(px, py, S.marina.x, S.marina.y, 90)) {
          this.completeMission();
        }
        break;
      default: break;
    }
  }
}
