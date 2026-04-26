#!/usr/bin/env bash
# ==============================================================
# Deploy manual del backend OVIF en produccion
# ==============================================================
# Uso:
#   ./scripts/deploy-production.sh
#
# Opcional:
#   RUN_NPM_CI=1 ./scripts/deploy-production.sh
#   SERVICE_NAME=ovif-backend ./scripts/deploy-production.sh
#
# En backend también podés cambiar el nombre del servicio si algún día fuera distinto:
# SERVICE_NAME=ovif-backend RUN_NPM_CI=1 ./scripts/deploy-production.sh
# ==============================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="${SERVICE_NAME:-ovif-backend}"
RUN_NPM_CI="${RUN_NPM_CI:-0}"

cd "$ROOT_DIR"

echo "[$(date)] Iniciando deploy backend desde: $ROOT_DIR"

if [[ "$RUN_NPM_CI" == "1" ]]; then
  echo "[$(date)] Instalando dependencias de produccion..."
  npm ci --omit=dev
fi

echo "[$(date)] Reiniciando servicio: $SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"

echo "[$(date)] Estado del servicio:"
sudo systemctl status "$SERVICE_NAME" --no-pager --full

echo "[$(date)] Deploy backend completado"
echo "Para ver logs: ./scripts/logs-production.sh"
