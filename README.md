# OguLix PaaS

Custom Platform-as-a-Service built on the existing OguLix IAAS
environment

## Project status

Architecture and preparation stage. The documents describe the agreed
target design; they do not claim that services have already been
installed or deployed.

## Agreed stack

- Frontend: Next.js + TypeScript
- Backend: Express.js + TypeScript
- Runtime: Node.js
- ORM: Prisma
- Database: MariaDB
- Queue: Redis + BullMQ
- Worker: Node.js + TypeScript
- Container runtime: Docker Engine
- Image build: Docker BuildKit
- Reverse proxy: Traefik
- Infrastructure access: SSH
- Public ingress: existing Cloudflare Tunnel

## Existing IAAS capacity

Server 2 and Server 3 match the IAAS UTS report: 2 GiB RAM, 2 CPU cores and a 15 GB virtual disk
each. Server 1 was later upgraded to 4 GiB RAM and keeps 2 CPU cores and the same 15 GB disk. The
Proxmox host itself runs as a nested VM, so resource headroom must be considered before adding
services.

---

Host Address Memory / role

---

Server 1 192.168.174.144 4 GiB; existing Apache
portfolio plus proposed
lightweight
control-plane and
ingress host, subject
to capacity test

Server 2 192.168.174.145 2 GiB; proposed runtime
node 1

Server 3 192.168.174.146 2 GiB; proposed runtime
node 2
-----------------------------------------------------------------------

Docker is not installed yet.

## Important architecture constraint

The VMs are suitable for a constrained academic MVP, not a production-grade multi-tenant PaaS. The
Server 1 memory upgrade makes the control-plane role realistic, but Apache shares that memory. The
initial design should:

- Measure memory/disk usage before and after each Server 1 service.
- Build one application at a time on the selected runtime node using restricted SSH operations.
- Defer hosting a private OCI registry.
- Limit application container resources and concurrent deployments.
- Revisit a private registry, more build workers and stronger monitoring after capacity is increased.

## Domains

- `server1.ogulix.tech`: existing portfolio website; preserve as-is.
- `pve.ogulix.tech`: existing Proxmox interface; preserve its current
  protection.
- `paas.ogulix.tech`: proposed PAAS dashboard.
- `*.apps.ogulix.tech`: proposed deployed application hostnames.

Wildcard DNS and corresponding Cloudflare Tunnel ingress rules are not
configured yet. The tunnel connector currently runs as a Windows
service.

## Team structure and ownership

The project is handled by five people: one IAAS/infrastructure member, two frontend members, and two backend members. One of the frontend members also owns Cloudflare edge configuration and coordinates it with the IAAS member. This is a cross-cutting responsibility, not a replacement for the IAAS role. See [team responsibilities](docs/operations/team-responsibilities.md).

## Documentation

### Architecture and implementation design

- `docs/architecture/frontend-architecture.md`
- `docs/architecture/backend-architecture.md`
- `docs/architecture/worker-architecture.md`
- `docs/architecture/deployment-state-machine.md`
- `docs/design/decisions.md`
- `docs/design/class-design.md`
- `docs/design/database-erd.md`
- `docs/design/api-contract.md`
- `docs/testing/testing-architecture.md`
- `docs/implementation/initialization-blueprint.md`
- `docs/implementation/scaffold-report.md`

- `docs/architecture/system-overview.md`
- `docs/architecture/infrastructure-topology.md`
- `docs/architecture/deployment-architecture.md`
- `docs/design/database-design.md`
- `docs/design/api-design.md`
- `docs/operations/server-preparation.md`
- `docs/operations/ssh-configuration.md`
- `docs/operations/deployment-guide.md`
- `docs/operations/cloudflare-operations.md`
- `docs/operations/team-responsibilities.md`
- `docs/testing/test-plan.md`
- `AGENTS.md`

## Implementation status

- [x] Stack and constrained-MVP architecture documented
- [x] Design decisions locked and contradictions reconciled in `docs/design/decisions.md`
- [x] Repository scaffold initialized from `docs/implementation/initialization-blueprint.md` (see `docs/implementation/scaffold-report.md`)
- [ ] Server capacity and port preflight (Server 1 memory measured against the 4 GiB budget)
- [ ] Docker installed on runtime nodes
- [ ] Control-plane services deployed and measured
- [ ] Remote build/deployment pipeline implemented
- [ ] Wildcard DNS and tunnel ingress configured
- [ ] End-to-end tests passed

## Safety boundaries

- Do not modify the existing Apache portfolio website.
- Do not change Proxmox or existing Cloudflare Tunnel routes without
  explicit approval.
- Never expose the Docker API/socket publicly.
- Never execute arbitrary shell commands supplied by users.
- Use dedicated, restricted deployment credentials.
- Keep secrets out of source control and logs.
- AI agents must not commit, push, or merge. Human team members own
  all Git operations.
