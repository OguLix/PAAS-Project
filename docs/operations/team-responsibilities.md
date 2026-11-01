# Team Responsibilities

## 1. Team composition

OguLix PaaS is developed by five people: one IAAS/infrastructure member, two frontend members and two backend members. The frontend member assigned to Cloudflare also has a cross-cutting edge/integration responsibility.

| Role | Primary ownership | Main deliverables |
|---|---|---|
| IAAS / Infrastructure (1 person) | Proxmox and Debian VM readiness, Docker Engine, private network, runtime nodes, server-side Traefik readiness | Prepared and measured servers, restricted SSH deployment access, runtime node connectivity, Traefik origin endpoint |
| Frontend 1 | Dashboard foundation and account experience | Next.js app shell, navigation, authentication UI, shared components and design system |
| Frontend 2 | Application lifecycle UI | Application list/detail, create/edit forms, deploy action, deployment status/history, logs and monitoring views |
| Backend 1 | Core platform API and persistence | Express API, authentication/authorization, validation, Prisma schema/migrations, MariaDB repositories, application/domain metadata |
| Backend 2 | Deployment execution | BullMQ queues, worker, scheduler, BuildKit/Docker adapter, SSH orchestration, container lifecycle and deployment state updates |

## 2. Cross-cutting assignment: Frontend + Cloudflare

The frontend member who owns Cloudflare should be described as **Frontend Engineer & Cloudflare/Edge Infrastructure Engineer**. Frontend remains the primary development role; Cloudflare is an additional integration/operations responsibility.

Responsibilities:

- Build and maintain assigned Next.js dashboard features.
- Integrate frontend pages with the agreed Express API contract.
- Manage the proposed public DNS records for `paas.ogulix.tech` and `*.apps.ogulix.tech`.
- Add new public-hostname/ingress rules to the existing Cloudflare Tunnel only after the IAAS member confirms the origin is ready.
- Coordinate Cloudflare Access policy for the PaaS dashboard if access protection is required.
- Verify public hostname resolution and end-to-end access after an approved change.
- Keep existing portfolio, Proxmox and SSH hostnames/routes unchanged.
- Document every Cloudflare change, its purpose, test result and rollback procedure.

This role does not own Proxmox, VM sizing, Debian host administration, Docker installation or the server-side Traefik process. Those remain with the IAAS member.

## 3. Responsibility boundaries

| Concern | Owner | Collaborators |
|---|---|---|
| VM sizing, Proxmox, Debian OS | IAAS | Project team as needed |
| Docker Engine on Server 2/3 | IAAS | Backend 2 |
| Runtime-node SSH account and access boundary | IAAS | Backend 2 |
| Build/deploy logic and scheduler | Backend 2 | IAAS |
| REST API and database schema | Backend 1 | Frontend members |
| API contract and frontend integration | Backend 1 + Frontend | Both agree before implementation |
| Traefik process/listener and file-provider origin config | IAAS | Backend 2, Cloudflare owner |
| Cloudflare DNS and Tunnel ingress additions | Frontend + Cloudflare owner | IAAS must confirm origin readiness |
| Cloudflare Access for PaaS dashboard | Frontend + Cloudflare owner | IAAS/project owner |
| End-to-end public routing test | Shared | IAAS, Cloudflare owner, Backend 2 |

## 4. Required integration contracts

Before implementation, agree on and document:

1. Dashboard origin: exact private IP and Traefik listener port for `paas.ogulix.tech`.
2. App origin: exact private IP and listener port for `*.apps.ogulix.tech`.
3. Traefik routing model: wildcard host matching and per-app backend target (runtime-node private IP plus allocated host port).
4. Cloudflare Tunnel connector: existing Windows service and its configuration ownership.
5. API contract: endpoints, request/response types, authentication behavior and deployment status model.
6. Rollback: remove only the newly added PaaS DNS/ingress entries if validation fails; do not disturb existing routes.

Never guess an origin port or claim it is available. IAAS must verify it on the host first.

## 5. Collaboration workflow

- Frontend and backend agree on API schemas before wiring pages to endpoints.
- Backend 2 and IAAS agree on the restricted SSH operations and node command contract.
- IAAS provides a verified Traefik origin endpoint before Cloudflare changes are made.
- Cloudflare owner prepares a change plan and regression checklist; a human applies the live change.
- Every member tests their component and updates relevant docs.
- AI agents may create or edit code/docs and suggest commit messages, but must never commit, push or merge. Human team members perform Git operations.

## 6. Suggested ownership of files

This is a starting point; the team can adjust it through agreement.

- `frontend/`: Frontend 1 and Frontend 2, with clear feature ownership.
- `backend/`: Backend 1.
- `worker/`: Backend 2.
- `infrastructure/`: IAAS owns host-level configuration; Cloudflare owner maintains documented Cloudflare configuration templates/checklists with IAAS review.
- `docs/`: each owner updates docs for their changes; one person coordinates consistency.
