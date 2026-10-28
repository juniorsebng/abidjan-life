#!/usr/bin/env bash
# Installation d'Abidjan Life sur Ubuntu 24.04 (à lancer en root, dans le dossier du serveur décompressé)
# Usage :  DOMAIN=api.mondomaine.com ORIGINS=https://monjeu.vercel.app bash install.sh   (HTTPS automatique)
#          bash install.sh                                                     (sans domaine → http://IP:3000, test)
set -e
APP=/opt/abidjanlife
echo "== 1/6 Paquets"
apt-get update -y && apt-get install -y curl ufw ca-certificates gnupg
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs
fi
echo "== 2/6 Application"
mkdir -p $APP && cp -r ./* $APP/ && cd $APP && npm install --omit=dev --silent
ADMIN_KEY=$( [ -f $APP/.admin ] && cat $APP/.admin || head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24 )
echo "$ADMIN_KEY" > $APP/.admin && chmod 600 $APP/.admin
useradd -r -s /usr/sbin/nologin abidjanlife 2>/dev/null || true
chown -R abidjanlife:abidjanlife $APP
echo "== 3/6 Service systemd"
cat > /etc/systemd/system/abidjanlife.service <<EOF
[Unit]
Description=Abidjan Life
After=network.target
[Service]
User=abidjanlife
WorkingDirectory=$APP
Environment=PORT=3000
Environment=ALLOWED_ORIGINS=${ORIGINS:-*}
Environment=ADMIN_KEY=$ADMIN_KEY
Environment=DATA_FILE=$APP/data/data.json
ExecStart=/usr/bin/node $APP/server.js
Restart=always
RestartSec=2
LimitNOFILE=65535
[Install]
WantedBy=multi-user.target
EOF
mkdir -p $APP/data && chown abidjanlife:abidjanlife $APP/data
systemctl daemon-reload && systemctl enable --now abidjanlife
echo "== 4/6 Pare-feu"
ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
[ -z "$DOMAIN" ] && ufw allow 3000/tcp >/dev/null
ufw --force enable >/dev/null
if [ -n "$DOMAIN" ]; then
  echo "== 5/6 HTTPS (Caddy) pour $DOMAIN"
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -y && apt-get install -y caddy
  printf "%s {\n  encode gzip\n  reverse_proxy 127.0.0.1:3000\n}\n" "$DOMAIN" > /etc/caddy/Caddyfile
  systemctl restart caddy; URL="https://$DOMAIN"
else URL="http://$(curl -s ifconfig.me):3000"; fi
echo "== 6/6 Terminé"
echo "Serveur : $URL   (à renseigner dans web/config.js)"
echo "Clé admin (garde-la secrète) : $ADMIN_KEY"
echo "Statut : systemctl status abidjanlife   |   Logs : journalctl -u abidjanlife -f"
