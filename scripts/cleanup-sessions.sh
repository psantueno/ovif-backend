#!/usr/bin/env bash
# ==============================================================
# Limpieza de sesiones expiradas y tokens blacklist viejos
# ==============================================================
# Uso: agregar al crontab del servidor de BD
#   0 4 * * * /home/infrait/ovif-backend/scripts/cleanup-sessions.sh >> /var/log/ovif-cleanup.log 2>&1
# ==============================================================

set -euo pipefail

DB_NAME="ovif_v2"
DB_USER="soporte"

ENV_FILE="$(dirname "$0")/../.env"
if [[ -f "$ENV_FILE" ]]; then
  DB_PASS=$(grep "^DB_PASS=" "$ENV_FILE" | cut -d= -f2-)
else
  echo "ERROR: No se encontró $ENV_FILE"
  exit 1
fi

echo "[$(date)] Limpiando sesiones expiradas y revocadas..."

mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" <<SQL
-- Eliminar sesiones expiradas hace más de 7 días
DELETE FROM ovif_auth_sessions
WHERE expires_at < DATE_SUB(NOW(), INTERVAL 7 DAY);

-- Eliminar tokens blacklist expirados (legacy, durante rollout)
DELETE FROM ovif_tokens_blacklist
WHERE fecha_expiracion < NOW();
SQL

echo "[$(date)] Limpieza completada"
