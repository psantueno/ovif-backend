#!/usr/bin/env bash
# ==============================================================
# Backup diario de la base de datos OVIF (MariaDB)
# ==============================================================
# Uso: ./backup-db.sh
# Recomendado: agregar al crontab del servidor de BD (172.16.10.54)
#   0 3 * * * /home/infrait/ovif-backend/scripts/backup-db.sh >> /var/log/ovif-backup.log 2>&1
# ==============================================================

set -euo pipefail

# --- Configuración ---
DB_NAME="ovif_v2"
DB_USER="soporte"
BACKUP_DIR="/home/infrait/backups/ovif"
RETENTION_DAYS=30

# Leer contraseña desde .env del backend (evita hardcodear)
ENV_FILE="$(dirname "$0")/../.env"
if [[ -f "$ENV_FILE" ]]; then
  DB_PASS=$(grep "^DB_PASS=" "$ENV_FILE" | cut -d= -f2-)
else
  echo "ERROR: No se encontró $ENV_FILE"
  exit 1
fi

# --- Crear directorio si no existe ---
mkdir -p "$BACKUP_DIR"

# --- Nombre del archivo con timestamp ---
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

# --- Ejecutar backup comprimido ---
echo "[$(date)] Iniciando backup de ${DB_NAME}..."
mariadb-dump \
  -u "$DB_USER" \
  -p"$DB_PASS" \
  --single-transaction \
  --routines \
  --triggers \
  --quick \
  "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "[$(date)] Backup creado: ${BACKUP_FILE} ($(du -h "$BACKUP_FILE" | cut -f1))"

# --- Limpiar backups viejos ---
DELETED=$(find "$BACKUP_DIR" -name "*.sql.gz" -mtime +${RETENTION_DAYS} -print -delete | wc -l)
if [[ "$DELETED" -gt 0 ]]; then
  echo "[$(date)] Limpieza: eliminados ${DELETED} backups con más de ${RETENTION_DAYS} días"
fi

echo "[$(date)] Backup completado exitosamente"
