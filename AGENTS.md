# Agent Instructions

## Project purpose

Build OguLix PaaS, a custom PaaS control plane integrated with the
existing three-VM Debian 12 IAAS environment.

## Agreed stack

- Next.js + TypeScript frontend
- Express.js + TypeScript REST API
- Node.js + TypeScript worker
- MariaDB with Prisma ORM and migrations
- Redis + BullMQ for asynchronous jobs
- Docker Engine and BuildKit
- Traefik reverse proxy
- SSH-based runtime-node management
- Existing Cloudflare Tunnel for ingress

Do not silently replace these choices with Python/FastAPI, PostgreSQL,
Kubernetes, or another stack. Propose an architecture change and obtain
human approval first.

## Infrastructure facts

- Server 1: `server1.ogulix.tech`, `192.168.174.144`
- Server 2: `server2.ogulix.tech`, `192.168.174.145`
- Server 3: `server3.ogulix.tech`, `192.168.174.146`
- All VMs run Debian 12.
- Server 1 has 4 GiB RAM. Server 2 and Server 3 have 2 GiB RAM. All
  three have 2 CPU cores and a 15 GB virtual disk. The 2 GiB figures
  and disk sizes come from the IAAS UTS report; the Server 1 memory
  upgrade is a later approved change recorded in
  `docs/design/decisions.md`.
- Docker is not installed yet.
- Server 1 runs an existing Apache portfolio website on port 80.
- Cloudflare Tunnel currently runs as a Windows service, not assumed
  to run on Server 1.
- Wildcard DNS and wildcard tunnel ingress are not configured.

## Architecture constraints

- Treat the current environment as a constrained academic MVP, not
  production capacity.
- Keep Server 1 services lightweight and measure resource usage before
  adding components. The 4 GiB upgrade raises the ceiling; it does not
  remove the need for preflight measurement, because the existing
  Apache portfolio shares that memory.
- Initial target: Server 1 hosts the lightweight control plane/data
  services and Traefik, only if capacity and port preflight pass;
  Server 2 and Server 3 are runtime nodes.
- Do not host a private OCI registry on Server 1 in the initial MVP.
- Initial builds are serialized and performed on the selected runtime
  node through restricted remote operations/BuildKit. Reassess this if
  build resource contention is observed.
- Do not claim production-grade isolation, high availability,
  autoscaling or cluster scheduling.
- If the control plane cannot fit safely, stop and propose
  resizing/adding infrastructure rather than silently overcommitting
  the VMs.

## Team ownership and collaboration

The five-person team is organized as follows:

- One IAAS/infrastructure member owns Proxmox/VM preparation, Debian hosts, Docker Engine, private networking, runtime-node readiness and server-side Traefik operations.
- Frontend member A owns the dashboard shell, authentication screens and shared UI foundations.
- Frontend member B owns application management, deployment views, logs and monitoring UI.
- One frontend member is additionally the Cloudflare/edge configuration owner. This responsibility covers Cloudflare DNS records, Tunnel public-hostname/ingress additions, and Cloudflare Access policy coordination for the PaaS domains. It does not grant permission to change existing IAAS routes independently.
- Backend member A owns Express API, authentication/authorization, Prisma and MariaDB data access.
- Backend member B owns BullMQ worker, scheduler, BuildKit/Docker deployment adapters and SSH orchestration.

The frontend/Cloudflare owner and IAAS owner must coordinate hostname-to-origin mapping, Traefik listener address/port, tunnel routing, DNS, and regression checks. Cloudflare changes are not performed until the IAAS owner confirms the private origin is ready and the project owner approves the change.

## Mandatory rules

1.  AI agents MUST NOT create Git commits.
2.  AI agents MUST NOT push to remote repositories.
3.  AI agents MUST NOT merge branches or pull requests.
4.  Human team members perform all Git operations.
5.  Never modify or remove the Server 1 Apache portfolio website.
6.  Never bind Traefik to Server 1 port 80 unless a separately approved
    migration plan explicitly allows it.
7.  Never alter existing Cloudflare Tunnel routes, Proxmox
    configuration, SSH access, or IAAS services without explicit
    approval. New PaaS hostnames must be additive and regression-tested.
8.  Never commit `.env`, credentials, private keys, tokens, or generated
    secrets.
9.  Never expose Docker socket/API to the public internet.
10. Never pass unvalidated user input to a shell.
11. Do not use unrestricted root SSH for routine deployment.
12. Apply container CPU, memory, process and storage limits.
13. Enforce user ownership and authorization for every application and
    deployment operation.
14. Protect environment variables and secrets; redact them from logs and
    API responses.
15. Add tests and update relevant documentation for behavior changes.
16. AI agents may draft Cloudflare configuration and checklists, but must not apply changes to the live Cloudflare account, tunnel service, DNS or Access policies unless a human explicitly requests and authorizes the exact action.
17. Do not put Cloudflare Tunnel tokens, API tokens, account identifiers or private credentials in source files, logs, screenshots or documentation. Use placeholders in examples.

## Engineering conventions

- Use TypeScript for frontend, backend and worker.
- Validate API inputs at the boundary.
- Use the agreed conventions in `docs/design/decisions.md`; do not
  re-open a locked decision silently.
- Define the deployment status enum once in `shared/types/` and import
  it everywhere.
- Keep route handlers thin; place business logic in services.
- Keep Prisma access behind repository/data-access modules where
  practical.
- Model deployment as an asynchronous state machine.
- Make deployment jobs idempotent where possible.
- Use structured logs with correlation IDs; never log secrets.
- Add unit tests for business logic and integration tests for
  infrastructure adapters.
- Keep infrastructure-specific operations behind adapters so they can
  be tested with mocks.
- Prefer incremental changes and explain assumptions.
- Do not claim infrastructure operations succeeded unless they were
  actually executed and verified.

## Git workflow

Agents may inspect repository state and propose commit messages, but
must leave all changes uncommitted. At the end of a task, summarize
changed files, tests run, outstanding risks, and suggested commit
message(s) for a human to execute.

## Scaffold milestone rule

When asked to initialize the repository, follow `docs/implementation/initialization-blueprint.md` exactly. Treat that task as scaffold-only: create folders, project configuration, minimal entry points, shared contracts and a locally validated Prisma schema. Do not implement full product features, connect to live IAAS, apply Cloudflare changes, run remote migrations, or proceed beyond scaffolding without a new human instruction. Report assumptions and wait for human review.
