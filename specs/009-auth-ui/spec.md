# Feature Specification: Authentication UI (Login, Register, Protected Routing)

**Feature Branch**: `009-auth-ui`
**Created**: 2026-05-11
**Status**: Draft
**Input**: User description (verbatim):
> now build the frontend UI which is in @frontend directory Build authentication UI for login, register, logout, and protected routing.
>
> Pages:
> - Login page
> - Register page
> - Unauthorized page
>
> Features:
> - JWT authentication
> - Form validation
> - Token persistence
> - Protected routes
> - Role-based navigation
>
> Components:
> - Auth form
> - Password input
> - Loading button
> - Auth layout

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Sign in with existing credentials (Priority: P1)

A returning user opens the application and is shown a login screen. They enter their email and password, submit, and on success are taken to the area of the app appropriate for their role. Their authenticated session survives a page refresh and a browser restart until the session naturally expires.

**Why this priority**: Login is the gate that turns the deployed app from "a landing page" into "a usable product". Without it, no other UI work in the product can be exercised by a real user. It is also the smallest visible slice that proves the frontend can talk to the existing authentication backend end-to-end.

**Independent Test**: With only US1 implemented, a tester (or Playwright run) can open the app, submit a known-good email + password against the live backend, and (a) land on an authenticated landing page, (b) refresh the tab and remain signed in, (c) close and reopen the browser and remain signed in until the session expires.

**Acceptance Scenarios**:

1. **Given** a registered user with valid credentials, **When** they submit the login form, **Then** they are taken to the authenticated landing area for their role and a visible signed-in indicator (their name/email) appears.
2. **Given** a user submits incorrect credentials, **When** the backend rejects the attempt, **Then** the form shows a single generic error message (no hint as to whether the email or the password was wrong) and the password field is cleared.
3. **Given** a successful login, **When** the user reloads the page or closes and reopens the browser before the session expires, **Then** they remain signed in without being asked to re-authenticate.
4. **Given** a successful login, **When** the user navigates directly to the login URL again, **Then** they are redirected to the authenticated landing area rather than shown the login form a second time.
5. **Given** any login attempt, **When** required fields are empty or the email is malformed, **Then** the submit action is blocked client-side and field-level validation messages appear.

---

### User Story 2 — Create a new account (Priority: P1)

A new user opens the application, follows a "create account" link from the login screen, fills name, email, password, and selects their role, then submits. On success they are signed in immediately (no second login round-trip) and arrive at the authenticated landing area for their role.

**Why this priority**: Self-service registration is required to populate the system with users without a manual database step. It also closes the loop on the "first run" experience — a brand-new visitor can go from zero to a working session without any out-of-band action.

**Independent Test**: With only US1 + US2 implemented, a tester can open the app, click "create account", complete the registration form with a fresh email, submit, and (a) land on the authenticated landing area immediately, (b) sign out, (c) sign back in with the same credentials via US1.

**Acceptance Scenarios**:

1. **Given** the registration form with all fields valid and a never-used email, **When** the user submits, **Then** the account is created, the user is signed in automatically, and they are taken to the authenticated landing area for their selected role.
2. **Given** the email field contains an address already in use, **When** the user submits, **Then** the form shows an inline error attached to the email field stating the address is already registered, and no account is created.
3. **Given** the password does not meet minimum complexity (length, character mix), **When** the user types or submits, **Then** field-level guidance shows which rule is unmet and submit is blocked until the rule passes.
4. **Given** the user has typed a password, **When** they toggle the password visibility control, **Then** the value is shown/hidden without losing the typed characters.
5. **Given** the user starts on the registration page, **When** they click "already have an account", **Then** they are taken to the login page with any partially-filled email pre-populated where reasonable.

---

### User Story 3 — Sign out (Priority: P1)

An authenticated user clicks "sign out" from anywhere in the app's primary navigation. Their session is cleared on the device, and they are returned to the login screen. Subsequent attempts to reach protected areas via direct URL send them back to login.

**Why this priority**: Without sign-out, an authenticated session on a shared device cannot be ended by the user. This is both a security expectation and a basic usability primitive, so it ships in the same slice as login.

**Independent Test**: While signed in, click sign-out; verify (a) the user is returned to the login page, (b) the persisted session marker is gone from local storage, (c) attempting to navigate directly to a protected URL redirects back to login.

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** they activate sign-out, **Then** the persisted session is cleared, the in-memory user state is cleared, and they are redirected to the login page.
2. **Given** a signed-out user, **When** they attempt to open a protected URL directly (e.g., by typing it in or using a back/forward action), **Then** they are sent to the login page; after a successful login they are returned to the originally requested URL.
3. **Given** an authenticated user, **When** the persisted session is found to be expired or rejected by the backend on the next request, **Then** the app automatically signs the user out and shows the login page with a non-alarming "your session has ended, please sign in again" notice.

---

### User Story 4 — Protected routing keeps unauthenticated users out (Priority: P1)

Every page in the app other than login, register, and the unauthorized notice is gated. A visitor with no session who tries to reach any such page is sent to the login screen. After they sign in, they land where they originally tried to go, not on a generic dashboard.

**Why this priority**: This is the structural guarantee that the rest of the product can be built without each page re-implementing its own access check. P1 alongside login because the value of login is only realised once protected routes actually protect.

**Independent Test**: With no session, attempt to load three different protected URLs directly. Each must redirect to the login page. After login, the user must land on the URL they originally requested, not on a default home page.

**Acceptance Scenarios**:

1. **Given** no session exists on the device, **When** any protected URL is requested, **Then** the user is redirected to the login page and the originally requested URL is remembered.
2. **Given** the user signs in from a redirect originated at step 1, **When** login succeeds, **Then** the user is sent to the originally requested URL.
3. **Given** a valid session exists, **When** the user navigates to a protected URL, **Then** the page renders without a redirect and without a visible flicker of the login screen.
4. **Given** the session is loaded from persistent storage on app start, **When** the first protected page is rendered, **Then** a brief loading indicator is shown until the stored session is validated, rather than briefly showing the login screen and then the page.

---

### User Story 5 — Role-based navigation and access (Priority: P2)

The application's primary navigation, and access to specific routes, depends on the signed-in user's role. An admin sees admin-only navigation entries and can open admin-only pages; a manager and a developer do not see those entries and, if they reach an admin-only URL directly, are taken to a dedicated "unauthorized" page rather than a generic error.

**Why this priority**: P2 because the MVP can ship with login + protected routes (P1) and a single shared post-login area. Role-aware navigation becomes necessary the moment the first role-specific page is built, which is the next feature, not this slice's MVP.

**Independent Test**: Sign in as each of admin, manager, developer in turn. Confirm (a) the primary navigation menu items differ by role per the role/route matrix in the Assumptions section, (b) directly opening an admin-only URL as a developer shows the dedicated unauthorized page (not a redirect to login, not a generic 404).

**Acceptance Scenarios**:

1. **Given** a signed-in admin, **When** the primary navigation renders, **Then** admin-only entries are present and clickable.
2. **Given** a signed-in developer, **When** the primary navigation renders, **Then** admin-only entries are absent and no broken layout artefacts remain in their place.
3. **Given** a signed-in developer, **When** they type or paste an admin-only URL into the address bar, **Then** they are taken to the unauthorized page, which states clearly that this role cannot access this area and offers a link back to a page they are allowed to see.
4. **Given** a signed-in user on the unauthorized page, **When** they sign out from it, **Then** sign-out behaves as in US3.

---

### Edge Cases

- The persisted session token is structurally present but rejected by the backend (e.g., signed with an old secret, or the user account was deleted) → app silently clears it and shows login with the "session ended" notice, not a confusing error.
- The persisted session is *expired* (client can tell from a decoded expiry claim) before the first request is even made → app does not attempt the request; it clears the session and routes to login.
- The user submits the login or register form twice in quick succession (double-click) → only one request is in flight at a time; the submit control shows a loading state and is disabled while the request is pending.
- The backend is unreachable (network error, server down) → form shows a transient, retry-friendly error ("can't reach the server, please try again") distinct from credential-rejection errors.
- The user starts typing in a form after a previous failed submit → the previous error message clears as soon as the affected field changes, so it never appears stale.
- The browser autofills the email and password → validation still runs against the autofilled values; the submit button reflects current validity.
- The user navigates with the browser back button immediately after sign-out → they are not shown a cached protected page; the app re-checks session state before rendering.
- Two tabs of the app are open and the user signs out in one → the other tab notices on its next action and signs out gracefully rather than continuing to act on a dead session.
- The user's role in the persisted session differs from the role the backend now reports (role was changed server-side) → the role from the backend wins on next refresh; navigation re-renders accordingly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST provide a login page that collects email and password and submits them to the existing backend login endpoint.
- **FR-002**: The application MUST provide a registration page that collects name, email, password, and role, and submits them to the existing backend registration endpoint.
- **FR-003**: On a successful registration, the application MUST establish an authenticated session for the new user without requiring them to log in separately.
- **FR-004**: The application MUST persist the active session locally so that a page refresh and a browser restart do not require re-authentication, until the session naturally expires.
- **FR-005**: The application MUST clear the persisted session on sign-out and on detection of an expired or backend-rejected session.
- **FR-006**: The application MUST validate all auth form fields client-side before submission: email format, required fields present, password meets the documented minimum rules (see Assumptions). Submission MUST be blocked while validation errors exist.
- **FR-007**: The application MUST present a single generic message on login failure (not field-specific), so an attacker cannot distinguish "unknown email" from "wrong password".
- **FR-008**: The application MUST attach inline, field-level errors for registration failures that the backend can attribute to a specific field (e.g., email already in use, password too weak).
- **FR-009**: The application MUST gate every page other than login, register, and the unauthorized notice. Unauthenticated access to a gated page MUST redirect to login and remember the originally requested URL so the user is returned there after sign-in.
- **FR-010**: The application MUST render a brief loading state while it determines session validity at app start, rather than briefly flashing the login page and then the destination page.
- **FR-011**: The application MUST render a dedicated unauthorized page (not a redirect to login, not a 404) when a signed-in user attempts to reach a route their role does not permit.
- **FR-012**: The application MUST drive its primary navigation entries from the signed-in user's role per the role/route matrix in the Assumptions section, hiding entries the role cannot use.
- **FR-013**: The application MUST attach the session credential to every backend request that requires authentication, and on a 401 response it MUST clear the session and route the user to the login page with a "session ended" notice.
- **FR-014**: The auth forms MUST present a submit control that visibly indicates a request is in flight and is disabled while it is, preventing duplicate submissions.
- **FR-015**: The password field MUST offer a show/hide toggle that preserves the typed value when toggled.
- **FR-016**: Field-level error messages MUST clear as soon as the affected field is edited, so stale errors are never shown.
- **FR-017**: The application MUST treat email as case-insensitive on input (normalised before submit) so users are not locked out by capitalisation differences.
- **FR-018**: The unauthorized page MUST identify itself clearly, state that the current role lacks access, and offer at least one link back to a page the current role is allowed to see, plus a sign-out control.
- **FR-019**: On sign-out, the user MUST be returned to the login page and any subsequent direct navigation to a protected URL via the back button MUST not render that page from cache.
- **FR-020**: Cross-tab consistency: if the persisted session is cleared in one tab, any other open tab MUST sign out at its next interaction rather than continuing to act on the dead session.

### Key Entities *(include if feature involves data)*

- **Authenticated session (client-side)**: A locally stored record that represents the currently signed-in user — at minimum: an opaque session credential issued by the backend, the user's display attributes (id, name, email), the user's role, and an expiry instant. The session is created by login or registration, read on every app start, attached to authenticated requests, and cleared on sign-out / expiry / backend rejection.
- **Auth form state**: The in-memory state of an open login or registration form — current field values, per-field validation status, an overall in-flight flag, and a single top-level submission error slot. Lives only while the form is mounted.
- **Protected route**: A route in the application whose render is conditional on (a) the presence of a valid session and (b) the signed-in user's role being permitted for that route per the role/route matrix.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with valid credentials can go from a cold app load to the authenticated landing area in **under 5 seconds** on a typical broadband connection, including any one-time session-validation round trip.
- **SC-002**: A new user can complete the registration form and arrive on the authenticated landing area in **under 60 seconds**, measured from first keystroke to first authenticated page paint, assuming valid inputs.
- **SC-003**: After a successful sign-in, **100% of subsequent page refreshes and browser restarts within the session window** require no re-authentication.
- **SC-004**: When a signed-in user opens a route their role cannot access, the dedicated unauthorized page is shown in **100% of cases**, with **zero** occurrences of the login page or a generic error being shown instead.
- **SC-005**: On login or registration failure, **100% of error messages** are either (a) a single generic credential-rejection message (login) or (b) attached to the specific offending field (register). No login error reveals whether the email or the password was the failing factor.
- **SC-006**: Duplicate submissions of an auth form caused by rapid clicks result in **at most one** in-flight request, verified by inspection of network traffic in an end-to-end test.
- **SC-007**: On detection of an expired or backend-rejected session, the user reaches the login page (with the "session ended" notice) in **under 1 second** from the rejecting response, without any flash of protected content.
- **SC-008**: Direct navigation to any protected URL while signed out results in a redirect to login and, after sign-in, a redirect to the originally requested URL, in **100% of tested protected routes**.

## Assumptions

- The authentication backend (`POST /auth/register`, `POST /auth/login`, `GET /auth/me`) specified in `specs/002-auth-jwt-rbac` is the source of truth for credentials, password hashing, token issuance, and role assignment. The frontend does no cryptography of its own beyond reading the token's expiry claim for client-side gating.
- The three roles are exactly `admin`, `manager`, `developer`, matching the backend. The registration form offers exactly these three values.
- **Role/route matrix (initial)**: until subsequent features define their own role rules, all three roles can reach all authenticated pages built so far; the unauthorized page exists and is wired up, but no route is yet restricted to a strict subset of roles. As later features land, each new route will declare its required role(s) and this matrix will be extended; the unauthorized page is the catch-all for any role/route mismatch.
- **Password rules**: minimum 8 characters, at least one letter and one digit. These are client-side hints only; the backend's rules remain authoritative and any rejection it returns is surfaced as a field error.
- **Session persistence**: the session credential lives in the browser's local storage (or equivalent same-origin persistent store) so that a browser restart does not log the user out. Cross-tab consistency is achieved by listening for changes to that store.
- **Token expiry handling**: the frontend treats any 401 from the backend on an authenticated request as a "session ended" event and follows FR-013. It does not implement silent refresh in this slice.
- **Routing**: the application uses a single-page-app client-side router. URLs for login, register, and the unauthorized page are stable and bookmark-safe.
- **Styling**: the existing Tailwind setup in `frontend/` is used. No new design system is introduced.
- **Out of scope for this slice**: password reset / forgot-password flow, email verification, social/SSO login, multi-factor authentication, account settings, and admin user management. Each is a separate feature.
