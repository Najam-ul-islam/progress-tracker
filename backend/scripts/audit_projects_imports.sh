#!/usr/bin/env bash
# FR-027: app/modules/projects/ may import from siblings ONLY via the
# read-only allow-list:
#   - app.modules.clients.repository.get_client_by_id
#   - app.modules.users.repository.get_user_by_id
# Plus the auth infrastructure / schema (role Literal):
#   - app.modules.auth.dependencies
#   - app.modules.auth.schema
# Anything else (sibling services, sibling routes, payments, other auth
# submodules) is forbidden.
set -euo pipefail

cd "$(dirname "$0")/.."

# Sibling imports must target only `.repository` for clients/users; payments
# is fully forbidden.
violations_siblings=$(
    grep -RIn --include='*.py' -E '^\s*(from app\.modules\.(clients|users|payments)|import app\.modules\.(clients|users|payments))' app/modules/projects \
        | grep -vE '(app\.modules\.(clients|users)\.repository|from app\.modules\.(clients|users) import repository)' \
        || true
)

violations_auth=$(
    grep -RIn --include='*.py' -E '^\s*(from app\.modules\.auth|import app\.modules\.auth)' app/modules/projects \
        | grep -vE 'app\.modules\.auth\.(dependencies|schema)' \
        || true
)

if [ -n "$violations_siblings" ] || [ -n "$violations_auth" ]; then
    echo "FAIL: projects module imports forbidden symbols (FR-027)."
    if [ -n "$violations_siblings" ]; then
        echo "-- forbidden sibling imports (only clients.repository / users.repository allowed; payments forbidden):"
        echo "$violations_siblings"
    fi
    if [ -n "$violations_auth" ]; then
        echo "-- forbidden auth submodule imports (only dependencies, schema allowed):"
        echo "$violations_auth"
    fi
    exit 1
fi
echo "OK: projects module only imports allow-listed symbols (FR-027)"
