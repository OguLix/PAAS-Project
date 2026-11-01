# REST API Contract

## 1. Conventions

- Base path: `/api/v1`.
- Content type: `application/json`, except future streaming log endpoints.
- IDs are opaque strings (UUID recommended).
- Timestamps use ISO 8601 UTC.
- Protected routes use the opaque session cookie `ogulix_session` (`HttpOnly`, `Secure`, `SameSite=Lax`). There is no access token or refresh token in the MVP.
- Backend authorization is authoritative; all resource operations enforce ownership.
- Long-running deployment actions return immediately with a deployment resource; they do not wait for image build completion.

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
| POST | `/deployments/:deploymentId/cancel` | Cancel a `QUEUED` deployment |
| POST | `/deployments/:deploymentId/stop` | Request stop of a running deployment |
| POST | `/deployments/:deploymentId/restart` | Ensure this deployment's container is running |
| GET | `/applications/:applicationId/logs` | Read bounded, redacted build logs |
| GET | `/nodes` | List runtime-node status |
| GET | `/applications/:applicationId/domains` | List domains |
| POST | `/applications/:applicationId/domains` | Associate hostname |
| DELETE | `/domains/:domainId` | Disable/remove association |
| GET | `/applications/:applicationId/env` | List variable names only |
| PUT | `/applications/:applicationId/env/:key` | Create/update encrypted variable |
| DELETE | `/applications/:applicationId/env/:key` | Delete variable |

Admin-only node mutation endpoints are intentionally not specified for the first MVP. Runtime-node inventory may initially be provisioned through controlled configuration.

## 4. DTO outline

`CreateApplicationInput`
```ts
type CreateApplicationInput = {
  name: string;
  sourceRepository: string;
  defaultBranch: string;
};
```

`DeployInput`
```ts
type DeployInput = {
  branch?: string;
  commitSha?: string;
};
```

Deployment creation accepts an `Idempotency-Key` request header. The same key on the same application
resolves to the existing deployment instead of creating a second release; a conflicting payload with
a reused key returns `409`.

`ApplicationResponse`
```ts
type ApplicationResponse = {
  id: string;
  name: string;
  sourceRepository: string;
  defaultBranch: string;
  status: "ACTIVE" | "ARCHIVED";
  currentDeploymentId: string | null;
  createdAt: string;
  updatedAt: string;
};
```
`currentDeploymentId` is derived from the newest deployment in `RUNNING`; it is not stored separately.

`DeploymentResponse`
```ts
type DeploymentResponse = {
  id: string;
  applicationId: string;
  runtimeNodeId: string | null;
  status: DeploymentStatus;
  commitSha: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
};
```

`DeploymentStatus` is the shared enum from `docs/architecture/deployment-state-machine.md`, exported by `shared/types/`.

`DeploymentLogEntry`
```ts
type DeploymentLogEntry = {
  sequence: number;
  level: "INFO" | "WARN" | "ERROR";
  stream: "BUILD" | "SYSTEM";
  message: string;
  createdAt: string;
};
```

Log responses are paginated with `?after=<sequence>&limit=` and are capped per deployment. Runtime container stdout is not served by this endpoint in the MVP; it is fetched on demand by the worker and bounded.

Do not return `imageReference`, `imageDigest`, internal node addresses, secret values or raw command output to ordinary users unless a reviewed product requirement needs them.

## 5. Status and HTTP semantics

- `201 Created`: resource created.
- `202 Accepted`: asynchronous deployment, cancel, stop or restart request accepted.
- `400 Bad Request`: malformed or invalid input.
- `401 Unauthorized`: no valid authentication.
- `403 Forbidden`: authenticated but not allowed, including registration attempts while `REGISTRATION_MODE=closed`.
- `404 Not Found`: missing resource; may be used to avoid revealing another user's resource.
- `409 Conflict`: state or uniqueness conflict, including a deploy request that conflicts with an existing idempotency key.
- `422 Unprocessable Entity`: semantically invalid operation, if adopted consistently.
- `429 Too Many Requests`: rate limit.
- `500`: generic internal error with request ID only.

## 6. Frontend integration requirements

Frontend should implement API calls in feature service files, not directly inside every page. Map documented error codes to user-friendly messages. Treat `202` deployment responses as accepted jobs and poll the deployment resource or use a later agreed event channel.

## 7. Contract governance

Backend 1 owns the API contract. Frontend members review it before implementation. Breaking changes require coordinated updates to API docs, frontend types and tests. OpenAPI generation is a recommended follow-up, not a prerequisite for the initial scaffold.

The following are deliberately absent and must not be reintroduced without a new decision: `POST /auth/refresh`, `POST /applications/:id/actions/{start,stop,restart}` and `GET /nodes/:id/metrics`. The rationale is recorded in `docs/design/decisions.md`.
