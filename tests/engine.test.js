import { describe, it, expect } from 'vitest';
import {
  NEIGHBORS, isAdjacent, mulberry32, dateSeed,
  solve, validatePath, calcStars, puzzleIndex, getPuzzle,
} from '../js/engine.js';

// ── NEIGHBORS ────────────────────────────────────────────────────────────────
describe('NEIGHBORS', () => {
  it('corner cell (0) has 2 neighbors', () => {
    expect(NEIGHBORS[0]).toEqual([5, 1]);
  });
  it('corner cell (24) has 2 neighbors', () => {
    expect(NEIGHBORS[24]).toEqual([19, 23]);
  });
  it('center cell (12) has 4 neighbors', () => {
    expect(NEIGHBORS[12]).toHaveLength(4);
    expect(NEIGHBORS[12]).toContain(7);
    expect(NEIGHBORS[12]).toContain(17);
    expect(NEIGHBORS[12]).toContain(11);
    expect(NEIGHBORS[12]).toContain(13);
  });
  it('edge cell (2) has 3 neighbors', () => {
    expect(NEIGHBORS[2]).toHaveLength(3);
  });
});

// ── isAdjacent ───────────────────────────────────────────────────────────────
describe('isAdjacent', () => {
  it('horizontal neighbors', () => {
    expect(isAdjacent(0, 1)).toBe(true);
    expect(isAdjacent(4, 3)).toBe(true);
  });
  it('vertical neighbors', () => {
    expect(isAdjacent(0, 5)).toBe(true);
    expect(isAdjacent(20, 15)).toBe(true);
  });
  it('diagonal is NOT adjacent', () => {
    expect(isAdjacent(0, 6)).toBe(false);
    expect(isAdjacent(12, 18)).toBe(false);
  });
  it('same cell is NOT adjacent', () => {
    expect(isAdjacent(5, 5)).toBe(false);
  });
  it('wrap-around is NOT adjacent (col 4 and col 0)', () => {
    expect(isAdjacent(4, 5)).toBe(false);
    expect(isAdjacent(9, 10)).toBe(false);
  });
});

// ── mulberry32 ───────────────────────────────────────────────────────────────
describe('mulberry32', () => {
  it('returns values in [0, 1)', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('is deterministic for the same seed', () => {
    const a = mulberry32(1337);
    const b = mulberry32(1337);
    for (let i = 0; i < 20; i++) {
      expect(a()).toBe(b());
    }
  });
  it('different seeds produce different sequences', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });
});

// ── dateSeed ─────────────────────────────────────────────────────────────────
describe('dateSeed', () => {
  it('returns a number', () => {
    expect(typeof dateSeed('2026-01-01')).toBe('number');
  });
  it('same string → same seed', () => {
    expect(dateSeed('2026-06-15')).toBe(dateSeed('2026-06-15'));
  });
  it('different strings → different seeds', () => {
    expect(dateSeed('2026-01-01')).not.toBe(dateSeed('2026-01-02'));
  });
});

// ── validatePath ─────────────────────────────────────────────────────────────
describe('validatePath', () => {
  const grid = Array(25).fill(1); // all 1s, target = path length

  it('rejects empty path', () => {
    expect(validatePath([], grid, 3).valid).toBe(false);
  });
  it('rejects single-cell path', () => {
    expect(validatePath([0], grid, 1).valid).toBe(false);
  });
  it('accepts valid path summing to target', () => {
    // 0→1→2: sum=3
    const r = validatePath([0, 1, 2], grid, 3);
    expect(r.valid).toBe(true);
    expect(r.sum).toBe(3);
  });
  it('rejects non-adjacent steps', () => {
    // 0→2 is not adjacent
    expect(validatePath([0, 2], grid, 2).valid).toBe(false);
  });
  it('rejects repeated cells', () => {
    expect(validatePath([0, 1, 0], grid, 2).valid).toBe(false);
  });
  it('rejects path with wrong sum', () => {
    expect(validatePath([0, 1, 2], grid, 5).valid).toBe(false);
  });
  it('respects wrap-around rule: cell 4 and 5 are NOT adjacent', () => {
    expect(validatePath([4, 5], grid, 2).valid).toBe(false);
  });
});

// ── calcStars ─────────────────────────────────────────────────────────────────
describe('calcStars', () => {
  it('3 stars for optimal length', () => {
    expect(calcStars(7, 7)).toBe(3);
  });
  it('3 stars for shorter than optimal (shouldn\'t happen but handled)', () => {
    expect(calcStars(6, 7)).toBe(3);
  });
  it('2 stars for optimal+1', () => {
    expect(calcStars(8, 7)).toBe(2);
  });
  it('1 star for optimal+2', () => {
    expect(calcStars(9, 7)).toBe(1);
  });
  it('1 star for much longer path', () => {
    expect(calcStars(15, 7)).toBe(1);
  });
});

// ── solve ─────────────────────────────────────────────────────────────────────
describe('solve', () => {
  it('finds paths that sum to target', () => {
    const grid = [1,2,3,4,5, 1,2,3,4,5, 1,2,3,4,5, 1,2,3,4,5, 1,2,3,4,5];
    const { results } = solve(grid, 3);
    // Paths of length 2 summing to 3: many (1+2, 2+1)
    expect(results[2]).toBeGreaterThan(0);
  });
  it('returns empty results when no path exists', () => {
    // All 9s, target=5 — impossible (min path sum is 9+9=18)
    const grid = Array(25).fill(9);
    const { results } = solve(grid, 5);
    expect(Object.keys(results)).toHaveLength(0);
  });
  it('bails out when maxTotal is exceeded', () => {
    // All 1s, target=2 — many paths of length 2 (every adjacent pair)
    const grid = Array(25).fill(1);
    const { bailed } = solve(grid, 2, 12, 10);
    expect(bailed).toBe(true);
  });
  it('finds the correct minimum path length', () => {
    // Simple grid: 9,1,1,... target=2 → shortest is 2 cells (1+1)
    const grid = [9,1,1,9,9, 9,9,9,9,9, 9,9,9,9,9, 9,9,9,9,9, 9,9,9,9,9];
    const { results } = solve(grid, 2);
    expect(results[2]).toBeGreaterThan(0);
    expect(results[1]).toBeUndefined();
  });
});

// ── puzzleIndex ───────────────────────────────────────────────────────────────
describe('puzzleIndex', () => {
  it('returns 0 for start date', () => {
    expect(puzzleIndex('2026-05-17')).toBe(0);
  });
  it('returns 1 for day after start', () => {
    expect(puzzleIndex('2026-05-18')).toBe(1);
  });
  it('returns 228 for last day of 2026', () => {
    expect(puzzleIndex('2026-12-31')).toBe(228);
  });
  it('clamps to 0 for dates before start', () => {
    expect(puzzleIndex('2026-05-16')).toBe(0);
  });
});

// ── getPuzzle ─────────────────────────────────────────────────────────────────
describe('getPuzzle', () => {
  const puzzles = [
    { date: '2026-01-02', grid: [], target: 50, optimal: 8 },
    { date: '2026-01-03', grid: [], target: 55, optimal: 9 },
    { date: '2026-01-05', grid: [], target: 60, optimal: 10 },
  ];

  it('returns exact match', () => {
    expect(getPuzzle('2026-01-03', puzzles).target).toBe(55);
  });
  it('falls back to nearest previous puzzle', () => {
    // 2026-01-04 not in list → nearest previous is 2026-01-03
    expect(getPuzzle('2026-01-04', puzzles).target).toBe(55);
  });
  it('falls back to first puzzle when date is before all', () => {
    expect(getPuzzle('2026-01-01', puzzles)).toBe(puzzles[0]);
  });
});
