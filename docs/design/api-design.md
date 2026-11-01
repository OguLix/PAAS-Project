# API Design

This document is narrative background. It is **not** normative and must not be used as an
implementation reference. `docs/design/api-contract.md` defines the endpoints, envelopes and DTOs,
and `docs/design/decisions.md` records how the two documents were reconciled.

## 1. API conventions

-   Base path: `/api/v1`
-   Format: JSON
-   Authentication: opaque server-side session cookie (`ogulix_session`). No access token and no
    refresh token in the MVP.
-   Authorization: role-based checks plus resource ownership checks.
-   Validation: validate request bodies, parameters and query strings before business logic, using
    the shared Zod schemas.
-   Errors: consistent error envelope with stable machine-readable code and safe message.
-   Long-running work: return a deployment/job identifier; clients poll for status. Streaming is a
    later enhancement.

## 2. Endpoint groups

This list mirrors `api-contract.md`. If the two ever disagree, the contract wins.

  Method   Endpoint                                    Purpose
  -------- ------------------------------------------- ------------------------------------
  POST     `/auth/register`                            Register account when enabled
  POST     `/auth/login`                               Authenticate
  POST     `/auth/logout`                              Revoke current session
  GET      `/auth/me`                                  Current user and role
  GET      `/applications`                             List authorized applications
  POST     `/applications`                             Create application
  GET      `/applications/:applicationId`              Application details
  PATCH    `/applications/:applicationId`              Update application settings
  DELETE   `/applications/:applicationId`              Archive application safely
  POST     `/applications/:applicationId/deployments`  Request deployment
  GET      `/applications/:applicationId/deployments`  Deployment history
  GET      `/deployments/:deploymentId`                Deployment status/details
  POST     `/deployments/:deploymentId/cancel`         Cancel a queued deployment
  POST     `/deployments/:deploymentId/stop`           Stop a running deployment
  POST     `/deployments/:deploymentId/restart`        Ensure the container is running
  GET      `/applications/:applicationId/logs`        Bounded, redacted build logs
  GET      `/nodes`                                    List runtime nodes
  GET      `/applications/:applicationId/domains`      List application domains
  POST     `/applications/:applicationId/domains`      Assign/validate domain
  DELETE   `/domains/:domainId`                        Disable domain association
  GET      `/applications/:applicationId/env`          List variable names only
  PUT      `/applications/:applicationId/env/:key`     Create/update encrypted variable
  DELETE   `/applications/:applicationId/env/:key`     Delete variable

Deliberately excluded from the MVP: `POST /auth/refresh`, the
`/applications/:id/actions/*` lifecycle routes and `GET /nodes/:id/metrics`. See
`docs/design/decisions.md` for the reasoning.

## 3. Authorization

Initial roles:

-   `ADMIN`: platform configuration, node management and all
    applications.
-   `USER`: manage only applications they own or have been explicitly
    granted access to.

Every application-scoped route must verify access to the referenced
application. Knowing an ID must never grant access.

## 4. Deployment API behavior

`POST /applications/:id/deployments` validates source and configuration,
creates a deployment record and queues work. It should return
`202 Accepted` with the deployment ID and initial state.

Repeated requests should not accidentally create duplicate releases. Use
an idempotency key or request fingerprint for deployment creation where
appropriate.

## 5. Logs and secrets

-   Never include secret environment-variable values in API responses.
-   Redact credentials, tokens and known secret values from logs.
-   Restrict log access to users authorized for the application.
-   Bound log query size and time range.


## 6. Cloudflare configuration boundary

Cloudflare DNS, Tunnel ingress and Access policies are managed as infrastructure configuration by the assigned Cloudflare owner, coordinated with IAAS. The MVP API must not expose an arbitrary endpoint for users or agents to change the live Cloudflare account or tunnel configuration. Application domain assignment is stored/validated by the backend and translated into a controlled Traefik route update; public DNS/Tunnel wildcard setup remains a separately approved operational task.
