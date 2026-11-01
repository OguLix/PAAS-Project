# Deployment Guide

This guide describes the intended deployment workflow. It is not an
instruction to run production changes before the preflight checks are
complete.

## 1. Application configuration

Each application should define:

-   Git repository URL (public HTTPS only)
-   branch or revision
-   build context and Dockerfile path
-   exposed application port
-   health-check path and expected behavior
-   CPU and memory limits
-   environment-variable names and secret flags
-   requested hostname

Validate all fields before enqueueing a deployment. Reject repository URLs that contain embedded
credentials or use a scheme other than `https`.

## 2. Build

The worker checks out a pinned source revision into an isolated
workspace and builds an OCI image using BuildKit on the selected runtime
node. Store the local image ID/tag, source revision and target node with
the deployment record. The initial MVP does not use a private registry;
images remain local to the node where they were built.

## 3. Schedule

The scheduler filters nodes by health and available resources. It
selects a node only if the requested CPU/memory/disk budget fits the
configured policy. The initial scheduler is best-available-node
selection, not Kubernetes-style orchestration.

## 4. Run

The worker uses the restricted SSH adapter to ask the selected node to:

1.  Verify that the locally built image exists on the selected node.
2.  Create or replace the platform-managed container using validated
    settings.
3.  Apply resource limits and restart policy.
4.  Publish the allocated host port on the private interface.
5.  Start the container and return its ID/status.

Each step is one of the fixed verbs accepted by the node's forced-command helper. The worker never
sends a shell string, and the SSH key on the node cannot open an interactive session.

## 5. Route and health-check

Generate a Traefik route for the assigned hostname and runtime node
IP/port. Validate the generated configuration before applying it.
Perform the configured health check. Mark the deployment healthy only
after the check succeeds.

## 6. Rollback

If the new deployment fails health checks, retain the last known healthy
release and route traffic back to it where possible. Record the failure
and do not silently mark the deployment successful.

## 7. Operational safeguards

-   Do not expose runtime ports publicly.
-   Restrict runtime application ports to the proxy/control plane as
    appropriate.
-   Do not expose MariaDB, Redis or Docker API publicly. The initial
    MVP does not provide a private registry endpoint.
-   Redact environment secrets from logs.
-   Keep deployment logs bounded and access-controlled.
-   Record actor, application, deployment ID, target node and result in
    the audit trail.

## 8. Defaults

These values come from `docs/design/decisions.md` and are the starting point for every application:

| Setting | Default |
|---|---|
| Container CPU | 0.5 core |
| Container memory | 512 MiB |
| Container PID limit | 100 |
| Restart policy | `unless-stopped` |
| Host port allocation | `30000-32767`, unique per node |
| Build timeout | 10 minutes |
| Build cache ceiling | 1 GiB per node |
| Concurrent builds | 1 |
| Deployment log retention | 30 days, 2000 lines or 200 KB per deployment |
