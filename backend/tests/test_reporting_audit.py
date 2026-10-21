"""Programmatic enforcement of the reporting module's read-only contract.

Mirrors `backend/scripts/audit_reporting_imports.sh` so violations show up
under pytest as well as CI shell checks (FR-023, Decision 7).
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest


_REPORTING_DIR = (
    Path(__file__).resolve().parent.parent / "app" / "modules" / "reporting"
)
_FORBIDDEN_MUTATIONS = re.compile(r"session\.(add|delete|merge|commit)\s*\(")
_SIBLING_IMPORT = re.compile(
    r"^\s*(from\s+app\.modules\.(?P<sib>projects|payments|users|clients)|"
    r"import\s+app\.modules\.(?P<sib2>projects|payments|users|clients))",
    re.MULTILINE,
)
_AUTH_IMPORT = re.compile(
    r"^\s*(from\s+app\.modules\.auth|import\s+app\.modules\.auth)",
    re.MULTILINE,
)
_ALLOWED_SIBLING = re.compile(
    r"app\.modules\.(projects|payments|users|clients)\.(repository|model)|"
    r"from app\.modules\.(projects|payments|users|clients) import (repository|model)"
)
_ALLOWED_AUTH = re.compile(r"app\.modules\.auth\.(dependencies|schema)")


def _python_files() -> list[Path]:
    return [p for p in _REPORTING_DIR.rglob("*.py") if "__pycache__" not in p.parts]


def test_no_session_mutation_in_reporting_module():
    offenders: list[str] = []
    for path in _python_files():
        text = path.read_text(encoding="utf-8")
        for match in _FORBIDDEN_MUTATIONS.finditer(text):
            offenders.append(f"{path.name}: {match.group(0)}")
    assert not offenders, (
        "reporting module must not call session.add/delete/merge/commit; "
        f"found: {offenders}"
    )


def test_sibling_imports_within_allow_list():
    offenders: list[str] = []
    for path in _python_files():
        text = path.read_text(encoding="utf-8")
        for line in text.splitlines():
            sib_match = _SIBLING_IMPORT.match(line)
            if sib_match and not _ALLOWED_SIBLING.search(line):
                offenders.append(f"{path.name}: {line.strip()}")
            auth_match = _AUTH_IMPORT.match(line)
            if auth_match and not _ALLOWED_AUTH.search(line):
                offenders.append(f"{path.name}: {line.strip()}")
    assert not offenders, (
        "reporting module imports outside the FR-023 allow-list: "
        f"{offenders}"
    )
