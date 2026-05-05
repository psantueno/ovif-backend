#!/usr/bin/env bash
# ==============================================================
# Actualizacion manual del entorno de desarrollo OVIF
# ==============================================================
# Uso:
#   ./scripts/update-development.sh
#
# Opcional:
#   DRY_RUN=1 ./scripts/update-development.sh
#   RUN_NPM_CI=1 ./scripts/update-development.sh
#   SERVICE_NAME=ovif-backend ./scripts/update-development.sh
#   FRONTEND_DIR=/home/infrait/ovif-frontend/ovif-frontend ./scripts/update-development.sh
#   WEB_ROOT=/var/www/ovif ./scripts/update-development.sh
#   FRONTEND_CONFIGURATION=production ./scripts/update-development.sh
#
# El script:
#   1. Opcionalmente instala dependencias.
#   2. Reinicia el servicio systemd del backend.
#   3. Genera el build del frontend.
#   4. Publica los archivos nuevos en WEB_ROOT.
#   5. Valida y recarga nginx para servir el nuevo index/assets.
#
# Con instalación de dependencias:
#
#   RUN_NPM_CI=1 ./scripts/update-development.sh
# ==============================================================

set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="${FRONTEND_DIR:-/home/infrait/ovif-frontend/ovif-frontend}"
SERVICE_NAME="${SERVICE_NAME:-ovif-backend}"
WEB_ROOT="${WEB_ROOT:-/var/www/ovif}"
FRONTEND_CONFIGURATION="${FRONTEND_CONFIGURATION:-production}"
BUILD_DIR="${BUILD_DIR:-$FRONTEND_DIR/dist/ovif-frontend/browser}"
RUN_NPM_CI="${RUN_NPM_CI:-0}"
RUN_BACKEND_NPM_CI="${RUN_BACKEND_NPM_CI:-$RUN_NPM_CI}"
RUN_FRONTEND_NPM_CI="${RUN_FRONTEND_NPM_CI:-$RUN_NPM_CI}"
RESTART_BACKEND="${RESTART_BACKEND:-1}"
BUILD_FRONTEND="${BUILD_FRONTEND:-1}"
PUBLISH_FRONTEND="${PUBLISH_FRONTEND:-1}"
RELOAD_NGINX="${RELOAD_NGINX:-1}"
DRY_RUN="${DRY_RUN:-0}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

run() {
  log "+ $*"
  if [[ "$DRY_RUN" == "1" ]]; then
    return 0
  fi
  "$@"
}

require_dir() {
  local path="$1"
  local label="$2"
  [[ -d "$path" ]] || die "no existe $label: $path"
}

assert_safe_web_root() {
  [[ -n "$WEB_ROOT" ]] || die "WEB_ROOT no puede estar vacio"
  [[ "$WEB_ROOT" != "/" ]] || die "WEB_ROOT no puede ser /"

  case "$WEB_ROOT" in
    /var/www/*|/home/infrait/*) ;;
    *)
      die "WEB_ROOT debe estar dentro de /var/www o /home/infrait. Valor recibido: $WEB_ROOT"
      ;;
  esac
}

require_dir "$BACKEND_DIR" "directorio backend"
require_dir "$FRONTEND_DIR" "directorio frontend"
assert_safe_web_root

log "Backend: $BACKEND_DIR"
log "Frontend: $FRONTEND_DIR"
log "Servicio backend: $SERVICE_NAME"
log "Destino frontend: $WEB_ROOT"
log "Configuracion frontend: $FRONTEND_CONFIGURATION"

if [[ "$RUN_BACKEND_NPM_CI" == "1" ]]; then
  log "Instalando dependencias del backend"
  run npm --prefix "$BACKEND_DIR" ci
fi

if [[ "$RESTART_BACKEND" == "1" ]]; then
  log "Reiniciando servicio backend"
  run sudo systemctl restart "$SERVICE_NAME"
  run sudo systemctl status "$SERVICE_NAME" --no-pager --full
fi

if [[ "$RUN_FRONTEND_NPM_CI" == "1" ]]; then
  log "Instalando dependencias del frontend"
  run npm --prefix "$FRONTEND_DIR" ci
fi

if [[ "$BUILD_FRONTEND" == "1" ]]; then
  log "Generando build del frontend"
  run npm --prefix "$FRONTEND_DIR" run build -- --configuration "$FRONTEND_CONFIGURATION"
fi

if [[ "$PUBLISH_FRONTEND" == "1" ]]; then
  if [[ "$DRY_RUN" != "1" ]]; then
    require_dir "$BUILD_DIR" "directorio de build frontend"
  fi

  log "Publicando frontend en $WEB_ROOT"
  run sudo install -d "$WEB_ROOT"

  if command -v rsync >/dev/null 2>&1; then
    run sudo rsync -a --delete "$BUILD_DIR/" "$WEB_ROOT/"
  else
    log "rsync no esta instalado; copiando archivos nuevos con cp -a"
    run sudo cp -a "$BUILD_DIR/." "$WEB_ROOT/"
  fi
fi

if [[ "$RELOAD_NGINX" == "1" ]]; then
  log "Validando nginx"
  run sudo nginx -t

  log "Recargando nginx"
  run sudo systemctl reload nginx
fi

log "Actualizacion completada"
