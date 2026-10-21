#!/usr/bin/env bash
# FR-020 / FR-021: app/modules/clients/ may import:
#   - app.modules.auth.dependencies (infrastructure)
#   - app.modules.auth.schema       (the role Literal — closed contract)
# It MUST NOT import from app.modules.users, app.modules.projects,
# app.modules.payments, or any other auth submodule (auth.service / auth.repository).
set -euo pipefail

cd "$(dirname "$0")/.."

violations_siblings=$(
    grep -RIn --include='*.py' -E '^\s*(from app\.modules\.(users|projects|payments)|import app\.modules\.(users|projects|payments))' app/modules/clients \
        || true
)

violations_auth=$(
    grep -RIn --include='*.py' -E '^\s*(from app\.modules\.auth|import app\.modules\.auth)' app/modules/clients \
        | grep -vE 'app\.modules\.auth\.(dependencies|schema)' \
        || true
)

if [ -n "$violations_siblings" ] || [ -n "$violations_auth" ]; then
    echo "FAIL: clients module imports forbidden symbols (FR-020 / FR-021)."
    if [ -n "$violations_siblings" ]; then
        echo "-- forbidden sibling imports (users/projects/payments):"
        echo "$violations_siblings"
    fi
    if [ -n "$violations_auth" ]; then
        echo "-- forbidden auth submodule imports (only dependencies, schema allowed):"
        echo "$violations_auth"
    fi
    exit 1
fi
echo "OK: clients module only imports app.modules.auth.{dependencies,schema}"
