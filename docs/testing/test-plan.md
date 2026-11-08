# Test Plan

## 1. Unit tests

These run without Docker and use synthetic values.

-   API request validation
-   Authentication and authorization
-   Session issuance, expiry, idle timeout and revocation
-   Application ownership enforcement
-   Deployment state transitions
-   Cancellation accepted only for `QUEUED` deployments
-   Idempotency key plus request-fingerprint conflict handling
-   AES-256-GCM encryption/decryption and key validation
-   Log redaction and size capping
-   Scheduler decisions with mocked node metrics
-   Resource-limit validation and application path traversal rejection
-   Traefik configuration generation and validation
-   Secret redaction
-   Prisma repository/data-access behavior

## 2. Integration tests

-   Express API with disposable MariaDB
-   Prisma migrations against the selected MariaDB version
-   BullMQ enqueue/consume/retry behavior with Redis
-   Worker failure and retry behavior
-   BuildKit image build using a small sample application
-   Verify local image tagging and lookup on the selected runtime node
-   SSH adapter against a test runtime node
-   Container lifecycle and bounded log retrieval
-   Traefik route update and health check

## 3. End-to-end tests

Local end-to-end tests use mock runtime adapters (`RUNTIME_MODE=mock`) and never contact the IAAS
VMs. A real IAAS lifecycle test requires separate human approval.

1.  Authenticate as a user.
2.  Create an application.
3.  Configure a sample Git repository.
4.  Request deployment.
5.  Observe queued/building/starting/health-checking states.
6.  Confirm a runtime node was selected.
7.  Confirm container health.
8.  Open the assigned `*.apps.ogulix.tech` hostname through Cloudflare
    Tunnel.
9.  View deployment history and logs.
10. Stop and restart the application; verify restart creates a new
    deployment attempt and preserves the old one.
11. Test a failed build and verify the previous healthy release remains
    available where possible.
12. Try archiving while the application has an active deployment and
    verify `409 INVALID_STATE`.

## 4. Infrastructure regression tests

-   `server1.ogulix.tech` still serves the existing Apache portfolio.
-   Existing Proxmox access and protection are unchanged.
-   Existing SSH tunnel hostnames continue to work.
-   Traefik does not bind to Apache's port 80.
-   Public requests cannot reach SSH, MariaDB, Redis or Docker API.
-   Runtime application ports are not directly exposed to the public
    internet.

## 5. Security tests

-   User A cannot read or change User B's application.
-   Requirements: the session cookie is `HttpOnly` and the browser cannot read it; a revoked or
    expired session is rejected.
-   Invalid deployment configuration is rejected.
-   Repository URLs with embedded credentials, non-`https` schemes, non-default ports, or
    private/loopback/link-local/metadata hostnames are rejected.
-   Platform-reserved environment-variable keys are rejected.
-   A duplicate deploy request with the same idempotency key and payload does not create a second
    deployment; a different payload returns `409 IDEMPOTENCY_CONFLICT`.
-   Shell metacharacters in user input cannot execute commands.
-   The node helper rejects an unknown verb without spawning a process.
-   Secret values do not appear in logs or API responses.
-   Container resource limits are applied.
-   Unauthorized runtime operations are rejected.
-   SSH keys and any future registry credentials are not present in repository
    history.

## 6. Release gate

Do not call the MVP complete until unit, integration, end-to-end and
infrastructure regression tests pass, backup/restore has been tested,
and known limitations are documented.
