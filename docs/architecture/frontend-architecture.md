# Frontend Architecture

## 1. Purpose and decisions

Frontend is a Next.js + TypeScript application. It is a presentation layer and API client; it must not access MariaDB, Redis, Docker, SSH or Cloudflare credentials directly.

Use the Next.js App Router. Prefer server components for static/data-display composition where appropriate, and client components only for interactive state. Use one agreed API client module rather than scattering `fetch` calls across pages.

### 1.1 Recorded UI decisions (Frontend 1, 2026-11-01)

| Item | Decision | Reason |
|---|---|---|
| Component approach | shadcn/ui style primitives: Radix behaviour plus Tailwind classes copied into `components/ui` | No runtime design library to keep current, accessible behaviour from Radix, no extra styling layer |
| Styling | Tailwind CSS v4 with tokens in `globals.css` under `@theme` | One token source, and components never hold raw hex values |
| Direction source | `DESIGN.md` at the repository root | Owner-authored palette, typography and dials |
| Theme | Light only | `DESIGN.md` excludes dark backgrounds, and an unverified second theme is worse than one verified theme |
| Icons | `lucide-react`, only for functional controls (chevron, sign out) | A decorative icon per feature would be the generic default this project rejects |
| Navigation placement | Sidebar, with the existing top bar retained for account controls | The sidebar is the primary dashboard navigation and scales to applications, deployments, nodes and settings. The top bar is not the navigation source |

Form validation and API validation must converge on the same Zod schemas in `shared/` as soon as that
package carries the corresponding contract. Until then the authentication form schemas live in
`frontend/src/features/auth/schema.ts` and are expected to match the API rather than define it.

## 2. Proposed directory structure

```text
frontend/
├── public/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── applications/page.tsx
│   │   │   ├── applications/[applicationId]/page.tsx
│   │   │   ├── deployments/[deploymentId]/page.tsx
│   │   │   ├── nodes/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   └── feedback/
│   ├── features/
│   │   ├── auth/
│   │   ├── applications/
│   │   ├── deployments/
│   │   ├── nodes/
│   │   └── domains/
│   ├── hooks/
│   ├── lib/
│   │   ├── api-client.ts
│   │   ├── auth.ts
│   │   └── env.ts
│   ├── services/
│   └── types/
├── .env.example
└── package.json
```

## 3. Component responsibilities

| Area | Main components | Responsibility |
|---|---|---|
| `app/` | route pages, layouts | URL routing, page composition, route-level loading/error boundaries |
| `components/ui/` | Button, Input, Dialog, Badge, Table | Reusable visual primitives; no domain-specific API calls |
| `components/layout/` | Sidebar, Topbar, DashboardShell | Shared dashboard layout and navigation |
| `features/auth/` | LoginForm, RegisterForm, UserMenu | Authentication user interactions |
| `features/applications/` | ApplicationTable, ApplicationForm, ApplicationCard | Application CRUD UI |
| `features/deployments/` | DeployForm, DeploymentTimeline, DeploymentStatus, LogViewer | Deployment lifecycle UI |
| `features/nodes/` | NodeTable, NodeHealthBadge | Read-only node status display |
| `features/domains/` | DomainForm, DomainList | Domain association UI |

Keep components focused. A component should not duplicate authorization rules; the backend is authoritative.

### 3.1 Implemented after the shell milestone

The tree in section 2 is the target. Current implementation status:

| Path | State |
|---|---|
| `app/page.tsx` | Redirects to `/dashboard`; the guard handles anonymous visitors |
| `app/not-found.tsx` | Styled 404 with a real link back |
| `app/(auth)/layout.tsx`, `(auth)/login`, `(auth)/register` | Implemented |
| `app/(dashboard)/layout.tsx`, `(dashboard)/dashboard` | Implemented |
| `components/ui/` | button, input, label, field, alert, card, skeleton |
| `components/layout/` | topbar, user-menu, nav-items, dashboard-shell (sidebar is the agreed target, not yet implemented) |
| `components/feedback/` | loading-state, empty-state, error-state |
| `features/auth/` | schema, login-form, register-form, session-store, session-guard |
| `services/` | `auth.api.ts`, `auth.types.ts`, `mock/auth.mock.ts` (test fixture only) |
| `app/(dashboard)/applications/` | Application list, create, detail, edit, archive and deployment request |
| `app/(dashboard)/deployments/` | Deployment status, automatic polling, timestamps and bounded logs |
| `features/applications/`, `features/deployments/` | Forms, lifecycle status badge, history and monitoring availability state |
| `services/applications.api.ts`, `services/deployments.api.ts` | Application and deployment API calls through the shared client |
| `nodes`, `domains`, `settings` | Not started |

`hooks/`, `types/` and `lib/env.ts`, `lib/auth.ts` in the target tree were not needed: shared types come
from `@ogulix/shared`, and session state is a single module in `features/auth/session-store.ts`.

The application metrics UI intentionally reports that telemetry is unavailable: the current API
contract defines no application metrics endpoint. Deployment creation/history, deployment detail
and logs use the documented contract, but those backend routes still need to be implemented before
the end-to-end lifecycle can work.

## 4. Frontend service and type contracts

- `lib/api-client.ts`: base URL, JSON handling, `credentials: 'include'` cookie session, normalized API errors.
- `services/*.api.ts`: endpoint-specific calls grouped by feature.
- `types/api.ts`: common API envelope and pagination types.
- `features/*/types.ts`: feature-specific view and form types.
- `hooks/`: reusable client-side behavior, not business rules that belong to the backend.

Do not create a second independent copy of backend DTO definitions. `@ogulix/shared` is now the
source of truth for API DTOs and pure state helpers; feature-specific types re-export or extend it.
The frontend must import only the browser-safe root export, never `@ogulix/shared/server/*`.

## 5. Authentication and authorization

The frontend may hide controls based on the current user's role for usability, but every protected operation must still be authorized by the API. Never store database credentials, SSH keys, Cloudflare tokens or deployment secrets in frontend code or browser storage.

Authentication uses the opaque `ogulix_session` cookie, which is `HttpOnly`, so browser JavaScript
cannot read it. The API client sends requests with `credentials: 'include'` against the same origin
and never touches the token. There is no access token and no refresh token to manage in the browser,
and no token may be stored in `localStorage` or `sessionStorage`.

Deployment status is polled from the deployment resource; the MVP has no streaming or websocket
channel. Stop polling when the deployment reaches a terminal status.

## 6. Feature ownership

- Frontend member A: dashboard shell, navigation, authentication screens, shared UI primitives.
- Frontend member B: applications, deployments, logs, node status and domain screens.
- Cloudflare owner is one of the frontend members and additionally owns approved public DNS/Tunnel/Access configuration. Cloudflare configuration is not implemented as browser-side application code.

## 7. Acceptance criteria

- All pages use the shared API client.
- Loading, empty, validation and API-error states are represented.
- Forms validate for usability and backend validation remains authoritative.
- No secrets are shipped to the browser.
- Application and deployment pages enforce ownership through backend responses.
- UI status labels map exactly to `deployment-state-machine.md`.
- Monitoring never shows fabricated values when a metrics endpoint is unavailable.

## 8. Authentication contract gap

`docs/design/api-contract.md` lists `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` and
`GET /auth/me`, and fixes the response envelope, but it does not define their request or response
bodies. The frontend currently assumes:

```ts
type AuthUser = { id: string; email: string; role: "USER" | "ADMIN" };
type MeResponse = { user: AuthUser };
type LoginInput = { email: string; password: string };
```

Those assumptions are isolated in `services/auth.types.ts` so a single edit corrects every caller.
Backend 1 owns the final shapes; when they are published, update that file and this section together.

Two behaviours follow from the contract as written and are implemented as such:

- A `401` from `POST /auth/login` means the credentials were rejected, not that a session expired. It
  gets its own message.
- A `403 REGISTRATION_CLOSED` from `POST /auth/register` is a normal outcome while `REGISTRATION_MODE`
  is `closed`, so the form reports it directly instead of a generic failure.

## 9. Authentication data source

The dashboard always calls the real Express API through `services/auth.api.ts`. There is no mock mode
and no automatic fallback, so a backend that is down is reported as a connection error instead of
being hidden behind simulated data.

`services/mock/auth.mock.ts` is kept only as an explicit fixture: a test may import `mockAuthApi`
directly. No application module imports it, so it can never become the runtime data source. It keeps
no data in browser storage.

## 10. Session state

`features/auth/session-store.ts` mirrors what `GET /auth/me` reported and exposes it through
`useSyncExternalStore`. Nothing is written to `localStorage` or `sessionStorage`, and the cookie stays
unreadable to JavaScript.

`features/auth/session-guard.tsx` keeps anonymous visitors out of the dashboard, and it distinguishes
three outcomes:

| `GET /auth/me` result | UI |
|---|---|
| User | Render the dashboard |
| `401` or `403` | Redirect to `/login?next=<path>` |
| Network or server failure | Retryable error state, never a redirect |

The guard is a usability measure. Every protected operation is still authorized by the API.

## 11. Frontend tests

Component tests live beside the feature in `src/features/**/__tests__` and run with the package's own
runner:

```bash
npm run test --workspace @ogulix/frontend
```

Vitest with `jsdom` and Testing Library covers form validation, error mapping and the redirect after a
successful submit. API calls are mocked at the service module, so no test needs a server or a database.
The root `npm test` script also runs this suite.
