#!/usr/bin/env bash
# Run before committing to catch build errors (TypeScript, missing deps, etc.)
# Builds Docker images up to the compile step only — does not start any containers.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
FAIL=0

echo "==> Frontend (npm run build)..."
if docker build --target build -t warehouse-check-frontend "$ROOT/frontend" --quiet; then
  echo "    OK"
  docker rmi warehouse-check-frontend --force > /dev/null 2>&1
else
  echo "    FAILED"
  FAIL=1
fi

echo "==> Backend (collectstatic + deps)..."
if docker build -t warehouse-check-backend "$ROOT/backend" --quiet; then
  echo "    OK"
  docker rmi warehouse-check-backend --force > /dev/null 2>&1
else
  echo "    FAILED"
  FAIL=1
fi

if [ $FAIL -ne 0 ]; then
  echo ""
  echo "Build check FAILED — fix errors above before pushing."
  exit 1
fi

echo ""
echo "All good — safe to commit and push."
