// ── Precomputed adjacency table ──────────────────────────────────────────────
export const NEIGHBORS = Array.from({ length: 25 }, (_, i) => {
  const row = Math.floor(i / 5), col = i % 5;
  const nb = [];
  if (row > 0) nb.push(i - 5);
  if (row < 4) nb.push(i + 5);
  if (col > 0) nb.push(i - 1);
  if (col < 4) nb.push(i + 1);
  return nb;
});

// ── Deterministic RNG — Mulberry32 ───────────────────────────────────────────
export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function dateSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}

// ── Adjacency helpers ────────────────────────────────────────────────────────
export function isAdjacent(a, b) {
  const ar = Math.floor(a / 5), ac = a % 5;
  const br = Math.floor(b / 5), bc = b % 5;
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

// ── Solver (DFS with bitmask visited) ───────────────────────────────────────
export function solve(grid, target, maxLength = 12, maxTotal = 5001) {
  const results = {};
  let total = 0;
  for (let start = 0; start < 25; start++) {
    const stack = [[start, 1 << start, grid[start], 1]];
    while (stack.length) {
      const [pos, visited, sum, len] = stack.pop();
      if (sum === target) {
        results[len] = (results[len] || 0) + 1;
        if (++total >= maxTotal) return { results, bailed: true };
        continue;
      }
      if (sum > target || len >= maxLength) continue;
      for (const nb of NEIGHBORS[pos]) {
        if (!(visited & (1 << nb)) && sum + grid[nb] <= target) {
          stack.push([nb, visited | (1 << nb), sum + grid[nb], len + 1]);
        }
      }
    }
  }
  return { results, bailed: false };
}

// ── Path validation ──────────────────────────────────────────────────────────
export function validatePath(path, grid, target) {
  if (path.length < 2) return { valid: false, sum: 0 };
  const seen = new Set();
  for (let i = 0; i < path.length; i++) {
    const idx = path[i];
    if (idx < 0 || idx > 24 || seen.has(idx)) return { valid: false, sum: 0 };
    if (i > 0 && !isAdjacent(path[i - 1], idx)) return { valid: false, sum: 0 };
    seen.add(idx);
  }
  const sum = path.reduce((s, i) => s + grid[i], 0);
  return { valid: sum === target, sum };
}

// ── Puzzle date helpers ──────────────────────────────────────────────────────
export const PUZZLE_START_DATE = '2026-05-17';

export function puzzleIndex(dateStr) {
  const [sy, sm, sd] = PUZZLE_START_DATE.split('-').map(Number);
  const [ty, tm, td] = dateStr.split('-').map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const today = Date.UTC(ty, tm - 1, td);
  return Math.max(0, Math.floor((today - start) / 86400000));
}

export function todayDateStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getPuzzle(dateStr, puzzles) {
  let p = puzzles.find(x => x.date === dateStr);
  if (p) return p;
  // Fall back to the nearest previous puzzle
  const sorted = puzzles.filter(x => x.date < dateStr).sort((a, b) => b.date.localeCompare(a.date));
  return sorted[0] || puzzles[0];
}

// ── Star rating ──────────────────────────────────────────────────────────────
export function calcStars(pathLength, optimal) {
  if (pathLength <= optimal) return 3;
  if (pathLength === optimal + 1) return 2;
  return 1;
}
