#!/usr/bin/env bash
# FR-020: app/modules/users/ may only import auth.dependencies (infrastructure).
# Imports of auth.service, auth.repository, or auth.schema (business logic) fail.
set -euo pipefail

cd "$(dirname "$0")/.."

violations=$(
    grep -RIn --include='*.py' -E '^\s*(from app\.modules\.auth|import app\.modules\.auth)' app/modules/users \
        | grep -v 'app\.modules\.auth\.dependencies' \
        || true
)

if [ -n "$violations" ]; then
    echo "FAIL: users module imports auth business logic (only auth.dependencies allowed):"
    echo "$violations"
    exit 1
fi
echo "OK: users module only imports app.modules.auth.dependencies"
