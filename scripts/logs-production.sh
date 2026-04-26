#!/usr/bin/env bash
# ==============================================================
# Logs en tiempo real del backend OVIF en produccion
# ==============================================================
# Uso:
#   ./scripts/logs-production.sh
#
# Opcional:
#   SERVICE_NAME=ovif-backend ./scripts/logs-production.sh
# ==============================================================

set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-ovif-backend}"

sudo journalctl -u "$SERVICE_NAME" -f
