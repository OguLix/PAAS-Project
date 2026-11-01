# System Overview

## 1. Purpose

OguLix PaaS provides a self-service application platform on top of the
existing OguLix IAAS. It manages application source, builds container
images, deploys containers to runtime nodes, exposes applications
through host-based routing, and records deployment status and logs.

The IAAS remains responsible for virtual machines and underlying
infrastructure. The PaaS manages the application lifecycle above those
VMs.

## 2. Capacity-aware architecture

The IAAS UTS report specifies 2 GiB RAM, 2 CPU cores and a 15 GB virtual
disk for each of the three Debian VMs. Server 1 was later upgraded to
4 GiB RAM, so its specification is no longer identical to Server 2 and
Server 3. The Proxmox VE instance is itself nested inside a VMware VM.
This is still a constrained academic environment.

The initial design therefore avoids running a private image registry and
a heavy build service on Server 1. Server 1 is a candidate lightweight
control-plane/ingress host, while Server 2 and Server 3 are runtime
nodes. This allocation must pass resource and port preflight before
installation.

The additional memory makes the control-plane role realistic, but the
existing Apache portfolio shares that memory and 4 GiB is still small for
Next.js, the API, the worker, MariaDB, Redis and Traefik together. Measure
before and after each service is enabled.

If measurements show that the control plane cannot operate with safe
headroom, pause and resize/add infrastructure. Do not silently
overcommit.

## 3. Architecture style

The initial implementation is a modular control-plane application rather
than a microservices fleet:

-   Next.js frontend
-   Express.js API
-   Node.js worker
-   MariaDB persistence
-   Redis/BullMQ job queue
-   SSH and Docker infrastructure adapters
-   Traefik ingress

The worker is a separate process so deployment operations do not block
API requests. For the constrained MVP, build jobs are serialized and
execute BuildKit on the selected runtime node through restricted remote
operations.

## 4. Main components

### Frontend

Next.js + TypeScript provides authentication screens, application
list/detail pages, deployment history, logs, environment configuration,
runtime-node status and domain settings.

### Backend API

Express.js + TypeScript provides authentication, authorization,
application management, deployment requests, node inventory, domain
configuration and audit events.

### Database

MariaDB stores users, sessions, applications, runtime nodes, deployments,
build logs, domains, environment-variable metadata and audit records.
Prisma provides schema management, typed data access and migrations. The
schema lives in `backend/prisma/`; see `docs/design/decisions.md`.

### Queue and worker

Redis and BullMQ handle asynchronous build/deploy jobs. The worker
claims jobs, validates their state, performs approved build and
deployment steps, and records progress in MariaDB.

### Build

Docker BuildKit builds application images on the selected runtime node
for the initial MVP. Limit concurrent builds to one and enforce build
time, CPU, memory and disk limits. This avoids storing a separate
private registry on the small Server 1 disk. This trade-off means image
distribution and rollback are initially node-local; document that
limitation.

### Runtime nodes

Server 2 and Server 3 run Docker Engine and host application containers.
The control plane selects a node based on health and available
resources.

### Routing

Traefik is a candidate lightweight ingress service on Server 1 and must
use a separately verified port. It exposes one origin for the control
plane: requests under `/api/*` go to the Express API and everything else
goes to Next.js. Its file provider routes each application hostname to a
runtime node's private IP and allocated host port. Apache's existing port
80 remains untouched.

## 5. Deployment lifecycle

1.  User creates an application and supplies a Git source.
2.  API checks authorization and validates configuration.
3.  API creates a deployment record and enqueues a BullMQ job.
4.  Worker selects a healthy runtime node and starts a serialized build
    operation there.
5.  BuildKit builds the source into an image on that node.
6.  Worker asks the node to start the container with resource limits.
7.  Worker updates Traefik routing for the application hostname.
8.  Health checks determine whether the deployment is healthy.
9.  API exposes deployment status, history and logs in the dashboard.

Because images are initially node-local, a deployment should remain on
the node where it was built unless it is rebuilt on another node.
Cross-node migration and central image distribution are later
enhancements.

## 6. Initial product scope

MVP capabilities:

-   User authentication and basic role-based authorization
-   Application CRUD
-   Git-based source configuration
-   Serialized build and deployment jobs
-   Runtime-node inventory and health
-   Application start, stop, restart and redeploy
-   Deployment history and logs
-   Basic CPU/memory/container status
-   Hostname routing for deployed applications
-   Environment-variable management
-   Audit trail for sensitive actions

Out of scope for the first MVP:

-   Kubernetes
-   Multi-region orchestration
-   Automatic VM provisioning through Proxmox
-   Arbitrary user shell access
-   Full multi-tenant billing
-   Guaranteed high availability
-   Central private registry and cross-node image migration
-   Parallel builds

## 7. Security principles

-   Control-plane and node communication stays on the private network
    where possible.
-   SSH credentials are dedicated and restricted. Runtime-node access
    uses a forced command with a verb allowlist, so deploying never opens
    a general-purpose shell.
-   Docker socket is never publicly exposed.
-   Container workloads run without privileged mode by default.
-   CPU, memory, process and storage limits are enforced.
-   User input is never interpolated into arbitrary shell commands.
-   Sessions are server-side and revocable; the browser holds only an
    opaque cookie.
-   The MVP stores no source-control credentials and accepts public
    repositories only.
-   Secrets are encrypted at rest using an application key stored
    outside the database and source repository.
-   Authorization is checked at every application/deployment boundary.
-   Logs and API responses redact credentials and secret values.
