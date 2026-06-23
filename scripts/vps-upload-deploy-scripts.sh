#!/usr/bin/env bash
set -euo pipefail
cd /opt/ibiomedica
chmod +x scripts/vps-deploy-from-git.sh 2>/dev/null || true
git remote -v
git status -sb | head -3
ls -la scripts/vps-deploy-from-git.sh 2>/dev/null || echo "deploy script missing"
