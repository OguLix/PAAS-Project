# Pre-IAAS Sprint A Report

Status: implemented locally, awaiting human review.
Date: 2026-11-08.
Scope: contract freeze, shared DTOs, server-only foundation, Prisma schema/migration, local seed
foundation, tests and affected documentation.

## 1. What changed

- Froze the pre-IAAS API contract for deployment configuration, restart-as-new-attempt, one
  `RUNNING` deployment per application, archive `409 INVALID_STATE`, idempotency key plus request
  fingerprint, paginated deployment logs and stable error codes.
- Added browser-safe shared DTOs for deployments, deployment logs, runtime nodes, environment
  variable metadata and BullMQ job payloads.
- Added a server-only shared boundary at `@ogulix/shared/server/*` for Prisma, AES-256-GCM
  encryption, log redaction and deployment state guards. ESLint blocks frontend imports of that
  boundary and server-only dependencies.
- Added SSRF-oriented repository URL validation for public HTTPS repositories: no credentials,
  no non-default ports, no literal private/loopback/link-local/metadata hosts.
- Added platform-reserved environment-variable key validation.
- Extended `Application` with deployment configuration and `Deployment` with branch, request
  fingerprint, requester, and log counters. Added recovery indexes.
- Added an idempotent local seed for one admin and two explicitly mocked runtime nodes. Admin
  credentials come from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`; production seeding requires
  `SEED_ALLOW_PRODUCTION=true`.
- Added `RUNTIME_MODE=mock|iaas` to API and worker configuration and exposed it in `GET /health`.
- Added unit/contract tests for encryption, redaction, state guards, SSRF validation, reserved keys,
  deployment job payloads, environment validation and application configuration defaults.

## 2. Explicit non-goals

- No Sprint B, C or D work.
- No IAAS access, Docker run on IAAS, Cloudflare change, Proxmox change, Traefik change, DNS change
  or Apache change.
- No live deployment, real image build or real runtime-node operation.
- The seed was not executed because no disposable MariaDB/Redis instance was available.
- The migration was not executed against MariaDB 11.4; see verification limits below.

## 3. Verification performed

| Command | Result |
|---|---|
| `npm run db:generate` | Passed; Prisma Client v7.10.1 generated |
| `npm run db:validate` | Passed; schema valid |
| `prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code` | Passed with exit code 0; migrations and schema are in sync |
| `npm run typecheck` | Passed, including frontend `tsc --noEmit` |
| `npm run lint` | Passed |
| `npm run build` | Passed; Next.js production build completed |
| `npm test` | Passed: 30 root contract/security tests, 13 backend tests, 11 frontend tests |
| Prettier check on changed code files | Passed |
| Repo-wide `npm run format:check` | Still reports 45 pre-existing formatting issues in untouched files; not mass-reformatted |

## 4. Verification limits

- Docker is not installed in this agent environment, so the migration could not be applied to a
  disposable MariaDB 11.4 container. `prisma migrate diff` proves schema/migration parity, not SQL
  execution against MariaDB.
- `db:seed` was not run for the same reason. It type-checks and is wired as `npm run db:seed`.
- The repo-wide Prettier check includes files outside Sprint A that were already unformatted.
  Only changed Sprint A files were formatted to avoid an unrelated mass rewrite.

## 5. Follow-up required before Sprint B

1. Run `npm run db:migrate:dev` against a disposable MariaDB 11.4 instance and inspect the applied
   schema.
2. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in a local `.env`, then run `npm run db:seed` and
   verify the admin can sign in and both mock nodes appear as `ONLINE`.
3. Review the frozen contract and migration before approving Sprint B.

## 6. Suggested commit message

`feat(pre-iaas): freeze sprint A contract and data foundation`
