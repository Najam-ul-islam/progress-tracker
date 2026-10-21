#!/usr/bin/env bash
# SC-006: `python-jose` may only be imported from app/core/security.py.
# Exit non-zero if any other file imports `jose`.
set -euo pipefail

cd "$(dirname "$0")/.."

violations=$(
    grep -RIn --include='*.py' -E '^\s*(from jose|import jose)' app \
        | grep -v '^app/core/security.py:' \
        || true
)

if [ -n "$violations" ]; then
    echo "FAIL: python-jose imported outside app/core/security.py:"
    echo "$violations"
    exit 1
fi
echo "OK: python-jose is only imported in app/core/security.py"
