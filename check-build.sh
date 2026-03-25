#!/usr/bin/env bash
# Run before committing to catch TypeScript / build errors.
# Uses node inside frontend/ directly — no Docker needed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
FAIL=0

echo "==> Frontend (tsc + vite build)..."
if (cd "$ROOT/frontend" && npm run build); then
  echo "    OK"
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
