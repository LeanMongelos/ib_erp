#!/usr/bin/env bash
# Configura el VPS para deploy automático desde GitHub Actions (una sola vez).
set -euo pipefail

APP_DIR="/opt/ibiomedica"
REPO="https://github.com/LeanMongelos/ib_erp.git"
BRANCH="${DEPLOY_BRANCH:-master}"
DEPLOY_KEY="/root/.ssh/github_actions_deploy"
AUTH_KEYS="/root/.ssh/authorized_keys"

echo "==> Clave SSH para GitHub Actions..."
mkdir -p /root/.ssh
chmod 700 /root/.ssh

if [[ ! -f "$DEPLOY_KEY" ]]; then
  ssh-keygen -t ed25519 -f "$DEPLOY_KEY" -N "" -C "github-actions-ibiomedica"
fi

PUB=$(cat "${DEPLOY_KEY}.pub")
if [[ -f "$AUTH_KEYS" ]] && grep -qF "$PUB" "$AUTH_KEYS" 2>/dev/null; then
  echo "Clave pública ya está en authorized_keys."
else
  echo "$PUB" >> "$AUTH_KEYS"
  chmod 600 "$AUTH_KEYS"
  echo "Clave pública agregada a authorized_keys."
fi

echo "==> Repositorio git en $APP_DIR..."
ENV_BACKUP=""
if [[ -f "$APP_DIR/.env" ]]; then
  ENV_BACKUP=$(mktemp)
  cp "$APP_DIR/.env" "$ENV_BACKUP"
fi

PROD_COMPOSE=""
if [[ -f "$APP_DIR/docker-compose.prod.yml" ]]; then
  PROD_COMPOSE=$(mktemp)
  cp "$APP_DIR/docker-compose.prod.yml" "$PROD_COMPOSE"
fi

if [[ -d "$APP_DIR/.git" ]]; then
  cd "$APP_DIR"
  git remote set-url origin "$REPO" 2>/dev/null || git remote add origin "$REPO"
  git fetch origin
  git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
  git reset --hard "origin/$BRANCH"
else
  rm -rf "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

if [[ -n "$ENV_BACKUP" && -f "$ENV_BACKUP" ]]; then
  cp "$ENV_BACKUP" "$APP_DIR/.env"
  rm -f "$ENV_BACKUP"
  echo ".env de producción restaurado."
fi

if [[ -n "$PROD_COMPOSE" && -f "$PROD_COMPOSE" ]]; then
  cp "$PROD_COMPOSE" "$APP_DIR/docker-compose.prod.yml"
  rm -f "$PROD_COMPOSE"
fi

chmod +x "$APP_DIR/scripts/vps-deploy-from-git.sh"

echo ""
echo "=============================================="
echo "  Configuración VPS lista."
echo "  Agregá este secreto en GitHub → Settings → Secrets:"
echo ""
echo "  VPS_HOST     = 149.50.152.115"
echo "  VPS_PORT     = 5244"
echo "  VPS_USER     = root"
echo "  VPS_SSH_KEY  = (contenido de la clave privada abajo)"
echo ""
echo "=============================================="
echo ""
cat "$DEPLOY_KEY"
echo ""
