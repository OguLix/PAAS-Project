# REST API Contract

## 1. Conventions

- Base path: `/api/v1`.
- Content type: `application/json`, except future streaming log endpoints.
- IDs are opaque strings (UUID recommended).
- Timestamps use ISO 8601 UTC.
- Protected routes use the opaque session cookie `ogulix_session` (`HttpOnly`, `Secure`, `SameSite=Lax`). There is no access token or refresh token in the MVP.
- Backend authorization is authoritative; all resource operations enforce ownership.
- Long-running deployment actions return immediately with a deployment resource; they do not wait for image build completion.
- Deployment creation requires an `Idempotency-Key`; the API also computes a request fingerprint and rejects a reused key with a different payload as `409 IDEMPOTENCY_CONFLICT`.
- Only public `https://` repository URLs are accepted. Private, loopback, link-local and metadata-service hosts, non-default ports and embedded credentials are rejected at validation and checked again by the worker.
- List endpoints are paginated; `pageSize` defaults to 20 and never exceeds 100.

This document is the normative contract. `docs/design/api-design.md` is narrative background only. Session lifetime, revocation and CSRF handling are fixed in `docs/design/decisions.md`; do not invent alternative token lifetimes in frontend code.

## 2. Common response shapes

Success:
```json
{
  "data": {},
  "meta": {
    "requestId": "req_example"
  }
}
```

List:
```json
{
  "data": [],
  "meta": {
    "requestId": "req_example",
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 0
    }
  }
}
```

Error:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": []
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Never include stack traces, secrets, raw environment values, SQL statements or private SSH details in API responses.

Stable error codes: `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `REGISTRATION_CLOSED`,
`NOT_FOUND`, `CONFLICT`, `INVALID_STATE`, `IDEMPOTENCY_CONFLICT`, `UNPROCESSABLE`, `RATE_LIMITED`,
`INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`. The shared union is `API_ERROR_CODES` in
`shared/types/api.ts`; the frontend maps each code to one user-facing sentence.

## 3. Endpoint inventory

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` | Register account, if open registration is enabled |
| POST | `/auth/login` | Authenticate |
| POST | `/auth/logout` | Revoke session |
| GET | `/auth/me` | Current user |
| GET | `/applications` | List owned applications |
| POST | `/applications` | Create application |
| GET | `/applications/:applicationId` | Read owned application |
| PATCH | `/applications/:applicationId` | Update owned application |
| DELETE | `/applications/:applicationId` | Archive application |
| GET | `/applications/:applicationId/deployments` | List deployment history |
| POST | `/applications/:applicationId/deployments` | Request deployment |
| GET | `/deployments/:deploymentId` | Read deployment |
| GET | `/deployments/:deploymentId/logs` | Read deployment-scoped, bounded, redacted logs |
| POST | `/deployments/:deploymentId/cancel` | Cancel a `QUEUED` deployment |
| POST | `/deployments/:deploymentId/stop` | Request stop of a running deployment |
| POST | `/deployments/:deploymentId/restart` | Create a new deployment attempt; immutable history |
| GET | `/applications/:applicationId/logs` | Read application-scoped bounded, redacted build logs |
| GET | `/nodes` | List runtime-node status |
| GET | `/applications/:applicationId/domains` | List domains |
| POST | `/applications/:applicationId/domains` | Associate hostname |
| DELETE | `/domains/:domainId` | Disable/remove association |
| GET | `/applications/:applicationId/env` | List variable names only |
| PUT | `/applications/:applicationId/env/:key` | Create/update encrypted variable |
| DELETE | `/applications/:applicationId/env/:key` | Delete variable |

Admin-only node mutation endpoints are intentionally not specified for the first MVP. Runtime-node inventory may initially be provisioned through controlled configuration.

`GET /health` reports `runtimeMode: "mock" | "iaas"` so the dashboard and operators cannot mistake
simulated deployments for real IAAS activity. The default is `mock`. `GET /ready` reports dependency
readiness without exposing connection strings.

## 4. DTO outline

### Authentication

`POST /auth/register` and `POST /auth/login` accept:

```ts
type AuthCredentials = {
  email: string;
  password: string;
};
```

Email is trimmed and normalized to lowercase. Passwords must contain 8-256 characters. Registering
while `REGISTRATION_MODE=closed` returns `403 REGISTRATION_CLOSED`. Successful registration and
login both create a server-side session and set the `ogulix_session` cookie; neither response
contains the opaque token.

`GET /auth/me`, successful login and successful registration return:

```ts
type AuthUser = {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
};
// Wrapped as { data: { user: AuthUser }, meta: { requestId: string } }
```

`POST /auth/logout` revokes the current session, clears the cookie and returns
`{ data: { loggedOut: true }, meta: { requestId } }`. Login credential failures return `401
UNAUTHENTICATED` with the same message regardless of whether the email exists.

### Applications and domains

`CreateApplicationInput`
```ts
type ApplicationDeploymentConfig = {
  dockerfilePath: string;   // default "Dockerfile"
  buildContext: string;     // default "."
  internalPort: number;     // default 3000
  healthCheckPath: string;  // default "/"
  cpuCores: number;         // default 0.5
  memoryMb: number;         // default 512
  pidsLimit: number;        // default 100
};

type CreateApplicationInput = {
  name: string;
  sourceRepository: string;
  defaultBranch: string;
} & Partial<ApplicationDeploymentConfig>;
```

`UpdateApplicationInput` is a partial of the same shape and must include at least one field. Paths
must stay inside the repository; `internalPort` is the container port, not the host port. Unknown
fields are rejected.

Environment variable keys must look like `CONSTANT_CASE` and must not be platform-managed. Reserved
keys include `PATH`, `HOME`, `PWD`, `SHELL`, `USER`, `LOGNAME`, `HOST`, `HOSTNAME`, `PORT`,
`NODE_ENV`, `NODE_OPTIONS`, `NODE_PATH`, `LD_PRELOAD`, `LD_LIBRARY_PATH` and every `OGULIX_*` key.

`DeployInput`
```ts
type DeployInput = {
  branch?: string;
  commitSha?: string;
};
```

Deployment creation requires an `Idempotency-Key` request header. The API stores a SHA-256
fingerprint of the normalized application, branch/commit and requested configuration. The same key
with the same fingerprint resolves to the existing deployment instead of creating a second release;
a reused key with a different fingerprint returns `409 IDEMPOTENCY_CONFLICT`.

At most one deployment per application may be `RUNNING`. The worker prefers build-and-health-check
alongside the current deployment, then replaces it. If resource limits force stop-first, the
deployment log and API response must state the expected downtime. `POST /deployments/:id/restart`
creates a new deployment attempt and never rewrites the old attempt's history.

`ApplicationResponse`
```ts
type ApplicationResponse = {
  id: string;
  name: string;
  sourceRepository: string;
  defaultBranch: string;
  dockerfilePath: string;
  buildContext: string;
  internalPort: number;
  healthCheckPath: string;
  cpuCores: number;
  memoryMb: number;
  pidsLimit: number;
  status: "ACTIVE" | "ARCHIVED";
  currentDeploymentId: string | null;
  createdAt: string;
  updatedAt: string;
};
```
`currentDeploymentId` is derived from the newest deployment in `RUNNING`; it is not stored separately.

Application list responses use the common list envelope and accept `page` (default 1) and `pageSize`
(default 20, maximum 100). Application create/update requests reject unknown fields; updates must
include at least one field. Deletion archives the application and preserves its history. If the
application has an active deployment (`QUEUED` through `HEALTH_CHECKING`, or `RUNNING`), archive
returns `409 INVALID_STATE`; stop or cancel the deployment first.

Domain association accepts `{ hostname: string }`. The MVP accepts one DNS label below
`apps.ogulix.tech` (for example `demo.apps.ogulix.tech`); custom domains and wildcard hostnames are
not accepted. Hostnames are normalized to lowercase and must be globally unique.

```ts
type DomainResponse = {
  id: string;
  applicationId: string;
  hostname: string;
  isPrimary: boolean;
  status: "PENDING" | "ACTIVE" | "FAILED" | "DISABLED";
  createdAt: string;
};
```

`DeploymentResponse`
```ts
type DeploymentResponse = {
  id: string;
  applicationId: string;
  runtimeNodeId: string | null;
  status: DeploymentStatus;
  branch: string | null;
  commitSha: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: DeploymentErrorCode | null;
  errorMessage: string | null; // sanitized; never raw provider output
};
```

`DeploymentStatus` is the shared enum from `docs/architecture/deployment-state-machine.md`, exported by `shared/types/`. `DeploymentErrorCode` is a stable shared union; provider-specific messages never appear here.

`DeploymentLogEntry`
```ts
type DeploymentLogEntry = {
  deploymentId: string;
  sequence: number;
  level: "INFO" | "WARN" | "ERROR";
  stream: "BUILD" | "SYSTEM";
  message: string;
  createdAt: string;
};
```

Log responses are paginated with `?after=<sequence>&limit=` and are capped per deployment at 2000
lines or 200 KB. `Deployment.logLineCount` and `logByteCount` expose how close the attempt is to those
caps without returning secrets. Runtime container stdout is not served by this endpoint in the MVP;
it is fetched on demand by the worker and bounded.

```ts
type RuntimeNodeResponse = {
  id: string;
  name: string;
  status: "ONLINE" | "DEGRADED" | "OFFLINE" | "MAINTENANCE";
  capacityCpuMillicores: number;
  capacityMemoryMb: number;
  lastHeartbeatAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type EnvironmentVariableSummary = {
  key: string;
  isSecret: boolean;
  createdAt: string;
  updatedAt: string;
};
```

Node responses never include private addresses, SSH ports, credentials or Docker socket details.
Environment-variable responses list names and secret flags only; values are encrypted at rest and
never returned.

Do not return `imageReference`, `imageDigest`, internal node addresses, secret values or raw command output to ordinary users unless a reviewed product requirement needs them.

## 5. Status and HTTP semantics

- `201 Created`: resource created.
- `202 Accepted`: asynchronous deployment, cancel, stop or restart request accepted.
- `400 Bad Request`: malformed or invalid input.
- `401 Unauthorized`: no valid authentication.
- `403 Forbidden`: authenticated but not allowed, including registration attempts while `REGISTRATION_MODE=closed`.
- `404 Not Found`: missing resource; may be used to avoid revealing another user's resource.
- `409 Conflict`: uniqueness conflict, idempotency-key conflict (`IDEMPOTENCY_CONFLICT`), or an operation forbidden by resource state (`INVALID_STATE`, including archiving an application with an active deployment).
- `422 Unprocessable Entity`: semantically invalid operation, if adopted consistently.
- `429 Too Many Requests`: rate limit.
- `500`: generic internal error with request ID only.
- `503 Service Unavailable`: a required dependency is not ready; the response must not leak connection details.

The API allows credentialed CORS only from the configured dashboard origin (`APP_ORIGIN`), with
`Content-Type` and `Idempotency-Key` as the allowed request headers. All state-changing requests
must have an `Origin` matching that dashboard origin, or omit `Origin` while supplying
`Sec-Fetch-Site: same-origin`. A `same-site` fetch is accepted only when its `Origin` matches.
Requests with a different fetch-site value are rejected with `403 FORBIDDEN`.

## 6. Frontend integration requirements

Frontend should implement API calls in feature service files, not directly inside every page. Map documented error codes to user-friendly messages. Treat `202` deployment responses as accepted jobs and poll the deployment resource or use a later agreed event channel.

## 7. Contract governance

Backend 1 owns the API contract. Frontend members review it before implementation. Breaking changes require coordinated updates to API docs, frontend types and tests. OpenAPI generation is a recommended follow-up, not a prerequisite for the initial scaffold.

The following are deliberately absent and must not be reintroduced without a new decision: `POST /auth/refresh`, `POST /applications/:id/actions/{start,stop,restart}` and `GET /nodes/:id/metrics`. The rationale is recorded in `docs/design/decisions.md`.

`shared/` is split into a browser-safe root export and a server-only `@ogulix/shared/server/*`
subpath. API DTOs and pure state helpers live in the root; Prisma, encryption, redaction and
server-only adapters must never be imported by frontend code.
