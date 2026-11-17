// Autosave to localStorage: progress, cash, unlocked mission.
export const SAVE_KEY = 'solmar-heat-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d !== 'object' || d === null) return null;
    return {
      cash: typeof d.cash === 'number' ? d.cash : 0,
      missionIdx: typeof d.missionIdx === 'number' ? Math.max(0, Math.min(5, d.missionIdx)) : 0,
      pistol: !!d.pistol,
      ammo: typeof d.ammo === 'number' ? d.ammo : 0,
      completed: Array.isArray(d.completed) ? d.completed.filter((x) => typeof x === 'number') : [],
    };
  } catch (e) { return null; }
}

export function saveGame(G) {
  try {
    const d = {
      cash: Math.round(G.player.cash),
      missionIdx: G.missions.idx,
      pistol: G.player.pistol,
      ammo: G.player.ammo,
      completed: G.missions.completed.slice(),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(d));
    return true;
  } catch (e) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}
