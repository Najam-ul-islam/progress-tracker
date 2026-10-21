#!/usr/bin/env bash
# FR-023: app/modules/payments/ may import from siblings ONLY via the
# read-only allow-list:
#   - app.modules.projects.repository (project lookup, active modules)
#   - app.modules.users.repository    (developer existence checks if needed)
# Plus the auth infrastructure / schema (role Literal):
#   - app.modules.auth.dependencies
#   - app.modules.auth.schema
# Anything else (sibling services, sibling routes, clients, other auth
# submodules) is forbidden.
set -euo pipefail

cd "$(dirname "$0")/.."

# Sibling imports must target only `.repository` for projects/users; clients
# is fully forbidden.
violations_siblings=$(
    grep -RIn --include='*.py' -E '^\s*(from app\.modules\.(projects|users|clients)|import app\.modules\.(projects|users|clients))' app/modules/payments \
        | grep -vE '(app\.modules\.(projects|users)\.repository|from app\.modules\.(projects|users) import repository)' \
        || true
)

violations_auth=$(
    grep -RIn --include='*.py' -E '^\s*(from app\.modules\.auth|import app\.modules\.auth)' app/modules/payments \
        | grep -vE 'app\.modules\.auth\.(dependencies|schema)' \
        || true
)

if [ -n "$violations_siblings" ] || [ -n "$violations_auth" ]; then
    echo "FAIL: payments module imports forbidden symbols (FR-023)."
    if [ -n "$violations_siblings" ]; then
        echo "-- forbidden sibling imports (only projects.repository / users.repository allowed; clients forbidden):"
        echo "$violations_siblings"
    fi
    if [ -n "$violations_auth" ]; then
        echo "-- forbidden auth submodule imports (only dependencies, schema allowed):"
        echo "$violations_auth"
    fi
    exit 1
fi
echo "OK: payments module only imports allow-listed symbols (FR-023)"
