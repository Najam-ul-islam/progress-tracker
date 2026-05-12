#!/usr/bin/env bash
# SC-007: app/modules/auth/ may only import from app.modules.users among
# sibling modules. Exit non-zero on violation.
set -euo pipefail

cd "$(dirname "$0")/.."

violations=$(
    grep -RIn --include='*.py' -E '^\s*(from app\.modules\.|import app\.modules\.)' app/modules/auth \
        | grep -v 'app\.modules\.users' \
        | grep -v 'app\.modules\.auth' \
        || true
)

if [ -n "$violations" ]; then
    echo "FAIL: auth module imports a sibling other than users:"
    echo "$violations"
    exit 1
fi
echo "OK: auth module only imports app.modules.users"
