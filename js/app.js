// Entry point — event wiring and init. Classic script; all other scripts load first.

// ── import / export ───────────────────────────────────────────────────────────

function loadFromJson(text) {
  try {
    const obj = JSON.parse(text);
    applyPayload(obj);
    saveState();
    applyFactionUI();
    renderTabs();
    renderActiveZone();
    updateGlobalProgress();
    showToast('Progress loaded!');
  } catch (e) {
    showToast('Invalid JSON file.');
  }
}

document.getElementById('btn-export').addEventListener('click', () => {
  const blob = new Blob([buildPayload()], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'tbc-quest-progress.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Progress exported!');
});

document.getElementById('file-import').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => loadFromJson(ev.target.result);
  reader.readAsText(file);
  this.value = '';
});

// ── reset modal ───────────────────────────────────────────────────────────────

const resetModal  = document.getElementById('reset-modal');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');

document.getElementById('btn-reset').addEventListener('click', () => {
  resetModal.hidden = false;
});

modalCancel.addEventListener('click', () => {
  resetModal.hidden = true;
});

resetModal.addEventListener('click', e => {
  if (e.target === resetModal) resetModal.hidden = true;
});

modalConfirm.addEventListener('click', () => {
  resetModal.hidden = true;
  state.completed = {};
  saveState();
  ZONES.forEach(z => {
    const panel = document.getElementById('panel-' + z.id);
    if (panel) panel.remove();
  });
  renderTabs();
  renderActiveZone();
  updateGlobalProgress();
  showToast('Progress reset.');
});

// ── faction toggle ────────────────────────────────────────────────────────────

document.querySelectorAll('.faction-opt').forEach(btn => {
  btn.addEventListener('click', function () {
    state.faction = this.dataset.faction;
    applyFactionUI();
    saveState();
  });
});

// ── init ──────────────────────────────────────────────────────────────────────

loadState();
document.querySelectorAll('.faction-opt').forEach(btn => {
  btn.classList.toggle('active', btn.dataset.faction === state.faction);
});
renderTabs();
renderActiveZone();
updateGlobalProgress();
