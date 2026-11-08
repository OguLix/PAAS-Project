# Worker and Deployment Execution Architecture

## 1. Purpose

The worker handles asynchronous operations so API requests remain responsive. It runs as a separate Node.js + TypeScript process and consumes BullMQ jobs from Redis.

## 2. Proposed structure

```text
worker/
├── src/
│   ├── index.ts
│   ├── config/
│   ├── queues/
│   │   └── deployment.queue.ts
│   ├── processors/
│   │   └── deployment.processor.ts
│   ├── jobs/
│   │   ├── deploy.job.ts
│   │   ├── stop.job.ts
│   │   └── restart.job.ts
│   ├── services/
│   │   ├── deployment-orchestrator.ts
│   │   ├── node-scheduler.ts
│   │   ├── build-service.ts
│   │   └── health-check-service.ts
│   ├── adapters/
│   │   ├── ssh.adapter.ts
│   │   ├── buildkit.adapter.ts
│   │   ├── docker.adapter.ts
│   │   └── traefik-config.adapter.ts
│   └── tests/
```

## 3. Job contract

A queue job contains identifiers and validated options, not secrets or arbitrary commands.

```ts
type DeployJob = {
  deploymentId: string;
  applicationId: string;
  requestedByUserId: string;
  sourceRevision?: string;
};
```

The worker loads authoritative application configuration from the database. Never trust a job payload as proof of ownership or authorization.

## 4. Processing sequence

1. Load deployment and application records.
2. Confirm the deployment is in a processable state.
3. Select an eligible runtime node using health and reported resource headroom.
4. Create an isolated, temporary build workspace on that node.
5. Run the approved BuildKit workflow with timeout and resource limits.
6. Start the container with CPU, memory, process and storage constraints.
7. Record container metadata and allocated host port.
8. Update the validated Traefik dynamic configuration.
9. Perform health checks.
10. Mark deployment ready or failed and record sanitized diagnostics.
11. Clean temporary build files according to retention policy.

Build concurrency is one for the MVP. The node scheduler is a simple best-available-node policy, not a distributed cluster scheduler.

## 5. Log handling

Build output is appended to `DeploymentLog` in MariaDB, redacted before insert, and capped at 2000
lines or 200 KB per deployment. Writes must be batched; the worker must not emit one database write
per line.

Runtime container stdout is **not** persisted. When a user asks for runtime logs, the worker calls the
`logs` verb with a bounded `--tail`/`--since` window and returns the result without storing it.

Redaction applies to both paths and covers environment values, tokens and anything matching the
secret-key patterns defined in `shared/`.

## 6. Adapter boundaries

Adapters expose predefined operations only. The worker must not accept arbitrary shell strings from API users.

Each runtime node exposes one helper, `/usr/local/bin/ogulix-node`, and the worker's key is pinned to
it with `command="/usr/local/bin/ogulix-node"` in the node's `authorized_keys`. The key can therefore
never open a shell. The helper reads a verb plus a JSON payload on stdin and accepts only:

`node-info`, `build`, `container-upsert`, `container-start`, `container-stop`, `container-inspect`,
`container-remove`, `logs`, `cleanup`.

Everything else is rejected before any process is spawned. The request and response types live in
`shared/types/node-protocol.ts`. Environment values are passed in the payload, never as
interpolated arguments. SSH targets are allowlisted runtime nodes; credentials are dedicated and
restricted.

Traefik configuration must be generated from validated hostname, node address and allocated port
values. It is written atomically on Server 1, where both the worker and Traefik run, then validated
before any reload. Route changes are therefore a local file operation, not a remote command.

## 7. Failure and retry

- Retry only transient operations and use bounded attempts/backoff.
- Do not blindly retry non-idempotent container creation.
- Use deployment ID as an idempotency/correlation key.
- The BullMQ payload contract is shared and discriminated by `kind` (`deploy`, `stop`, `restart`).
  It carries identifiers and validated options only, never secrets or arbitrary shell commands.
- Persist each state transition and reject transitions that the shared state machine forbids.
- A restart job creates a new deployment attempt; it never reopens a terminal deployment row.
- At most one deployment per application may be `RUNNING`; replace the current healthy container
  only after the new attempt passes its health check unless stop-first is explicitly forced.
- If a job fails, retain a sanitized error code and correlation ID.
- Ensure temporary workspaces are cleaned after success, failure and timeout.
- A worker restart must safely resume or mark stale jobs according to a documented recovery policy.

## 8. Resource and MVP limitations

Builds occur on the selected runtime node because no private registry is planned initially. Images are node-local; cross-node movement requires rebuilding on the destination node. Do not promise automatic migration, high availability or parallel builds.

Runtime defaults are fixed in `docs/design/decisions.md`: 0.5 CPU, 512 MiB memory, 100 PIDs,
`unless-stopped` restart policy, no privileged mode, no host network, no Docker socket mount,
`no-new-privileges`, a 10-minute build timeout, a 1 GiB build-cache ceiling, and host ports allocated
from `30000-32767` bound to the node's private address.
