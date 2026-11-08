# Testing Architecture

## 1. Test levels

| Level | Scope | Examples | Owner |
|---|---|---|---|
| Unit | Pure functions and isolated services | validation, scheduler selection, state transitions | Each module owner |
| Integration | Module plus database/Redis/adapter boundary | Prisma repository, queue enqueue/consume | Backend members |
| Contract | Frontend/API DTO compatibility | request/response schema and error envelope | Frontend + Backend 1 |
| Adapter | Infrastructure adapter behavior with fakes/test doubles | SSH allowlist, Docker command construction, Traefik config generation | Backend 2 |
| E2E | Full user workflow | create app, deploy, observe status, access hostname | Whole team |
| Infrastructure smoke | VM, Docker, SSH, Traefik, Tunnel reachability | runtime node readiness and ingress regression | IAAS + Cloudflare owner |

## 2. Required test cases

### Frontend
- Authentication loading, validation and error states.
- Empty and populated application list.
- Deployment status rendering for every documented state.
- API 401/403/404/409/500 handling.
- No secret values displayed after saving environment variables.

### Backend
- User can only access owned applications/deployments.
- Duplicate email and hostname are rejected.
- Invalid deployment state transitions are rejected.
- Cancelling a `QUEUED` deployment succeeds; cancelling an active or terminal one is rejected.
- Deployment request creates record and enqueues one job.
- Repeating a deployment request with the same idempotency key returns the existing deployment.
- Error responses do not leak stack traces or secrets.
- Environment-variable ciphertext is stored; plaintext is not returned.
- Session rows store only a hash of the cookie token.

### Worker
- Duplicate job delivery does not create duplicate deployment side effects.
- Scheduler excludes offline/maintenance nodes.
- Build timeout and failure are recorded.
- Container resource limits are applied.
- Build log writes are redacted and stop at the size cap.
- Runtime log retrieval is bounded and never persisted.
- Traefik config is generated only from validated host/port values.
- Temporary workspace cleanup runs on success and failure.
- The node helper rejects verbs outside the allowlist.

### Infrastructure and Cloudflare
- Existing Server 1 Apache portfolio remains reachable on port 80.
- Existing Proxmox and SSH tunnel routes remain unchanged.
- Runtime nodes accept only approved SSH operations.
- PaaS origin is reachable privately before public Tunnel changes.
- New public hostnames route to the correct Traefik origin.
- Rollback removes only newly added PaaS records/rules.

## 3. Test environment

Use local development services or isolated test instances. Never run destructive tests against the existing IAAS environment or live Cloudflare routes without explicit approval. Secrets for tests must be synthetic.

The split is deliberate:

- Unit and contract tests run without Docker and use synthetic values.
- Integration tests use the local MariaDB 11.4 and Redis services from
  `infrastructure/docker/compose.dev.yml`; they must never target IAAS hosts.
- Local end-to-end tests use mock runtime adapters and `RUNTIME_MODE=mock`, so they exercise the
  control-plane state machine without SSH, Docker or Cloudflare. Mock mode must be visible in health
  responses and UI notices.

## 4. Quality gates

Before a feature is considered complete:
- Type checking passes.
- Linting passes.
- Relevant unit/integration tests pass.
- API contract and docs are updated.
- No secrets or generated credentials are committed.
- Human reviewer approves the change.

## 5. Test ownership

Each developer writes tests for their component. Backend 1 owns API/database integration tests; Backend 2 owns worker/adapter tests; frontend members own UI and API-contract tests; IAAS and Cloudflare owner jointly perform infrastructure/public-ingress smoke tests.
