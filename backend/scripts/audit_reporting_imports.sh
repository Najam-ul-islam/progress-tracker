#!/usr/bin/env bash
# FR-023: app/modules/reporting/ may import from siblings ONLY via the
# read-only allow-list:
#   - app.modules.projects.repository / .model
#   - app.modules.payments.repository / .model
#   - app.modules.users.repository    / .model
#   - app.modules.clients.repository  / .model
#   - app.modules.auth.dependencies
#   - app.modules.auth.schema
#
# `.model` is allow-listed because the reporting SQL must reference the
# SQLModel table classes (`select(Project)`, `select(User)`, …). Sibling
# `.service`, `.routes`, `.schema`, `.dependencies` remain forbidden.
#
# Plus the read-only contract (Decision 7 in research.md): the reporting
# module MUST NOT mutate the database. Forbid `session.add(`,
# `session.delete(`, `session.merge(`, `session.commit(` anywhere under
# `backend/app/modules/reporting/`.
set -euo pipefail

cd "$(dirname "$0")/.."

# Sibling imports must target only `.repository` (queries) or `.model` (read-only
# SQLModel table classes the queries select from). Sibling `.service`, `.routes`,
# `.schema`, `.dependencies` are forbidden.
violations_siblings=$(
    grep -RIn --include='*.py' -E '^\s*(from app\.modules\.(projects|payments|users|clients)|import app\.modules\.(projects|payments|users|clients))' app/modules/reporting \
        | grep -vE '(app\.modules\.(projects|payments|users|clients)\.(repository|model)|from app\.modules\.(projects|payments|users|clients) import (repository|model))' \
        || true
)

violations_auth=$(
    grep -RIn --include='*.py' -E '^\s*(from app\.modules\.auth|import app\.modules\.auth)' app/modules/reporting \
        | grep -vE 'app\.modules\.auth\.(dependencies|schema)' \
        || true
)

# Read-only contract: forbid mutation calls on `session.*`.
violations_mutation=$(
    grep -RIn --include='*.py' -E 'session\.(add|delete|merge|commit)\s*\(' app/modules/reporting \
        || true
)

failed=0
if [ -n "$violations_siblings" ]; then
    echo "FAIL: reporting module imports forbidden sibling symbols (FR-023)."
    echo "-- forbidden sibling imports (only *.repository allowed for projects/payments/users/clients):"
    echo "$violations_siblings"
    failed=1
fi
if [ -n "$violations_auth" ]; then
    echo "FAIL: reporting module imports forbidden auth symbols (FR-023)."
    echo "-- forbidden auth submodule imports (only dependencies, schema allowed):"
    echo "$violations_auth"
    failed=1
fi
if [ -n "$violations_mutation" ]; then
    echo "FAIL: reporting module mutates the database (Decision 7: read-only contract)."
    echo "-- forbidden mutation calls (session.add / delete / merge / commit):"
    echo "$violations_mutation"
    failed=1
fi

if [ $failed -ne 0 ]; then
    exit 1
fi
echo "OK: reporting module only imports allow-listed symbols and is read-only (FR-023 + Decision 7)"
