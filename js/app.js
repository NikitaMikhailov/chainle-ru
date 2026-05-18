import { isAdjacent, validatePath, calcStars,
         puzzleIndex, todayDateStr, getPuzzle,
         findOptimalPath } from './engine.js?v=__BUILD_HASH__';

// ── Safe localStorage ────────────────────────────────────────────────────────
const store = {
  get(k)    { try { return localStorage.getItem(k); }         catch { return null;  } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
};

// ── Constants ────────────────────────────────────────────────────────────────
const PUZZLES_URL = 'data/puzzles.json?v=__BUILD_HASH__';
const STORE_GAME  = 'chainle_game';
const STORE_STATS = 'chainle_stats';

// ── State ────────────────────────────────────────────────────────────────────
let puzzles = [];
let state   = null;

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  loadTheme();
  try {
    const data = await fetch(PUZZLES_URL).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
    puzzles = data.puzzles;
  } catch {
    document.getElementById('main-content').innerHTML =
      '<div class="load-error">Не удалось загрузить игру.<br>Проверьте соединение и обновите страницу.</div>';
    return;
  }
  loadState();
  buildGrid();
  bindEvents();
  render();
}

// ── Puzzle helpers ───────────────────────────────────────────────────────────
function todayPuzzle() {
  return getPuzzle(todayDateStr(), puzzles);
}

function todayIndex() {
  return puzzleIndex(todayDateStr());
}

// ── State management ─────────────────────────────────────────────────────────
function defaultState() {
  const pz = todayPuzzle();
  return {
    puzzleIndex: todayIndex(),
    puzzleDate:  pz.date,
    grid:        pz.grid,
    target:      pz.target,
    optimal:     pz.optimal,
    path:        [],
    sum:         0,
    status:      'playing',   // playing | solved
    stars:       0,
    submittedPath: null,
    optimalPath:   null,
    viewingOptimal:   false,
    hasViewedOptimal: false,
  };
}

let _storageWarned = false;
function saveState() {
  const { grid, optimalPath, viewingOptimal, ...rest } = state;
  const ok = store.set(STORE_GAME, JSON.stringify(rest));
  if (!ok && !_storageWarned) {
    _storageWarned = true;
    toast('Прогресс не сохраняется: переполнен кэш браузера', 5000);
  }
}

function loadState() {
  const raw = store.get(STORE_GAME);
  if (raw) {
    try {
      const saved = JSON.parse(raw);
      if (saved.puzzleDate === todayPuzzle().date) {
        const pz = todayPuzzle();
        state = { ...saved, grid: pz.grid, puzzleIndex: todayIndex(),
                  optimalPath: null, viewingOptimal: false,
                  hasViewedOptimal: saved.hasViewedOptimal ?? false };
        return;
      }
    } catch { /* fall through */ }
  }
  state = defaultState();
}

// ── Stats ────────────────────────────────────────────────────────────────────
function defaultStats() {
  return { played: 0, solved: 0, one: 0, two: 0, three: 0, streak: 0, maxStreak: 0, lastPuzzle: -1 };
}
function loadStats() {
  try { return JSON.parse(store.get(STORE_STATS)) || defaultStats(); } catch { return defaultStats(); }
}
function saveStats(s) { store.set(STORE_STATS, JSON.stringify(s)); }

function recordResult(stars) {
  const s = loadStats();
  const idx = state.puzzleIndex;
  s.played++;
  if (stars > 0) {
    s.solved++;
    if (stars === 1) s.one++;
    if (stars === 2) s.two++;
    if (stars === 3) s.three++;
    s.streak = (s.lastPuzzle === idx - 1) ? s.streak + 1 : 1;
    s.maxStreak = Math.max(s.maxStreak, s.streak);
  } else {
    s.streak = 0;
  }
  s.lastPuzzle = idx;
  saveStats(s);
}

// ── Settings ─────────────────────────────────────────────────────────────────
function loadTheme() {
  document.body.classList.toggle('dark', store.get('chainle_dark') === '1');
}
function saveTheme(v) {
  store.set('chainle_dark', v ? '1' : '0');
  document.body.classList.toggle('dark', v);
}

// ── Path logic ───────────────────────────────────────────────────────────────
function startPath(idx) {
  state.path = [idx];
  state.sum  = state.grid[idx];
  renderGrid();
  renderInfo();
}

function extendPath(idx) {
  if (!state.path.length) { startPath(idx); return; }
  const last = state.path[state.path.length - 1];
  if (idx === last) return;

  // Backtrack if touching penultimate cell
  if (state.path.length >= 2 && idx === state.path[state.path.length - 2]) {
    state.sum -= state.grid[last];
    state.path.pop();
    renderGrid();
    renderInfo();
    return;
  }

  if (!isAdjacent(last, idx) || state.path.includes(idx)) return;
  state.path.push(idx);
  state.sum += state.grid[idx];
  renderGrid();
  renderInfo();
}

function resetPath() {
  state.path = [];
  state.sum  = 0;
  renderGrid();
  renderInfo();
  saveState();
}

function confirmPath() {
  if (state.status !== 'playing') return;
  const { valid } = validatePath(state.path, state.grid, state.target);
  if (!valid) { toast('Сумма не совпадает с целью'); return; }

  const stars = calcStars(state.path.length, state.optimal);
  state.status = 'solved';
  state.stars  = stars;
  state.submittedPath = [...state.path];
  recordResult(stars);
  saveState();
  render();
  setTimeout(() => openModal('stats'), 1600);
}

// ── Grid builder ─────────────────────────────────────────────────────────────
function buildGrid() {
  const grid = document.getElementById('game-grid');
  grid.innerHTML = '';
  for (let i = 0; i < 25; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.id = `cell-${i}`;
    cell.dataset.idx = i;
    grid.appendChild(cell);
  }
}

// ── Render ───────────────────────────────────────────────────────────────────
function renderGrid() {
  const displayPath = state.viewingOptimal
    ? (state.optimalPath || [])
    : state.status === 'solved'
      ? (state.submittedPath || [])
      : state.path;

  for (let i = 0; i < 25; i++) {
    const cell = document.getElementById(`cell-${i}`);
    const pos  = displayPath.indexOf(i);
    const num  = state.grid[i];

    cell.className = 'cell';
    if (pos === -1) {
      cell.innerHTML = `<span class="cell-val">${num}</span>`;
    } else {
      const isFirst = pos === 0;
      const isLast  = pos === displayPath.length - 1;
      cell.classList.add('in-path');
      if (isFirst)      cell.classList.add('path-start');
      else if (isLast)  cell.classList.add('path-end');

      if (state.viewingOptimal) {
        cell.classList.add('optimal-path');
      } else if (state.status === 'solved' && state.stars === 3) {
        cell.classList.add('three-star');
      } else if (state.status === 'solved') {
        cell.classList.add('solved');
      }

      cell.innerHTML = `<span class="cell-val">${num}</span><span class="cell-seq">${pos + 1}</span>`;
    }
  }

  // Sum-state colouring
  if (state.status === 'playing' && state.path.length > 0) {
    if (state.sum === state.target) {
      const lastIdx = state.path[state.path.length - 1];
      document.getElementById(`cell-${lastIdx}`).classList.add('sum-ok');
    } else if (state.sum > state.target) {
      for (const idx of state.path) {
        document.getElementById(`cell-${idx}`).classList.add('sum-exceeded');
      }
    }
  }

  renderPathSVG(displayPath, state.viewingOptimal);
}

function renderPathSVG(path, isOptimal = false) {
  const line = document.getElementById('path-line');
  if (!line) return;
  if (path.length < 2) { line.setAttribute('points', ''); return; }

  const container = document.getElementById('grid-container');
  const rect = container.getBoundingClientRect();
  if (!rect.width) return;

  const cells = document.querySelectorAll('.cell');
  const pts = path.map(idx => {
    const cr = cells[idx].getBoundingClientRect();
    return `${cr.left - rect.left + cr.width / 2},${cr.top - rect.top + cr.height / 2}`;
  }).join(' ');

  line.setAttribute('points', pts);

  const sw = cells[0].getBoundingClientRect().width * 0.2;
  line.setAttribute('stroke-width', sw);

  if (isOptimal) {
    line.setAttribute('stroke', 'rgba(99,148,222,0.85)');
    return;
  }

  const solved = state.status === 'solved';
  line.setAttribute('stroke', solved && state.stars === 3
    ? 'rgba(106,170,100,0.85)'
    : solved
      ? 'rgba(201,180,88,0.85)'
      : state.sum === state.target
        ? 'rgba(106,170,100,0.85)'
        : state.sum > state.target
          ? 'rgba(229,62,62,0.75)'
          : 'rgba(106,170,100,0.65)');
}

function renderInfo() {
  const sumEl    = document.getElementById('current-sum');
  const lenEl    = document.getElementById('path-len');
  const confirmBtn = document.getElementById('btn-confirm');

  const sum = state.sum;
  const len = state.path.length;

  sumEl.textContent = sum;
  lenEl.textContent = len;

  sumEl.className = 'info-val';
  if (sum === state.target && len > 0) sumEl.classList.add('sum-match');
  else if (sum > state.target)         sumEl.classList.add('sum-over');

  if (confirmBtn) {
    confirmBtn.disabled = (state.sum !== state.target || state.path.length < 2);
  }
}

function render() {
  // Puzzle number in header
  const numEl = document.getElementById('puzzle-num');
  if (numEl) numEl.textContent = `#${state.puzzleIndex + 1}`;

  // Target display
  const targetEl = document.getElementById('target-num');
  if (targetEl) targetEl.textContent = state.target;

  document.getElementById('target-sum').textContent = state.target;

  renderGrid();
  renderInfo();
  renderActionArea();

  document.getElementById('toggle-dark-mode').checked = document.body.classList.contains('dark');
}

function renderActionArea() {
  const panel = document.getElementById('result-panel');

  if (state.status === 'solved') {
    const stars  = '⭐'.repeat(state.stars) + '☆'.repeat(3 - state.stars);
    const titles = ['', 'Решено!', 'Отлично!', 'Идеально!'];
    const subs   = ['', 'Путь не оптимален, но задача решена.', 'Почти идеально — на клетку длиннее.', 'Кратчайший маршрут — мастерский ход!'];

    const canSeeOptimal = state.stars < 3;
    const optimalLabel  = state.viewingOptimal ? 'Скрыть оптимум' : 'Посмотреть оптимум';
    const retryBlocked  = state.hasViewedOptimal;

    const showOptimalBtn = canSeeOptimal
      ? `<button class="btn-secondary" id="banner-optimal-btn">${optimalLabel}</button>`
      : '';
    const retryBtn = !retryBlocked
      ? `<button class="btn-secondary" id="banner-retry-btn">Попробовать снова</button>`
      : '';
    const retryBlockedNote = retryBlocked
      ? `<div class="result-retry-blocked">Оптимальный путь просмотрен — повтор недоступен</div>`
      : '';

    panel.innerHTML = `
      <div class="result-stars">${stars}</div>
      <div class="result-title">${state.viewingOptimal ? 'Оптимальный путь' : titles[state.stars]}</div>
      <div class="result-sub">${state.viewingOptimal ? `Кратчайший маршрут: ${state.optimal} кл.` : subs[state.stars]}</div>
      <div class="result-meta">Ваш путь: ${state.submittedPath.length} кл. · Оптимум: ${state.optimal} кл.</div>
      <div class="result-actions">
        ${showOptimalBtn}
        ${retryBtn}
        <button class="btn-primary" id="banner-share-btn">Поделиться</button>
      </div>
      ${retryBlockedNote}`;

    if (canSeeOptimal) {
      document.getElementById('banner-optimal-btn').onclick = toggleOptimalPath;
    }
    if (!retryBlocked) {
      document.getElementById('banner-retry-btn').onclick = retryPuzzle;
    }
    document.getElementById('banner-share-btn').onclick = shareResult;
    panel.classList.remove('hidden');

    document.getElementById('action-bar').classList.add('hidden');
    return;
  }

  panel.classList.add('hidden');
  document.getElementById('action-bar').classList.remove('hidden');
}

// ── Touch & mouse input ───────────────────────────────────────────────────────
let pointerDown  = false;
let didDrag      = false;
let dragStartIdx = null;

function getCellFromPoint(clientX, clientY) {
  const container = document.getElementById('grid-container');
  const rect = container.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
  const col = Math.floor(x / (rect.width  / 5));
  const row = Math.floor(y / (rect.height / 5));
  if (col < 0 || col >= 5 || row < 0 || row >= 5) return null;
  return row * 5 + col;
}

function bindGridEvents() {
  const container = document.getElementById('grid-container');

  // Touch: respond immediately (extend/start on touchstart, continue on touchmove)
  container.addEventListener('touchstart', e => {
    e.preventDefault();
    if (state.status !== 'playing') return;
    const idx = getCellFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    if (idx === null) return;
    didDrag = false;
    dragStartIdx = idx;
    pointerDown = true;
    const last = state.path[state.path.length - 1];
    if (idx === last) return; // resume from last cell — no reset
    if (state.path.length > 0 && isAdjacent(last, idx)) {
      extendPath(idx);
    } else {
      startPath(idx);
    }
  }, { passive: false });

  container.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!pointerDown || state.status !== 'playing') return;
    const idx = getCellFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    if (idx !== null) { didDrag = true; extendPath(idx); }
  }, { passive: false });

  container.addEventListener('touchend', e => {
    e.preventDefault();
    pointerDown = false;
    if (state.status === 'playing') saveState();
  }, { passive: false });

  // Mouse: mousedown only sets up drag — path is built via mousemove (drag) or click (tap)
  container.addEventListener('mousedown', e => {
    if (state.status !== 'playing') return;
    const idx = getCellFromPoint(e.clientX, e.clientY);
    if (idx === null) return;
    didDrag = false;
    dragStartIdx = idx;
    pointerDown = true;
  });

  container.addEventListener('mousemove', e => {
    if (!pointerDown || state.status !== 'playing') return;
    const idx = getCellFromPoint(e.clientX, e.clientY);
    if (idx === null) return;
    if (!didDrag) {
      // First cell of drag — initialize path from dragStartIdx
      didDrag = true;
      const last = state.path[state.path.length - 1];
      if (dragStartIdx !== last) startPath(dragStartIdx);
    }
    extendPath(idx);
  });

  document.addEventListener('mouseup', () => {
    if (pointerDown && state.status === 'playing') saveState();
    pointerDown = false;
  });

  // Click (tap without drag): extend path or start new one
  container.addEventListener('click', e => {
    if (didDrag) { didDrag = false; return; }
    if (state.status !== 'playing') return;
    const idx = getCellFromPoint(e.clientX, e.clientY);
    if (idx === null) return;
    const last = state.path[state.path.length - 1];
    if (idx === last) return; // tap on last cell — no-op, allows resuming drag
    if (!state.path.length || !isAdjacent(last, idx)) {
      startPath(idx);
    } else {
      extendPath(idx);
    }
    saveState();
  });
}

// ── Retry ─────────────────────────────────────────────────────────────────────
function retryPuzzle() {
  state.status = 'playing';
  state.path   = [];
  state.sum    = 0;
  state.stars  = 0;
  state.submittedPath  = null;
  state.optimalPath    = null;
  state.viewingOptimal = false;
  // hasViewedOptimal intentionally kept — retry blocked if optimal was seen
  saveState();
  render();
}

// ── Show / hide optimal path ──────────────────────────────────────────────────
function toggleOptimalPath() {
  if (state.viewingOptimal) {
    state.viewingOptimal = false;
    renderGrid();
    renderActionArea();
    return;
  }

  if (!state.optimalPath) {
    state.optimalPath = findOptimalPath(state.grid, state.target, state.optimal);
  }

  if (!state.optimalPath) {
    toast('Не удалось найти оптимальный путь');
    return;
  }

  state.viewingOptimal   = true;
  state.hasViewedOptimal = true;
  saveState();
  renderGrid();
  renderActionArea();
}

// ── Sharing ───────────────────────────────────────────────────────────────────
function shareResult() {
  if (!state.submittedPath) return;
  const stars = '⭐'.repeat(state.stars);
  const lines = [
    `Chainle #${state.puzzleIndex + 1} 🔗`,
    `Цель: ${state.target} | ${stars}`,
    `Путь: ${state.submittedPath.length} клеток`,
    '',
    'chainle.ru',
  ];
  const text = lines.join('\n');
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => toast('Скопировано!'))
      .catch(() => copyFallback(text));
  } else {
    copyFallback(text);
  }
}

function copyFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    toast('Скопировано!');
  } catch {
    toast('Не удалось скопировать');
  }
  ta.remove();
}

// ── Stats modal ───────────────────────────────────────────────────────────────
function renderStats() {
  const s = loadStats();
  document.getElementById('stat-played').textContent    = s.played;
  document.getElementById('stat-streak').textContent    = s.streak;
  document.getElementById('stat-max-streak').textContent = s.maxStreak;

  const max = Math.max(s.one, s.two, s.three, 1);
  const setBar = (id, val) => {
    const bar = document.getElementById(id);
    bar.style.width = Math.max(10, Math.round(val / max * 100)) + '%';
    bar.querySelector('span').textContent = val;
  };
  setBar('bar-three', s.three);
  setBar('bar-two',   s.two);
  setBar('bar-one',   s.one);

  const footer = document.getElementById('stats-footer');
  if (state.status === 'solved') {
    footer.classList.remove('hidden');
    document.getElementById('btn-share').onclick = shareResult;
    startCountdown();
  } else {
    footer.classList.add('hidden');
  }
}

let _countdownTimer = null;
function startCountdown() {
  clearInterval(_countdownTimer);
  const update = () => {
    const now  = new Date();
    const next = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const diff = next - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const el = document.getElementById('countdown');
    if (el) el.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };
  update();
  _countdownTimer = setInterval(update, 1000);
}

// ── Modals ────────────────────────────────────────────────────────────────────
function openModal(name) {
  if (name === 'stats') renderStats();
  document.getElementById(`overlay-${name}`).classList.add('open');
}
function closeModal(name) {
  document.getElementById(`overlay-${name}`).classList.remove('open');
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, duration = 2000) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── Event bindings ────────────────────────────────────────────────────────────
function bindEvents() {
  bindGridEvents();

  document.getElementById('btn-reset').onclick   = () => { if (state.status === 'playing') resetPath(); };
  document.getElementById('btn-confirm').onclick  = confirmPath;

  document.getElementById('btn-how-to-play').onclick = () => openModal('how-to-play');
  document.getElementById('btn-stats').onclick       = () => openModal('stats');
  document.getElementById('btn-settings').onclick    = () => openModal('settings');

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.onclick = () => closeModal(btn.dataset.close);
  });
  document.querySelectorAll('.modal-overlay').forEach(ov => {
    ov.onclick = e => { if (e.target === ov) ov.classList.remove('open'); };
  });

  document.getElementById('toggle-dark-mode').onchange = e => saveTheme(e.target.checked);

  document.getElementById('btn-privacy').onclick = () => openModal('privacy');

  window.addEventListener('resize', () => renderPathSVG(
    state.status === 'solved' ? (state.submittedPath || []) : state.path
  ));

  if (!store.get('chainle_visited')) {
    store.set('chainle_visited', '1');
    setTimeout(() => openModal('how-to-play'), 300);
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
init();
