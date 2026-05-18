#!/usr/bin/env bash
# deploy.sh — первичный деплой Chainle на Ubuntu 20.04
# Запускать от пользователя с sudo: bash deploy.sh
set -euo pipefail

DOMAIN="chainle.ru"
WWW_DOMAIN="www.chainle.ru"
REPO="https://github.com/NikitaMikhailov/chainle-ru.git"
WEBROOT="/var/www/${DOMAIN}"
EMAIL="mikhailov_nikita1997@icloud.com"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC}   $*"; }

# ── 1. Docker ────────────────────────────────────────────────────────────────
log "Проверяю Docker..."
if ! command -v docker &>/dev/null; then
  log "Устанавливаю Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
fi
sudo systemctl enable docker
sudo systemctl start docker
log "Docker $(docker --version) — запущен"

# ── 2. Nginx (reverse proxy) ─────────────────────────────────────────────────
log "Устанавливаю nginx..."
sudo apt-get update -qq
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# ── 3. Клонируем репо ───────────────────────────────────────────────────────
log "Клонирую репозиторий в ${WEBROOT}..."
if [ -d "${WEBROOT}/.git" ]; then
  warn "Директория уже существует — делаю git pull"
  sudo git -C "${WEBROOT}" pull
else
  sudo git clone "${REPO}" "${WEBROOT}"
fi
sudo chown -R "$USER":"$USER" "${WEBROOT}"
log "Файлы игры готовы"

# ── 4. Запускаем контейнер ───────────────────────────────────────────────────
log "Собираю и запускаю Docker-контейнер..."
cd "${WEBROOT}"
docker compose up --build -d
log "Контейнер запущен на 127.0.0.1:8082"

# ── 5. Nginx reverse proxy (HTTP) ────────────────────────────────────────────
log "Настраиваю nginx reverse proxy..."
sudo tee /etc/nginx/sites-available/${DOMAIN} > /dev/null << NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${WWW_DOMAIN};

    access_log /var/log/nginx/${DOMAIN}.access.log;
    error_log  /var/log/nginx/${DOMAIN}.error.log;

    # Security headers — HSTS активируется certbot-ом после получения SSL
    add_header X-Content-Type-Options  "nosniff"                         always;
    add_header X-Frame-Options         "DENY"                            always;
    add_header Referrer-Policy         "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy      "camera=(), microphone=(), geolocation=()" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    location / {
        proxy_pass http://127.0.0.1:8082;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/${DOMAIN}
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
log "nginx конфиг применён (HTTP)"

# ── 6. SSL через Let's Encrypt ──────────────────────────────────────────────
log "Получаю SSL-сертификат..."
sudo certbot --nginx \
  --non-interactive \
  --agree-tos \
  --email "${EMAIL}" \
  --domains "${DOMAIN},${WWW_DOMAIN}" \
  --redirect

sudo systemctl enable certbot.timer 2>/dev/null || true
log "SSL сертификат получен и настроен"

# ── 7. Скрипт обновления ────────────────────────────────────────────────────
sudo tee /usr/local/bin/chainle-update > /dev/null << 'UPDATER'
#!/usr/bin/env bash
set -euo pipefail
cd /var/www/chainle.ru
sudo git pull origin main
docker compose up --build -d
docker image prune -f
echo "[$(date)] Обновлено успешно"
UPDATER
sudo chmod +x /usr/local/bin/chainle-update

# ── Готово ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  Готово! Игра доступна на:${NC}"
echo -e "${GREEN}  https://${DOMAIN}${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "Обновить игру позже: sudo chainle-update"
echo "Логи nginx:          sudo tail -f /var/log/nginx/${DOMAIN}.error.log"
echo "Логи контейнера:     docker compose -f ${WEBROOT}/docker-compose.yml logs -f"
