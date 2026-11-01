# Server Preparation

## 1. Preconditions

-   Confirm console/SSH access to all three VMs.
-   Confirm current backups and recovery access.
-   Record actual free memory, CPU load and disk space.
-   Inventory active ports and services.
-   Verify Server 1 Apache remains healthy.
-   Verify private connectivity between Server 1, Server 2 and Server 3.
-   Confirm Debian package repositories and time synchronization.
-   Confirm Proxmox host VM has enough headroom before changing VM
    allocations.

Server 2 and Server 3 have 2 GiB RAM each; Server 1 was upgraded to
4 GiB RAM. All three have 2 CPU cores and a 15 GB virtual disk. The PaaS
MVP must use conservative resource limits, and the Server 1 figure is a
ceiling shared with the existing Apache portfolio, not a budget the PaaS
may consume entirely.

## 2. Preparation order

1.  Record current state before making changes.
2.  Prepare Server 2 as the first runtime node.
3.  Install Docker Engine using the official Debian installation
    procedure.
4.  Configure Docker daemon safely; do not expose an unauthenticated TCP
    Docker API.
5.  Create a dedicated deployment account and restricted SSH access.
6.  Run a non-production test container with CPU and memory limits.
7.  Verify build and runtime disk cleanup.
8.  Repeat the process on Server 3.
9.  Only then prepare the lightweight Server 1 control-plane services.

## 3. Server 1 safeguards

-   Do not alter Apache virtual hosts or document root.
-   Do not bind Traefik to port 80.
-   Verify the selected Traefik listener port is free.
-   Record `free -m` before adding each service and again after it is
    running. Keep enough headroom that Apache plus the control plane do
    not push the host into swap.
-   Do not host a private image registry or build workloads on Server 1
    in the initial MVP.
-   Configure MariaDB and Redis to listen only on loopback/private
    interfaces.
-   Configure database backups and verify restore before storing
    important data.
-   If safe headroom cannot be maintained, stop and request more
    infrastructure capacity.

## 4. Cloudflare changes

The existing Cloudflare Tunnel connector runs on Windows. Add new host
rules only after Traefik is running and tested privately.

Required new routes:

-   `paas.ogulix.tech` -\> Server 1 Traefik listener
-   `*.apps.ogulix.tech` -\> Server 1 Traefik listener

Create the matching DNS records for the tunnel. Wildcard DNS is
currently absent. Preserve existing `server1`, Proxmox and SSH routes.

## 5. Acceptance checks

-   Existing portfolio remains available.
-   Existing Proxmox route remains protected and available.
-   Existing SSH access to all VMs remains available.
-   Server 2 and Server 3 can run and stop a test container.
-   Server 1 can reach both runtime nodes over the private network.
-   Traefik receives a test request through the tunnel without
    conflicting with Apache.
-   Control-plane services stay within an agreed memory/disk budget
    under the MVP test workload.
