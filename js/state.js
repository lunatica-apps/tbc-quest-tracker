// All mutable app state lives here. Classic script — ZONES must be loaded first.
const LS_KEY = 'tbc-quest-tracker';

const state = {
  completed:     {},
  activeZone:    ZONES[0].id,
  faction:       'alliance',
  lastChapterId: ZONES[0].chapters[0].id,
  filters:       {},
};

ZONES.forEach(z => { state.filters[z.id] = 'all'; });

function saveState() {
  const { completed, faction, lastChapterId } = state;
  localStorage.setItem(LS_KEY, JSON.stringify({ completed, faction, lastChapterId }));
}

function loadState() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return;
  try { applyPayload(JSON.parse(raw)); } catch (e) {}
}

// Merges a parsed JSON object into state (used by loadState and import).
function applyPayload(obj) {
  if (!obj) return;
  state.completed = (typeof obj.completed === 'object' && obj.completed !== null)
    ? obj.completed
    : {};
  if (obj.faction === 'alliance' || obj.faction === 'horde') state.faction = obj.faction;
  if (obj.lastChapterId) state.lastChapterId = obj.lastChapterId;
}

function buildPayload() {
  const { completed, faction, lastChapterId } = state;
  return JSON.stringify(
    { completed, faction, lastChapterId, savedAt: new Date().toISOString() },
    null, 2
  );
}
