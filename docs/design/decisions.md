# Design Decisions

Status: approved before scaffold.
Decided: 2026-11-01.
Owner of this document: project owner, with Backend 1 responsible for the API contract section.

## 1. How to use this document

The architecture documents describe intent. Where two documents disagreed, this record states
which rule wins. Implementation must follow this document; if a change is required, propose it and
record the new decision here before writing code. Do not re-open a decision silently in a pull
request.

Nothing here authorizes changes to live infrastructure. Server access, Traefik ports and Cloudflare
configuration remain gated by the checks in `docs/operations/`.

## 2. Capacity change: Server 1 memory

The IAAS UTS report documents 2 GiB RAM, 2 CPU cores and a 15 GB disk for each of the three VMs.
That report is now outdated for one host.

| Host | Memory | CPU | Disk | Source of truth |
|---|---|---|---|---|
| Server 1 (`192.168.174.144`) | 4 GiB | 2 cores | 15 GB | Approved change, 2026-11-01 |
| Server 2 (`192.168.174.145`) | 2 GiB | 2 cores | 15 GB | IAAS UTS report |
| Server 3 (`192.168.174.146`) | 2 GiB | 2 cores | 15 GB | IAAS UTS report |

Consequences:

- The Server 1 memory upgrade makes the control-plane role plausible instead of marginal. It does
  not make the host generous: the existing Apache portfolio shares the same 4 GiB, and the Proxmox
  host runs as a nested VM with its own finite allocation.
- Capacity preflight is still mandatory. Measure `free -m`, disk usage and listening ports before
  and after each control-plane service is added.
- The upgrade does not authorize hosting a private OCI registry, running application builds, or
  running application containers on Server 1.
- If measured headroom is unsafe, stop and request more capacity instead of overcommitting.

## 3. API contract

### 3.1 Single source of truth

`docs/design/api-contract.md` is the normative contract. `docs/design/api-design.md` is narrative
background and must not be used as an implementation reference. Where they differ, the contract
wins.

### 3.2 Final MVP endpoint surface

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | Only when `REGISTRATION_MODE=open`; otherwise `403`. |
| POST | `/auth/login` | Sets the session cookie. |
| POST | `/auth/logout` | Revokes the current session. |
| GET | `/auth/me` | Current user and role. |
| GET | `/applications` | Owned applications. |
| POST | `/applications` | Create application. |
| GET | `/applications/:applicationId` | Includes `currentDeploymentId`. |
| PATCH | `/applications/:applicationId` | Update owned application. |
| DELETE | `/applications/:applicationId` | Archive, not hard delete. |
| GET | `/applications/:applicationId/deployments` | Deployment history. |
| POST | `/applications/:applicationId/deployments` | `202 Accepted`. |
| GET | `/deployments/:deploymentId` | Deployment status. |
| POST | `/deployments/:deploymentId/cancel` | Only `QUEUED`. |
| POST | `/deployments/:deploymentId/stop` | Running deployment only. |
| POST | `/deployments/:deploymentId/restart` | `RUNNING` or `STOPPED`; means "ensure this deployment's container is running". |
| GET | `/applications/:applicationId/logs` | Bounded, redacted build logs. |
| GET | `/nodes` | Runtime node inventory and last-known capacity. |
| GET | `/applications/:applicationId/domains` | List domains. |
| POST | `/applications/:applicationId/domains` | Associate hostname. |
| DELETE | `/domains/:domainId` | Disable association. |
| GET | `/applications/:applicationId/env` | Names only, never values. |
| PUT | `/applications/:applicationId/env/:key` | Create or update encrypted value. |
| DELETE | `/applications/:applicationId/env/:key` | Delete variable. |

Removed from the MVP surface:

- `POST /auth/refresh`. The session model is a server-side cookie, so there is no refresh token.
- `POST /applications/:id/actions/{start,stop,restart}`. Lifecycle actions stay deployment-scoped
  so history is never rewritten implicitly. `restart` covers the "start" case.
- `GET /nodes/:id/metrics`. `/nodes` already returns the last-known capacity snapshot, and no
  consumer needs per-node live metrics in the MVP.

`currentDeploymentId` is derived from the newest deployment whose status is `RUNNING`. It is not a
stored column, so the deployment table stays the only source of lifecycle truth.

### 3.3 Canonical deployment status values

The ten statuses in `docs/architecture/deployment-state-machine.md` are final:
`QUEUED`, `PREPARING`, `BUILDING`, `STARTING`, `HEALTH_CHECKING`, `RUNNING`, `STOPPING`, `STOPPED`,
`FAILED`, `CANCELLED`.

The earlier sequence `QUEUED -> BUILDING -> DEPLOYING -> HEALTH_CHECKING -> SUCCEEDED` in
`deployment-architecture.md` is withdrawn. `DEPLOYING` and `SUCCEEDED` do not exist.

The enum is defined once in `shared/types/` and imported by backend, worker and frontend. No module
may redeclare it.

## 4. Data model

| ID | Decision | Reason |
|---|---|---|
| B1 | TypeScript and API JSON use `camelCase`. Database columns use `snake_case` via Prisma `@map`/`@@map`. | One naming rule per layer, no case-translation code. |
| B2 | Prisma schema and migrations live in `backend/prisma/{schema.prisma,migrations/}`. Root `database/` becomes a pointer with seed and backup notes. | Prisma requires the schema and its migrations directory to stay together. This is an approved deviation from `initialization-blueprint.md`. |
| B3 | Use Prisma `enum` for `UserRole`, `ApplicationStatus`, `NodeStatus`, `DeploymentStatus`, `DomainStatus`. Verify with `prisma validate` plus one migration against a throwaway local MariaDB 11.4 container. | Type safety and a database-level constraint. |
| B3a | Fallback if B3 fails on the chosen Prisma/MariaDB combination: validated string columns plus a Zod enum exported from `shared/types/`. | Keep a documented escape hatch instead of blocking the scaffold. |
| B4 | `Deployment` stores both `imageReference` (node-local tag) and `imageDigest` (immutable). Neither is returned by the API in the MVP. | Rollback needs the reference; audit needs the digest. Exposing them leaks private topology. |
| B5 | Add `Session` and `DeploymentLog` tables. `AuditEvent.actorUserId` is nullable. | Sessions must be revocable; logs need a bounded home; failed logins have no actor. |
| B6 | `Deployment.allocatedPort` is unique per `(runtimeNodeId, allocatedPort)` while active. Allocation range per node is `30000-32767`. | Prevents two containers claiming the same host port. |
| B7 | `Deployment.idempotencyKey` with a unique `(applicationId, idempotencyKey)` constraint. Repeating a request returns the existing deployment. | A double-click must not create two releases. |

`Session` stores only a hash of the token. `DeploymentLog` stores redacted text only.

### 4.1 Prisma 7 specifics

Prisma 7 removed the connection URL from `schema.prisma` and requires a driver adapter for the
client:

- `datasource db { provider = "mysql" }` only; there is no `url` attribute.
- The connection URL lives in `backend/prisma.config.ts`, read from `DATABASE_URL`. The datasource is
  optional there so `prisma validate` works without a database, but migration and introspection
  commands require it.
- Instantiating `PrismaClient` requires a driver adapter. When the first repository is implemented,
  add `@prisma/adapter-mariadb` with the `mariadb` driver instead of relying on a URL-only
  constructor.
- The scaffold does not instantiate a client, so this is a wiring requirement for the first
  data-access milestone, not a runtime dependency today.

## 5. Logging

| Kind | Storage | Limit |
|---|---|---|
| Build log | `DeploymentLog` in MariaDB, redacted before insert | 2000 lines or 200 KB per deployment, paginated by the API |
| Runtime container log | Not persisted. Fetched on demand over SSH with `--tail` and `--since` bounds. | Hard cap per request, no full-history dump |
| Application audit | `AuditEvent` | 180 days |

Rationale: build output is produced on Server 2/3 but must be readable through the Server 1 API, so
it has to be shipped and bounded. Container logs are high-volume and would exhaust a 15 GB disk.

## 6. Authentication

| ID | Decision |
|---|---|
| D1 | Opaque session cookie named `ogulix_session`: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. A 32-byte random token is stored in `Session` as a SHA-256 hash. No JWT, no refresh token. |
| D2 | Passwords hashed with Argon2id. |
| D3 | Registration controlled by `REGISTRATION_MODE` (`open` or `closed`), default `closed`. The endpoint exists in both modes and returns `403` when closed. |
| D4 | Session lifetime: 7 days absolute, 24 hours idle timeout. |
| D5 | CSRF defense: `SameSite=Lax` plus an `Origin`/`Sec-Fetch-Site` check on every state-changing request. |
| D6 | Secrets for environment variables are encrypted with AES-256-GCM. The key comes from `ENV_ENCRYPTION_KEY` (base64, 32 bytes) and never enters the database or repository. Ciphertext is stored as `v1:<iv>:<tag>:<ciphertext>` so a key version can be rotated later. |

Public repositories only in the MVP. No Git credentials are stored: only `https://` URLs without
embedded user info are accepted, and `ssh://`, `git://`, `file://` and credentialed URLs are
rejected at validation.

## 7. Runtime nodes and routing

| ID | Decision |
|---|---|
| E1 | Traefik splits traffic on one origin: `/api/*` to the Express API (`:3001`), everything else to Next.js (`:3000`). Both are internal listeners; Traefik is the only exposed entry point. |
| E2 | Node control uses an SSH forced command. Each runtime node's `authorized_keys` entry pins `command="/usr/local/bin/ogulix-node"`, so the key can never open a shell. The helper accepts a verb plus JSON on stdin. |
| E2a | Allowed verbs: `node-info`, `build`, `container-upsert`, `container-start`, `container-stop`, `container-inspect`, `container-remove`, `logs`, `cleanup`. Nothing else is executable. |
| E2b | The request/response shape lives in `shared/contracts/node-protocol.ts`. Authentication of the caller is the SSH key; authorization is the verb allowlist plus validated arguments. |
| E3 | Traefik listener port and origin reachability from the Windows tunnel host remain unverified. The `8080` example is a placeholder only, and no Cloudflare change happens before IAAS confirms the origin. |

Traefik runs on Server 1, which is also where the worker runs, so route files are written locally and
atomically. Route changes are not a node operation. Cloudflare DNS/Tunnel setup is never performed
by the API.

## 8. Tooling

- Package manager: `npm` with workspaces. No pnpm, no Turborepo.
- Runtime: Node.js 22 LTS, pinned in `engines` and `.nvmrc`.
- Language: TypeScript with `strict: true` everywhere.
- Validation: Zod, shared by the API boundary and client-side forms, so one schema serves both.
- Styling: Tailwind CSS only. No component library in the scaffold.
- Tests: Vitest.
- Lint and format: ESLint plus Prettier.
- Shared code: `shared/` is a workspace package consumed by backend, worker and frontend.

## 9. Runtime defaults

| Setting | Value |
|---|---|
| Container CPU | 0.5 core |
| Container memory | 512 MiB |
| Container PID limit | 100 |
| Restart policy | `unless-stopped` |
| Privileges | Not privileged, no host network, no Docker socket mount, `no-new-privileges` |
| Build timeout | 10 minutes |
| Build cache ceiling | 1 GiB per node |
| Concurrent builds | 1 |
| Application host ports | `30000-32767`, bound to the node's private address |
| Deployment log retention | 30 days, capped per Section 5 |
| Audit retention | 180 days |

Cluster follow-up, not MVP: dropping additional Linux capabilities and running a read-only root
filesystem, because both can break ordinary application images.

## 10. Deferred decisions

| Item | Owner | Blocking |
|---|---|---|
| UI component library and design system | Frontend 1 | Feature UI work, not the scaffold |
| Traefik listener address and port; origin reachability from the Windows tunnel host | IAAS with Cloudflare owner | Any Cloudflare change |
| Measured Server 1 memory budget per service | IAAS | Enabling control-plane services on Server 1 |
| Whether deployed application hostnames need Cloudflare Access | Cloudflare owner with project owner | Public app routing |

## 11. Change log

| Date | Change | Approved by |
|---|---|---|
| 2026-11-01 | Initial decision record created; Server 1 memory raised to 4 GiB; API, data model, logging, auth, routing and tooling decisions locked | Project owner |
