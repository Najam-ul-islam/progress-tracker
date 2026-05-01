---
id: 0004
title: Enforce uv package manager policy
stage: tasks
date: 2026-05-01
surface: agent
model: claude-sonnet-4-6
feature: 001-project-structure
branch: 001-project-structure
user: Muhammad Najam Ul Islam
command: /sp.tasks
labels: ["tasks", "uv", "package-manager", "policy", "constraint"]
links:
  spec: specs/001-project-structure/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/001-project-structure/tasks.md
tests:
  - none (no test tasks generated; spec did not request tests)
---

## Prompt

/sp.tasks

Use `uv add` to install missing dependencies
Do NOT use pip
Do NOT create virtual environments manually

THIS PROJECT USES uv PACKAGE MANAGER.
ALL COMMANDS MUST USE `uv run` OR `uv add`.
DO NOT USE pip OR MANUAL VENV ACTIVATION.

## Response snapshot

Audited `specs/001-project-structure/tasks.md` for `pip` / `python -m venv` / `source .venv/activate` references — **zero matches**. Existing tasks already use `uv sync`, `uv run uvicorn`, `uv run alembic`, and `uv add` consistently.

Hardened the policy in two places so it cannot be missed by an implementer or future revision:

1. **New section** "⚠️ Package-Manager Policy (HARD RULE — applies to every task below)" inserted near the top of `tasks.md`. Lists exactly what is allowed (`uv add`, `uv sync`, `uv run`) and what is forbidden (any `pip`, manual venv creation/activation, hand-editing `uv.lock`, parallel package files). Closes with: "If a task below names a `pip` or `python -m venv` command (none should), treat it as a defect and substitute the `uv` equivalent."

2. **Reinforced T002** to spell out the conditional rule: only run `uv add <pkg>` if a dep is genuinely missing; do NOT use `pip install`; do NOT create or activate venvs manually; do NOT run `uv add` for packages already in `pyproject.toml`.

No structural change to phases or task IDs — total remains **37 tasks** organized as Setup (3) → Foundational (6) → US1 (10) → US2 (3) → US3 (10) → Polish (5).

## Outcome

- ✅ Impact: Package-manager policy is now an explicit, prominent gate in tasks.md; an implementer running through the file cannot miss the `uv`-only requirement. T002 spells out the conditional `uv add` rule with explicit anti-patterns.
- 🧪 Tests: none.
- 📁 Files: 1 modified (`specs/001-project-structure/tasks.md`).
- 🔁 Next prompts: `/sp.implement` to execute T001…T037 under the now-explicit `uv` policy. Optional: `/sp.analyze` to cross-check artifact consistency.
- 🧠 Reflection: The user's directive reaffirmed an existing rule rather than introducing new tasks, so the right move was to harden the policy section, not regenerate the task list. Regeneration would have churned T-IDs and broken any in-flight PRs that referenced them. Saved this as a feedback memory: when the user reasserts an existing constraint, harden the policy callout in-place; do not regenerate downstream artifacts.

## Evaluation notes (flywheel)

- Failure modes observed: none.
- Graders run and results (PASS/FAIL): pip-reference grep — PASS (zero matches before AND after edit). Format check — PASS (37 tasks still conform to `[ ] Tnnn [P?] [USx?] desc with path`).
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): consider a `/sp.analyze` automation that scans tasks.md for `pip|venv` strings and fails CI if present, so the policy enforces itself without relying on reviewer attention.
