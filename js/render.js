// All DOM rendering. Classic script — ZONES and state must be loaded first.

const TAG_LABELS = {
  campaign: 'Campaign', keylore: 'Key Lore', lore: 'Side Lore', side: 'Side Quest',
  dungeon: 'Dungeon', horde: 'Horde Only', alliance: 'Alliance Only',
  neutral: 'Both Factions', group: 'Group',
};

const PRIORITY_TAGS  = ['campaign', 'keylore', 'lore', 'side', 'dungeon'];
const SECONDARY_TAGS = ['alliance', 'horde', 'neutral', 'group'];

// ── helpers ──────────────────────────────────────────────────────────────────

function zoneStats(zone) {
  const all  = zone.chapters.flatMap(c => c.quests);
  const done = all.filter(q => state.completed[q.id]).length;
  return { total: all.length, done };
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

// ── progress updaters ─────────────────────────────────────────────────────────

function updateChapterCount(chId) {
  const ch = ZONES.flatMap(z => z.chapters).find(c => c.id === chId);
  if (!ch) return;
  const done = ch.quests.filter(q => state.completed[q.id]).length;
  const el = document.getElementById('cprog-' + chId);
  if (el) el.innerHTML = `<strong>${done}</strong> / ${ch.quests.length}`;
}

function updateZoneProgress(zoneId) {
  const zone = ZONES.find(z => z.id === zoneId);
  if (!zone) return;
  const { total, done } = zoneStats(zone);
  const pct = total ? (done / total * 100).toFixed(1) : 0;
  const bar = document.getElementById('zbar-' + zoneId);
  const lbl = document.getElementById('zprog-' + zoneId);
  if (bar) bar.style.width = pct + '%';
  if (lbl) lbl.innerHTML = `<strong>${done}</strong> / ${total}`;
}

function updateGlobalProgress() {
  const all  = ZONES.flatMap(z => z.chapters.flatMap(c => c.quests));
  const done = all.filter(q => state.completed[q.id]).length;
  const pct  = all.length ? (done / all.length * 100).toFixed(1) : 0;
  document.getElementById('global-bar').style.width = pct + '%';
  document.getElementById('global-label').innerHTML = `<strong>${done}</strong> / ${all.length}`;
}

// ── quest toggle & lock refresh ───────────────────────────────────────────────

function toggleQuest(qId, zoneId, chId) {
  if (state.completed[qId]) delete state.completed[qId];
  else state.completed[qId] = true;

  const row = document.querySelector(`.quest-row[data-id="${qId}"]`);
  if (row) row.classList.toggle('done', !!state.completed[qId]);

  state.lastChapterId = chId;

  refreshLocks(zoneId);
  updateChapterCount(chId);
  updateZoneProgress(zoneId);
  updateGlobalProgress();
  renderTabs();
  saveState();
}

function refreshLocks(zoneId) {
  const zone = ZONES.find(z => z.id === zoneId);
  if (!zone) return;
  zone.chapters.forEach(ch => {
    ch.quests.forEach(q => {
      const row = document.querySelector(`.quest-row[data-id="${q.id}"]`);
      if (!row) return;
      row.classList.toggle('locked', !!(q.prev && !state.completed[q.prev]));
    });
  });
}

// ── faction ───────────────────────────────────────────────────────────────────

function applyFactionVisibility(zoneId) {
  const panel = document.getElementById('panel-' + zoneId);
  if (!panel) return;
  const opp = state.faction === 'alliance' ? 'horde' : 'alliance';
  panel.querySelectorAll('.quest-row').forEach(row => {
    const tags = row.dataset.tags || '';
    const isOppOnly = tags.includes(opp) && !tags.includes(state.faction) && !tags.includes('neutral');
    row.classList.toggle('hidden-faction', isOppOnly);
  });
}

// Rebuilds all panels so faction-specific NPC names and quest titles refresh.
function applyFactionUI() {
  document.querySelectorAll('.faction-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.faction === state.faction);
  });
  ZONES.forEach(z => {
    const panel = document.getElementById('panel-' + z.id);
    if (panel) panel.remove();
  });
  renderActiveZone();
  ZONES.forEach(z => applyFactionVisibility(z.id));
}

// ── filter ────────────────────────────────────────────────────────────────────

function applyFilter(zoneId, autoOpenFirst = false) {
  const f     = state.filters[zoneId] || 'all';
  const panel = document.getElementById('panel-' + zoneId);
  if (!panel) return;

  panel.querySelectorAll('.quest-row').forEach(row => {
    if (row.classList.contains('hidden-faction')) return;
    const tagSet = new Set((row.dataset.tags || '').split(' ').filter(Boolean));
    const isDone = row.classList.contains('done');
    let show = true;
    if      (f === 'todo')     show = !isDone;
    else if (f === 'done')     show =  isDone;
    else if (f === 'campaign') show = tagSet.has('campaign');
    else if (f === 'keylore')  show = tagSet.has('keylore');
    else if (f === 'lore')     show = tagSet.has('lore');
    else if (f === 'side')     show = tagSet.has('side');
    else if (f === 'dungeon')  show = tagSet.has('dungeon');
    row.classList.toggle('hidden-filter', !show);
  });

  // Pass 1 — mark empty chapters (no visible rows after filter + faction).
  const chapters = [...panel.querySelectorAll('.chapter')];
  chapters.forEach(chEl => {
    const hasVisible = [...chEl.querySelectorAll('.quest-row')].some(
      r => !r.classList.contains('hidden-filter') && !r.classList.contains('hidden-faction')
    );
    chEl.classList.toggle('chapter-empty', !hasVisible);
  });

  // Pass 2 — when called from a filter button click, collapse everything and
  // open only the first chapter that has visible rows.
  if (autoOpenFirst) {
    const visible = chapters.filter(ch => !ch.classList.contains('chapter-empty'));
    visible.forEach((ch, i) => ch.classList.toggle('collapsed', i !== 0));
  }
}

// ── tabs ──────────────────────────────────────────────────────────────────────

function renderTabs() {
  const bar = document.getElementById('tabs-bar');
  bar.innerHTML = '';
  ZONES.forEach(zone => {
    const s   = zoneStats(zone);
    const btn = document.createElement('button');
    btn.className     = 'tab-btn' + (zone.id === state.activeZone ? ' active' : '');
    btn.dataset.zone  = zone.id;
    btn.innerHTML     = `<span class="tab-name">${zone.name}</span><span class="tab-prog">${s.done} / ${s.total}</span>`;
    btn.addEventListener('click', () => switchZone(zone.id));
    bar.appendChild(btn);
  });
}

function switchZone(zoneId) {
  state.activeZone = zoneId;
  renderTabs();
  document.querySelectorAll('.zone-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + zoneId);
  if (panel) panel.classList.add('active');
  else renderActiveZone();
}

// ── zone panel ────────────────────────────────────────────────────────────────

function renderActiveZone() {
  const container = document.getElementById('zones-container');
  const old = document.getElementById('panel-' + state.activeZone);
  if (old) old.remove();

  const zone = ZONES.find(z => z.id === state.activeZone);
  if (!zone) return;

  const panel = document.createElement('div');
  panel.className = 'zone-panel active';
  panel.id        = 'panel-' + zone.id;

  const shell = document.createElement('div');
  shell.className = 'shell';

  const FILTER_BTNS = [
    { k: 'all',      label: 'All' },
    { k: 'todo',     label: 'To Do' },
    { k: 'done',     label: 'Done' },
    { k: 'sep1',     label: '' },
    { k: 'campaign', label: '① Campaign' },
    { k: 'keylore',  label: '② Key Lore' },
    { k: 'lore',     label: '③ Side Lore' },
    { k: 'side',     label: '④ Side Quests' },
    { k: 'sep2',     label: '' },
    { k: 'dungeon',  label: 'Dungeons' },
  ];

  shell.innerHTML = `
    <div class="zone-top-bar" id="filters-${zone.id}">
      ${FILTER_BTNS.map(f => f.k.startsWith('sep')
        ? '<span class="filter-divider"></span>'
        : `<button class="filter-btn${state.filters[zone.id] === f.k ? ' active' : ''}" data-filter="${f.k}" data-zone="${zone.id}">${f.label}</button>`
      ).join('')}
    </div>
    <div class="zone-progress-row">
      <div class="zone-mini-bar-wrap">
        <div class="zone-mini-bar-fill" id="zbar-${zone.id}" style="width:0%"></div>
      </div>
      <span class="zone-prog-label" id="zprog-${zone.id}"><strong>0</strong> / 0</span>
    </div>
  `;

  const chapWrap = document.createElement('div');
  chapWrap.className = 'zone-chapters';
  zone.chapters.forEach(ch => chapWrap.appendChild(buildChapter(ch, zone.id)));

  shell.appendChild(chapWrap);
  panel.appendChild(shell);
  container.appendChild(panel);

  shell.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      if (!this.dataset.filter) return;
      state.filters[this.dataset.zone] = this.dataset.filter;
      shell.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      applyFilter(zone.id, true);
    });
  });

  updateZoneProgress(zone.id);
  applyFactionVisibility(zone.id);
  applyFilter(zone.id);
}

// ── chapter ───────────────────────────────────────────────────────────────────

function buildChapter(ch, zoneId) {
  const chDone = ch.quests.filter(q => state.completed[q.id]).length;

  // Root quests depth 0, all chain continuations depth 1 (consistent indent).
  const depthMap = {};
  ch.quests.forEach(q => { depthMap[q.id] = q.prev ? 1 : 0; });

  const chEl = document.createElement('div');
  chEl.className  = 'chapter' + (ch.id === state.lastChapterId ? '' : ' collapsed');
  chEl.dataset.id = ch.id;

  const header = document.createElement('div');
  header.className = 'chapter-header';
  header.innerHTML = `
    <span class="ch-arrow">▼</span>
    <span class="chapter-title">${ch.title}</span>
    <span class="chapter-prog" id="cprog-${ch.id}"><strong>${chDone}</strong> / ${ch.quests.length}</span>
  `;
  header.addEventListener('click', () => {
    const nowCollapsed = chEl.classList.toggle('collapsed');
    if (!nowCollapsed) {
      state.lastChapterId = ch.id;
      saveState();
    }
  });

  const body = document.createElement('div');
  body.className = 'chapter-body';

  ch.quests.forEach(q => {
    const isDungeon = q.tags.includes('dungeon');
    const isDone    = !!state.completed[q.id];
    const isLocked  = !!(q.prev && !state.completed[q.prev]);

    if (isDungeon) {
      const prev = body.lastElementChild;
      if (!prev || !prev.classList.contains('dungeon-banner')) {
        const banner = document.createElement('div');
        banner.className = 'dungeon-banner';
        banner.innerHTML = `<span style="font-size:12px">⚔</span><span class="dungeon-banner-text">Dungeon — complete before leaving this chapter</span>`;
        body.appendChild(banner);
      }
    }

    const tagHtml = [
      ...q.tags.filter(t => PRIORITY_TAGS.includes(t))
               .map(t => `<span class="tag tag-${t}">${TAG_LABELS[t]}</span>`),
      ...q.tags.filter(t => SECONDARY_TAGS.includes(t))
               .map(t => `<span class="tag tag-${t} tag-secondary">${TAG_LABELS[t]}</span>`),
    ].join('');

    const fKey      = state.faction === 'alliance' ? 'A' : 'H';
    const npcName   = q['npc'   + fKey] || q.npc   || '';
    const npcLoc    = q['loc'   + fKey] || q.loc   || '';
    const questName = (state.faction === 'horde' && q.nameH) ? q.nameH : q.name;
    const coord     = q['coord' + fKey] || q.coord  || null;

    const macroText = q.wowheadId
      ? `/run print(C_QuestLog.IsQuestFlaggedCompleted(${q.wowheadId}))`
      : null;
    const wayText = coord
      ? (([map, x, y]) => `/way ${map} ${x} ${y}`)(coord.split(':'))
      : null;

    const depth = depthMap[q.id] || 0;
    const row   = document.createElement('div');
    row.className = [
      'quest-row',
      isDone    ? 'done'         : '',
      isDungeon ? 'type-dungeon' : '',
      isLocked  ? 'locked'       : '',
    ].filter(Boolean).join(' ');
    row.dataset.id     = q.id;
    row.dataset.tags   = q.tags.join(' ');
    row.dataset.qid    = q.id;
    row.dataset.zoneid = zoneId;
    row.dataset.chid   = ch.id;
    if (depth > 0) row.dataset.depth = depth;

    row.innerHTML = `
      <div class="quest-check"></div>
      <div class="quest-content">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div class="quest-name">${questName}</div>
          <div class="quest-btn-group">
            ${wayText   ? `<button class="quest-macro-btn quest-pin-btn" title="Copy /way command — paste in WoW to pin NPC on map">📍 /way</button>` : ''}
            ${macroText ? `<button class="quest-macro-btn quest-run-btn" title="Copy /run macro — paste in WoW chat to check if completed">copy /run</button>` : ''}
          </div>
        </div>
        <div class="quest-npc"><em>${npcName}</em>${npcLoc ? ` — ${npcLoc}` : ''}</div>
        ${tagHtml ? `<div class="quest-tags">${tagHtml}</div>` : ''}
        ${q.lore  ? `<div class="quest-lore">${q.lore}</div>`   : ''}
      </div>
    `;

    if (wayText) {
      row.querySelector('.quest-pin-btn').addEventListener('click', e => {
        e.stopPropagation();
        navigator.clipboard.writeText(wayText).then(() => {
          const btn = e.currentTarget;
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(() => { btn.textContent = '📍 /way'; btn.classList.remove('copied'); }, 1800);
        });
      });
    }

    if (macroText) {
      row.querySelector('.quest-run-btn').addEventListener('click', e => {
        e.stopPropagation();
        navigator.clipboard.writeText(macroText).then(() => {
          const btn = e.currentTarget;
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(() => { btn.textContent = 'copy /run'; btn.classList.remove('copied'); }, 1800);
        });
      });
    }

    body.appendChild(row);
  });

  // Single delegated click for the entire chapter body — no per-row listener stacking.
  body.addEventListener('click', e => {
    const row = e.target.closest('.quest-row');
    if (!row || row.classList.contains('locked')) return;
    toggleQuest(row.dataset.qid, row.dataset.zoneid, row.dataset.chid);
  });

  chEl.appendChild(header);
  chEl.appendChild(body);
  return chEl;
}
