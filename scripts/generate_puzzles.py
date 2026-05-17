#!/usr/bin/env python3
"""Chainle puzzle generator. Outputs data/puzzles.json."""

import json
import sys
from datetime import date, timedelta

# ── Precomputed neighbor table ────────────────────────────────────────────────
NEIGHBORS = [[] for _ in range(25)]
for _i in range(25):
    _r, _c = divmod(_i, 5)
    if _r > 0: NEIGHBORS[_i].append(_i - 5)
    if _r < 4: NEIGHBORS[_i].append(_i + 5)
    if _c > 0: NEIGHBORS[_i].append(_i - 1)
    if _c < 4: NEIGHBORS[_i].append(_i + 1)


def _u32(x):
    return int(x) & 0xFFFFFFFF


def _i32(x):
    x = int(x) & 0xFFFFFFFF
    return x - 0x100000000 if x >= 0x80000000 else x


def mulberry32(seed):
    """Mulberry32 PRNG matching the JS implementation exactly."""
    s = [_u32(seed)]

    def rng():
        s[0] = _u32(s[0] + 0x6D2B79F5)
        t = _u32((s[0] ^ (s[0] >> 15)) * (1 | s[0]))
        t = _u32((t + _u32((t ^ (t >> 7)) * (61 | t))) ^ t)
        return _u32(t ^ (t >> 14)) / 4294967296

    return rng


def date_seed(s):
    """Matching JS dateSeed() — djb2-like hash returning signed int32."""
    h = 0
    for c in s:
        h = _i32(((h << 5) - h) + ord(c))
    return h


def gen_grid(rng):
    return [int(rng() * 9) + 1 for _ in range(25)]


def solve(grid, target, max_len=12, max_total=5001):
    """DFS over all paths. Returns (results_by_length, bailed_out)."""
    res = {}
    total = 0
    for start in range(25):
        stk = [(start, 1 << start, grid[start], 1)]
        while stk:
            pos, vis, s, ln = stk.pop()
            if s == target:
                res[ln] = res.get(ln, 0) + 1
                total += 1
                if total >= max_total:
                    return res, True
                continue
            if s > target or ln >= max_len:
                continue
            for nb in NEIGHBORS[pos]:
                if not (vis & (1 << nb)):
                    ns = s + grid[nb]
                    if ns <= target:
                        stk.append((nb, vis | (1 << nb), ns, ln + 1))
    return res, False


def best_target(grid):
    """Find the best target for a grid. Returns (target, optimal_length) or (None, None)."""
    best = (-1, None, None)
    for t in range(45, 61):
        res, bailed = solve(grid, t)
        if bailed or not res:
            continue
        ml = min(res.keys())
        sc = res[ml]
        tot = sum(res.values())
        if ml < 8 or sc > 6 or tot < 50:
            continue
        score = ml * 100 - sc * 10
        if score > best[0]:
            best = (score, t, ml)
    return best[1], best[2]


def gen_puzzle(date_str):
    """Try up to 10 seed offsets to find a valid puzzle for the given date."""
    seed = date_seed(f"chainle-{date_str}")
    for attempt in range(10):
        rng = mulberry32(_u32(seed + attempt * 999983))
        grid = gen_grid(rng)
        t, opt = best_target(grid)
        if t is not None:
            return {"date": date_str, "grid": grid, "target": t, "optimal": opt}
    return None


def main():
    start_date = date(2026, 1, 1)
    count = 365
    puzzles = []
    failed = []

    for i in range(count):
        d = start_date + timedelta(days=i)
        ds = d.isoformat()
        p = gen_puzzle(ds)
        if p:
            puzzles.append(p)
            sys.stdout.write(f"\r{ds} [{i+1}/{count}] target={p['target']} optimal={p['optimal']}  ")
            sys.stdout.flush()
        else:
            failed.append(ds)
            sys.stdout.write(f"\r{ds} [{i+1}/{count}] FAILED                    \n")
            sys.stdout.flush()

    print(f"\n\nGenerated {len(puzzles)}/{count} puzzles. Failed: {failed or 'none'}")

    with open("data/puzzles.json", "w") as f:
        json.dump({"puzzles": puzzles}, f, separators=(",", ":"))

    print(f"Saved to data/puzzles.json ({len(json.dumps({'puzzles': puzzles}, separators=(',', ':'))) // 1024} KB)")


if __name__ == "__main__":
    main()
