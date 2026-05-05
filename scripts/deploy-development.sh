#!/usr/bin/env bash
# ==============================================================
# Deploy manual del backend OVIF en desarrollo
# ==============================================================
# Uso:
#   ./scripts/deploy-development.sh
#
# Opcional:
#   DRY_RUN=1 ./scripts/deploy-development.sh
#   RUN_NPM_CI=1 ./scripts/deploy-development.sh
#   SERVICE_NAME=ovif-backend ./scripts/deploy-development.sh
# ==============================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="${SERVICE_NAME:-ovif-backend}"
RUN_NPM_CI="${RUN_NPM_CI:-0}"
DRY_RUN="${DRY_RUN:-0}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

run() {
  log "+ $*"
  if [[ "$DRY_RUN" == "1" ]]; then
    return 0
  fi
  "$@"
}

cd "$ROOT_DIR"

log "Iniciando deploy backend de desarrollo desde: $ROOT_DIR"
log "Servicio backend: $SERVICE_NAME"

if [[ "$RUN_NPM_CI" == "1" ]]; then
  log "Instalando dependencias del backend"
  run npm ci
fi

log "Reiniciando servicio backend"
run sudo systemctl restart "$SERVICE_NAME"

log "Estado del servicio"
run sudo systemctl status "$SERVICE_NAME" --no-pager --full

log "Deploy backend de desarrollo completado"
