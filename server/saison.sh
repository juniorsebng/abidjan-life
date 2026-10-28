#!/usr/bin/env bash
# Lancer / arrêter une saison.  Exemples :
#   bash saison.sh free                                    → monde libre (par défaut)
#   bash saison.sh season "2026-10-26 20:00" "2026-10-31 20:00"   → fin des inscriptions lundi 20h, fin samedi 20h (heure d'Abidjan = UTC)
KEY=$(cat /opt/abidjanlife/.admin)
if [ "$1" = "free" ]; then BODY='{"mode":"free"}'
else P=$(date -u -d "$2 UTC" +%s)000; F=$(date -u -d "$3 UTC" +%s)000; BODY="{\"mode\":\"season\",\"prepEnd\":$P,\"endAt\":$F}"; fi
curl -s -X POST http://127.0.0.1:3000/admin/season -H "x-admin-key: $KEY" -d "$BODY"; echo
