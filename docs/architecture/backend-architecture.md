# Backend Architecture

## 1. Architecture style

Use a modular monolith for the Express.js + TypeScript API. The API and worker are separate Node.js processes, but share domain contracts and infrastructure adapters through `shared/` where practical. Do not split into network microservices for the MVP.

The HTTP layer must remain thin. Business rules belong in services; database queries belong in repositories/data-access modules.

## 2. Proposed directory structure

```text
backend/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   ├── common/
│   │   ├── errors/
│   │   ├── http/
│   │   ├── auth/
│   │   └── validation/
│   ├── middleware/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── applications/
│   │   ├── deployments/
│   │   ├── nodes/
│   │   ├── domains/
│   │   ├── environment-variables/
│   │   └── audit/
│   └── infrastructure/
│       ├── database/
│       └── redis/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tests/
└── package.json
```

`backend/prisma/` is the approved schema location, and it is where Prisma generates its client. The
root `database/` directory intentionally does not duplicate the schema; see
`docs/design/decisions.md`.

Each module may contain:
- `*.routes.ts`: route registration and middleware composition.
- `*.controller.ts`: HTTP request/response translation only.
- `*.service.ts`: use cases and business rules.
- `*.repository.ts`: persistence queries.
- `*.validation.ts`: request validation schemas.
- `*.dto.ts`: API input/output types where useful.

Avoid creating empty layers mechanically. A small read-only module may not need a class or repository abstraction if that adds no value.

## 3. Module responsibilities

| Module | Responsibilities |
|---|---|
| Auth | Register/login/logout/current-user, password hashing, session/token validation |
| Users | User profile and role administration |
| Applications | Application CRUD, ownership checks, source configuration metadata |
| Deployments | Create deployment request, list history, read status and sanitized logs |
| Nodes | Runtime node inventory, health and capacity snapshot |
| Domains | Associate application hostnames and validate uniqueness |
| Environment variables | Store, update and delete encrypted application configuration |
| Audit | Record security-sensitive actions without storing secret values |

## 4. Request flow

1. Express receives request.
2. Request ID, security headers, body-size limit and rate limiting are applied.
3. Authentication middleware identifies the user.
4. Validation middleware parses the input DTO with the shared Zod schema.
5. Controller calls one service use case.
6. Service checks authorization and business invariants.
7. Repository reads/writes MariaDB through Prisma.
8. For asynchronous work, service creates a deployment record and enqueues a job.
9. Controller returns a documented response; long-running build/deploy work is not awaited inside the HTTP request.

## 5. Dependency direction

```text
Routes -> Controller -> Service -> Repository -> Prisma/MariaDB
                         |
                         +-> Queue publisher -> Redis/BullMQ

Worker -> Use-case services -> Infrastructure adapters -> Runtime node
```

Domain/business modules must not import Express request/response types. Infrastructure adapters must not make authorization decisions; authorization belongs in API/use-case services.

## 6. Error handling

Use a consistent error representation from `api-contract.md`. Do not expose stack traces, SQL details, secrets, internal IPs or raw SSH/Docker output to end users. Log diagnostic details with request/job identifiers and redact sensitive values.

## 7. Security requirements

- Validate all external input at API boundaries with the shared Zod schemas; the same schemas drive
  client-side form validation so the two cannot drift.
- Authenticate with the opaque `ogulix_session` cookie. Sessions are stored server-side as a hash of
  the token and are revoked by deleting the row. Do not introduce JWT or refresh tokens.
- Hash passwords with Argon2id; never store plaintext.
- Accept only public HTTPS Git repositories. Reject URLs with embedded credentials and the
  `ssh://`, `git://` and `file://` schemes; the MVP stores no source-control credentials.
- Apply ownership checks to every application/deployment lookup and mutation.
- Encrypt environment-variable values at rest with AES-256-GCM using `ENV_ENCRYPTION_KEY`, which is
  outside source control and the database.
- Never accept arbitrary shell commands, Docker flags or host paths from users.
- Apply request size limits, rate limits and safe CORS configuration. State-changing requests must
  pass the `Origin` check described in `docs/design/decisions.md`.
- Keep MariaDB and Redis private; they are not public APIs.
- Record audit events for authentication and deployment operations.

## 8. Acceptance criteria

- Controllers contain no deployment orchestration logic.
- Services are testable without a live Express server.
- Repositories are the only normal path for Prisma access.
- Deployment requests enqueue jobs and return promptly.
- Authorization tests cover cross-user access attempts.
- Logs and error responses redact secrets.
