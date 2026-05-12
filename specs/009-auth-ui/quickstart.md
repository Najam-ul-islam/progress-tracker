# Quickstart — Authentication UI (009-auth-ui)

This is the developer-facing how-to-run-and-test recipe for the slice. It is meant to be followed end-to-end on a clean checkout once `/sp.implement` has produced the code.

## 1. Prerequisites

- Node 20+ and `npm` (or `pnpm`/`yarn`; commands below use `npm`).
- `uv` and Python 3.11+ for the backend.
- Postgres running locally (per the backend `002-auth-jwt-rbac` quickstart).

## 2. Start the backend

From the repo root:

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

The OpenAPI doc at `http://localhost:8000/docs` should list `/auth/register`, `/auth/login`, `/auth/me`.

## 3. Configure the frontend env

```bash
cd frontend
cp .env.example .env.development   # contains VITE_API_BASE_URL=http://localhost:8000
```

## 4. Install and start the frontend

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. You should land on `/login` because no session exists.

## 5. Smoke test (matches the P1 user stories)

**US2 — Register and auto-login**
1. Click "Create an account".
2. Fill name, a fresh email, a password that meets the rules (≥ 8 chars, 1 letter, 1 digit), pick `developer`.
3. Submit. You should land on the authenticated landing page within ~1 s.

**US1 — Sign out and sign back in**
1. Click the sign-out control in the top-right.
2. You should return to `/login`.
3. Re-enter the same email + password. You should land on the authenticated landing page again.

**US3 — Persistence**
1. While signed in, reload the tab. You should stay signed in.
2. Close the browser entirely and reopen it (within the token's 60-minute window). You should still be signed in.

**US4 — Protected routing**
1. While signed out, paste a protected URL (e.g. `http://localhost:5173/`) into the address bar.
2. You should be sent to `/login`. After signing in, you should land back on `/`, not on a default page.

**US5 — Unauthorized page**
1. Sign in as a `developer`.
2. Navigate to a route restricted to admins (none ship in this slice yet — once a later feature adds one, this step becomes runnable). The unauthorized page (`/unauthorized`) MUST render, NOT a redirect to `/login`.

## 6. Test commands

```bash
# Unit + component (Vitest, fast)
npm run test

# Component tests with MSW only (no backend required)
npm run test -- tests/component

# End-to-end (Playwright; requires backend running on :8000)
npm run test:e2e
```

## 7. Acceptance gates before merge

Map directly to spec Success Criteria:

- [ ] **SC-001**: cold load to authenticated landing in < 5 s (Playwright timing).
- [ ] **SC-003**: refresh and browser-restart leave the session intact (Playwright).
- [ ] **SC-004**: unauthorized page reached on role mismatch in 100% of attempts.
- [ ] **SC-005**: login failure produces a single generic error; register failure attaches to a field (component tests assert message text + selector).
- [ ] **SC-006**: rapid double-submit produces exactly one network call (Playwright `page.on("request")` count).
- [ ] **SC-007**: 401 on a signed-in request lands on `/login` in < 1 s with the "session ended" notice and no flash of protected content.
- [ ] **SC-008**: deep-link → login → return-to behaviour holds for all protected routes (Playwright parameterised).

## 8. Manual checklist (constitution alignment)

- [ ] No `any` in any new TS file (CI: `tsc --noEmit` + `eslint`).
- [ ] No imports of `auth.api` outside `modules/auth/hooks/`.
- [ ] No direct `axios` import outside `src/lib/http.ts` (grep).
- [ ] Tailwind responsive classes pass on `sm`, `md`, `lg`, `xl` breakpoints for both auth pages.
- [ ] Keyboard-only flow: tab into form → submit → land on dest → tab to sign-out → activate → return to login.

## 9. Common gotchas

- **CORS**: the backend must allow `http://localhost:5173` (Vite default). If you see a CORS error in the browser console, check the backend's CORS middleware origin list — it is owned by `001-project-structure`, not this slice.
- **Stale token after backend restart**: when the backend reboots with a new `JWT_SECRET_KEY`, every persisted token becomes invalid. The first request after restart will 401, and the app will sign you out with the "session ended" notice — this is correct behaviour, not a bug.
- **Browser autofill**: some browsers fill the email and password without firing the usual events; RHF picks this up via the `onChange` handler shadcn's `<Input>` registers, so submit-button validity reflects the autofilled values within one tick.
