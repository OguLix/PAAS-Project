# Frontend Architecture

## 1. Purpose and decisions

Frontend is a Next.js + TypeScript application. It is a presentation layer and API client; it must not access MariaDB, Redis, Docker, SSH or Cloudflare credentials directly.

Use the Next.js App Router. Prefer server components for static/data-display composition where appropriate, and client components only for interactive state. Use one agreed API client module rather than scattering `fetch` calls across pages.

The exact UI component library and design system are intentionally not locked by this architecture
document. Frontend 1 selects them before feature UI work and records the choice here; that decision
does not block repository scaffolding. Form validation and API validation share the same Zod schemas
in `shared/`, so the form library may not introduce a second schema dialect.

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

## 4. Frontend service and type contracts

- `lib/api-client.ts`: base URL, JSON handling, `credentials: 'include'` cookie session, normalized API errors.
- `services/*.api.ts`: endpoint-specific calls grouped by feature.
- `types/api.ts`: common API envelope and pagination types.
- `features/*/types.ts`: feature-specific view and form types.
- `hooks/`: reusable client-side behavior, not business rules that belong to the backend.

Do not create a second independent copy of backend DTO definitions manually if a shared package or generated OpenAPI types are later adopted. Until then, mirror the documented API contract and test compatibility.

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
