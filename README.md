# Chainle

Russian daily math puzzle game. Draw a chain through a 5×5 grid so the sum of numbers equals the daily target.

**Live:** [chainle.ru](https://chainle.ru)

## Game mechanics

- Connect adjacent cells (up/down/left/right) in a continuous chain
- No cell can be visited twice
- The sum of all cells in the chain must exactly equal the daily target (~45–60)
- Backtrack by returning to the previous cell
- ⭐⭐⭐ — optimal path length
- ⭐⭐ — one cell longer than optimal
- ⭐ — solved, but can be improved

## Stack

- Vanilla JS ES modules, no framework
- Single HTML file + `style.css` + `js/app.js` + `js/engine.js`
- Game state and stats persisted in `localStorage`
- Daily puzzle: pre-generated JSON for all of 2026, selected by date

## Project structure

```
index.html              Single-page app entry point
style.css               All styles: CSS variables, dark mode, responsive
js/
  app.js                UI, touch/mouse input, SVG path overlay, modals
  engine.js             Pure functions: DFS solver, path validation, star rating
data/
  puzzles.json          327 pre-generated puzzles for 2026
tests/
  engine.test.js        Unit tests for game logic (vitest, 38 tests)
scripts/
  generate_puzzles.py   Puzzle generator
  build.js              Replaces __BUILD_HASH__ with git short hash
  deploy.sh             Initial server provisioning script
docker/
  nginx.conf            nginx config inside container (gzip, 30d cache)
Dockerfile              Multi-stage build: node → nginx
docker-compose.yml      Port 127.0.0.1:8082:80
.github/workflows/
  deploy.yml            CI/CD: push to main → tests → SSH deploy
```

## Local development

```bash
python3 -m http.server 3457
# open http://localhost:3457
```

No build step required for local dev. `__BUILD_HASH__` is replaced automatically during Docker build.

## Tests

```bash
npm ci
npm test
```

## Build

```bash
npm run build
```

Replaces `__BUILD_HASH__` in `index.html` and `js/app.js` with the current git short hash for cache busting.

## Deployment

Push to `main` triggers GitHub Actions → tests → SSH into production server → `sudo chainle-update` (git pull + docker compose up).

**Server:** Ubuntu 20.04, nginx reverse proxy, Docker, Let's Encrypt SSL  
**Webroot:** `/var/www/chainle.ru`

## Puzzles

327 puzzles pre-generated for 2026-01-02 through 2026-12-31.  
Each puzzle: `date`, `grid[25]` (values 1–9), `target`, `optimal` (shortest path length).  
To regenerate: `python3 scripts/generate_puzzles.py`
