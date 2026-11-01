# Repository Initialization Blueprint

## 1. Purpose

This document tells an AI coding agent how to create the initial repository files and folders from the architecture documentation. This is a scaffold-only milestone. It is not authorization to implement the full product or connect to live infrastructure.

## 2. Required initial repository tree

```text
paas-platform/
├── frontend/
├── backend/
├── worker/
├── shared/
│   ├── contracts/
│   └── types/
├── infrastructure/
│   ├── docker/
│   ├── traefik/
│   ├── cloudflare/
│   └── scripts/
├── database/
│   └── README.md
├── tests/
├── docs/
│   ├── architecture/
│   ├── design/
│   ├── implementation/
│   ├── operations/
│   └── testing/
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── AGENTS.md
```

The `docs/` folder must contain the supplied project documentation. Do not replace it with generated summaries.

One approved deviation: Prisma requires its schema and migrations directory to stay together, so
they live at `backend/prisma/{schema.prisma,migrations/}`. Root `database/` holds a pointer README
plus seed and backup notes instead of a second copy of the migrations. This was approved in
`docs/design/decisions.md`.

## 3. Initialization tasks

1. Inspect all documentation and report contradictions or missing decisions before generating files.
2. Create the root directory structure and workspace configuration.
3. Initialize `frontend/` as Next.js + TypeScript using the currently supported stable setup, without selecting extra UI libraries unless approved.
4. Initialize `backend/` as Express.js + TypeScript.
5. Initialize `worker/` as Node.js + TypeScript.
6. Create shared TypeScript contracts for API envelopes and deployment status values, matching the docs.
7. Add the Prisma schema skeleton at `backend/prisma/schema.prisma` for MariaDB based on the ERD,
   including `Session` and `DeploymentLog`. Do not run migrations against any remote database.
8. Add local-only Docker Compose development services for MariaDB and Redis if requested/approved. Never target IAAS VMs from local compose.
9. Add `.env.example` with placeholder names only; no real credentials.
10. Add root scripts for install, typecheck, lint and tests where supported.
11. Add a short scaffold report listing created files, decisions made, commands run and items awaiting human confirmation.

## 4. Explicitly out of scope for initialization

- No production deployment.
- No SSH connection to Server 1, Server 2 or Server 3.
- No Docker installation or host configuration on IAAS.
- No Cloudflare API calls or live DNS/Tunnel/Access changes.
- No database migration against a remote database.
- No real authentication or deployment execution implementation.
- No arbitrary scripts that execute user-provided shell commands.
- No Git commit, push, branch merge or pull request merge.

## 5. Decisions

All items below were resolved before scaffolding. The authoritative record is
`docs/design/decisions.md`; do not re-open a resolved item here.

| Decision | Outcome |
|---|---|
| Package manager and workspace strategy | npm workspaces, Node.js 22 LTS |
| UI component library and styling system | Tailwind only in the scaffold; component library deferred to Frontend 1 |
| Form validation library | Shared Zod schemas, same as the API |
| Authentication/session strategy and lifetime | Opaque session cookie, 7 days absolute, 24 hours idle |
| API validation library | Zod |
| Prisma version and provider details | Prisma pinned against MariaDB 11.4; enums verified by one migration |
| Shared package build/import strategy | `shared/` is a workspace package consumed by all three apps |
| Environment-variable encryption key management | AES-256-GCM, key from `ENV_ENCRYPTION_KEY` outside the database |
| Runtime-node restricted command/helper protocol | SSH forced command with a fixed verb allowlist |
| Whether user registration is open | `REGISTRATION_MODE`, default `closed` |

Still awaiting a human decision, and not blocking the scaffold:

- Exact Traefik listener IP/port and Cloudflare origin mapping (IAAS and Cloudflare owner).
- UI component library and design system (Frontend 1).
- Measured Server 1 memory budget per service (IAAS).

## 6. Completion criteria

The scaffold milestone is complete when:
- The documented directory tree exists.
- Each app has a minimal start script and health/readiness placeholder where appropriate.
- TypeScript configuration is valid.
- Shared contracts compile.
- Prisma schema validates locally against the selected MariaDB provider.
- No real secrets are present.
- No live infrastructure has been changed.
- No Git operation has been performed by the AI agent.
- A human-readable initialization report is provided.

## 7. Required agent output

At the end, the agent must summarize:
- Files and folders created.
- Dependency versions and package manager selected.
- Commands executed and their results.
- Any assumptions or deviations from the docs.
- Tests/typechecks run.
- Items requiring human approval.

Do not silently continue into feature implementation after the scaffold is complete.
