# Chainle — CLAUDE.md

Ежедневная математическая головоломка на ванильном JS. Игрок ведёт непрерывную цепочку по сетке 5×5 из чисел 1–9 так, чтобы сумма ячеек точно равнялась дневной цели (~45–60).

## Структура проекта

```
index.html                  — SPA, один файл
style.css                   — CSS variables, dark mode через body.dark, адаптив
js/engine.js                — чистая логика: DFS-солвер с bitmask, Mulberry32 PRNG, валидация пути
js/app.js                   — UI: touch/mouse с SVG-оверлеем, localStorage, модалки, тосты
data/puzzles.json           — 327 паззлов на весь 2026 год (pre-generated)
scripts/generate_puzzles.py — регенерация паззлов
scripts/build.js            — заменяет __BUILD_HASH__ на git-хэш в index.html и js/app.js
scripts/deploy.sh           — первичный деплой на сервер
docker/nginx.conf           — конфиг nginx внутри контейнера (gzip, кэш, security)
Dockerfile                  — multi-stage: node → nginx
docker-compose.yml          — порт 127.0.0.1:8082:80
.github/workflows/deploy.yml — CI/CD: тесты → SSH деплой
tests/engine.test.js        — unit-тесты логики (vitest)
```

## Игровая механика

- Сетка 5×5, числа от 1 до 9
- Соседство только ортогональное (вверх/вниз/влево/вправо)
- Клетки нельзя повторять
- Откат — возврат пальца/курсора на предыдущую клетку
- Система звёзд: ⭐⭐⭐ = оптимальная длина, ⭐⭐ = +1 клетка, ⭐ = длиннее

## localStorage ключи

- `chainle_game`    — состояние текущей игры
- `chainle_stats`   — статистика (played, solved, streak и т.д.)
- `chainle_dark`    — тёмная тема (0/1)
- `chainle_visited` — флаг первого визита (показ How to Play)

## Паззл на день

Берётся из `data/puzzles.json` по дате; если дата отсутствует — fallback на ближайший предыдущий паззл.

## Локальная разработка

```bash
cd /Users/nikitamikhailov/Documents/chainle-ru
python3 -m http.server 3457
# открыть http://localhost:3457
```

Сервер для превью настроен в `.claude/launch.json`.

## Тесты

```bash
npm ci
npm test
```

## Сборка (замена __BUILD_HASH__)

```bash
npm run build
# или: node scripts/build.js
```

## Продакшн сервер

- **Домен:** https://chainle.ru
- **IP:** 194.58.119.182
- **SSH порт:** 10012
- **Пользователь:** bot_admin_3
- **ОС:** Ubuntu 20.04 LTS
- **Webroot:** `/var/www/chainle.ru`
- **nginx:** reverse proxy → Docker-контейнер на порту 8082
- **SSL:** Let's Encrypt, автообновление certbot
- **Обновление вручную:** `sudo chainle-update`
- **Логи nginx:** `sudo tail -f /var/log/nginx/chainle.ru.error.log`
- **Логи контейнера:** `docker compose -f /var/www/chainle.ru/docker-compose.yml logs -f`

## CI/CD (GitHub Actions)

Workflow: `.github/workflows/deploy.yml`
Триггер: push в `main` → запуск тестов → SSH деплой → `docker compose up --build -d`

**Secrets в репозитории** (Settings → Secrets → Actions):
- `SSH_HOST` — IP сервера
- `SSH_PORT` — SSH порт
- `SSH_USER` — имя пользователя
- `SSH_PRIVATE_KEY` — приватный ed25519 ключ

## Паззлы

Источник: `data/puzzles.json` — 327 паззлов с 2026-01-02 по 2026-12-31.
Каждый: `date`, `grid[25]`, `target`, `optimal`.
Пересобрать: `python3 scripts/generate_puzzles.py`
