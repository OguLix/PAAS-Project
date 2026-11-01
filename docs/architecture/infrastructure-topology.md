# Infrastructure Topology

## 1. Existing IAAS

The IAAS consists of Proxmox VE and three Debian 12 virtual machines.

  -----------------------------------------------------------------------
  Component               Address / hostname      Existing role
  ----------------------- ----------------------- -----------------------
  Proxmox VE              `192.168.174.10`,       VM and infrastructure
                          `pve.ogulix.tech`       management

  Server 1                `192.168.174.144`,      Existing Apache
                          `server1.ogulix.tech`   portfolio and SSH

  Server 2                `192.168.174.145`,      SSH; proposed runtime
                          `server2.ogulix.tech`   node 1

  Server 3                `192.168.174.146`,      SSH; proposed runtime
                          `server3.ogulix.tech`   node 2
  -----------------------------------------------------------------------

## 2. VM specifications

Table 2.3 of the IAAS UTS report documents the original clone
configuration. Server 1 has since been upgraded and no longer matches
Server 2 and Server 3.

  -----------------------------------------------------------------------
  Resource                     Server 1        Server 2 and Server 3
  ---------------------------- --------------- ------------------------
  Memory                       4.00 GiB        2.00 GiB

  Processor                    2 cores         2 cores, 1 socket

  Disk                         15 GB on        15 GB on
                               `local-lvm`     `local-lvm`

  OS                           Debian 12       Debian 12
  -----------------------------------------------------------------------

The Server 1 memory upgrade is recorded in `docs/design/decisions.md`.
Server 2 and Server 3 were cloned from the same 2 GiB base configuration.
The Proxmox VE instance runs as a nested VM inside VMware and has its own
finite CPU, memory and storage allocation. The PaaS must therefore be
treated as a resource-constrained academic MVP even after the upgrade.

## 3. Target role allocation

  -----------------------------------------------------------------------
  Host                    Target role             Planned services
  ----------------------- ----------------------- -----------------------
  Server 1                Lightweight             Next.js, Express API,
                          control-plane and       MariaDB, Redis, worker
                          ingress candidate       and Traefik, only after
                          (4 GiB RAM)             capacity preflight

  Server 2                Runtime node 1          Docker Engine and
                                                  application containers

  Server 3                Runtime node 2          Docker Engine and
                                                  application containers
  -----------------------------------------------------------------------

Do not host a private OCI registry or perform builds on Server 1 in the
initial MVP. Builds are serialized and run on the selected runtime node.
If Server 1 cannot run the control-plane services with safe memory/disk
headroom, stop and propose increasing VM/host resources or adding
another machine.

## 4. Existing service preservation

Server 1 hosts an ordinary portfolio website served by Apache on port
80. It is not an IAAS dashboard and is not part of the PaaS.

Required invariants:

-   `server1.ogulix.tech` continues to serve the existing Apache
    website.
-   Apache remains bound to its current port unless the owner explicitly
    approves a migration.
-   Traefik must use a separate, verified listener port on Server 1.
-   Existing Proxmox and SSH tunnel routes remain unchanged.
-   Do not install or enable a second service on an occupied port.

## 5. Proposed domain and ingress plan

  -----------------------------------------------------------------------
  Hostname                Purpose                 Status
  ----------------------- ----------------------- -----------------------
  `server1.ogulix.tech`   Existing portfolio      Existing

  `pve.ogulix.tech`       Proxmox interface       Existing

  `paas.ogulix.tech`      PaaS dashboard          Proposed

  `*.apps.ogulix.tech`    Deployed applications   Proposed; wildcard DNS
                                                  missing
  -----------------------------------------------------------------------

The Cloudflare Tunnel connector currently runs as a Windows service. The
proposed change is to add new ingress rules on that existing connector,
forwarding the PaaS dashboard and application wildcard hostnames to
Traefik on Server 1's separately selected port.

Wildcard DNS and wildcard tunnel ingress are separate configuration
concerns. Both must be configured and tested. Preserve existing ingress
rules and order specific hostnames before any catch-all rule.

## 6. Network flows

-   User browser -\> Cloudflare -\> existing Windows Tunnel connector
    -\> Traefik on Server 1.
-   Traefik -\> application host port on Server 2 or Server 3 over the
    private network.
-   Express API / worker -\> runtime node over SSH.
-   Runtime node -\> its local Docker image store for the initial MVP.
-   API / worker -\> MariaDB and Redis on Server 1 over local/private
    interfaces.

Do not expose SSH, MariaDB, Redis or Docker API directly to the public
internet.

## 7. Port planning

No new port should be assumed available. Before deployment, inventory
listeners on all VMs and decide exact ports.

-   Apache: preserve existing Server 1 port 80.
-   Traefik: use a distinct, verified port such as 8080 only if it is
    free.
-   Traefik is the single origin for the control plane: `/api/*` is
    forwarded to the Express API and all other paths to Next.js. Both
    listeners stay internal.
-   MariaDB and Redis: bind to loopback or private interfaces and
    restrict firewall access.
-   Runtime application ports: allocate from `30000-32767` per node,
    unique per node, bound to the node's private address and reachable
    only from Server 1's proxy/control plane.

The example port 8080 is a proposal, not a verified free port. The port
range for application containers is fixed in `docs/design/decisions.md`,
but individual port availability is still decided by the node allocator.


## 8. Operational ownership

The IAAS member owns VM/server/network preparation and the server-side Traefik origin. The assigned frontend member additionally owns Cloudflare DNS and new Tunnel ingress entries for the PaaS domains, but must wait for IAAS to verify the origin and must preserve all existing routes. See `docs/operations/team-responsibilities.md` and `docs/operations/cloudflare-operations.md`.
