# Scaffold Report

Milestone: repository initialization (`docs/implementation/initialization-blueprint.md`).
Date: 2026-11-01.
Status: complete and verified locally. No product feature was implemented, no live
infrastructure was touched, no Git operation was performed.

## 1. Created structure

| Path | Contents |
|---|---|
| `package.json`, `tsconfig.json`, `tsconfig.base.json` | npm workspace root, solution tsconfig, shared compiler options |
| `.env.example`, `.gitignore`, `.prettierrc`, `.prettierignore`, `.nvmrc`, `eslint.config.mjs`, `vitest.config.mts` | tooling and placeholder configuration |
| `shared/` | `types/api.ts`, `types/deployment-status.ts`, `types/node-protocol.ts`, `contracts/api.ts`, `contracts/domain.ts`, `index.ts` |
| `backend/` | `src/app.ts`, `src/server.ts`, `src/config/env.ts`, `src/common/logger.ts`, `src/common/http/response.ts`, `prisma/schema.prisma`, `prisma.config.ts` |
| `worker/` | `src/index.ts`, `src/config/env.ts`, `src/logging.ts` |
| `frontend/` | App Router shell (`src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`), `src/lib/api-client.ts`, `next.config.ts`, PostCSS/Tailwind config |
| `infrastructure/docker/compose.dev.yml` | local-only MariaDB 11.4 and Redis |
| `infrastructure/traefik/` | routing model and status notes, empty `dynamic/` for the file provider |
| `infrastructure/cloudflare/` | rules and a placeholder ingress fragment |
| `infrastructure/scripts/` | notes only; no executable script yet |
| `database/README.md` | pointer to `backend/prisma/` |
| `tests/contracts.test.ts`, `tests/README.md` | contract tests for shared types and schemas |

`docs/` was left in place and extended; no generated summary replaced it.

## 2. Versions

| Dependency | Version | Note |
|---|---|---|
| Node.js | 24.21.0 installed | `.nvmrc` pins 22; `engines` allows `>=22` |
| npm | 11.19.0 | workspaces |
| TypeScript | 5.9.3 | `latest` is 7.0.2, but `typescript-eslint` requires `<6.1.0` |
| Next.js / React | 16.4.3 / 19.3.1 | current stable |
| Express | 5.3.0 | current stable |
| Prisma CLI / Client | 7.10.1 | `latest` wrongly points at `8.0.0-rc.29`; pinned to the stable `prev` tag |
| Zod | 4.6.7 | shared API and form validation |
| BullMQ / ioredis | 6.5.3 / 5.11.1 | declared, not yet connected |
| ESLint | 9.39.5 | ESLint 10 exists; 9 is still supported by `typescript-eslint` |
| Vitest | 5.0.5 | |
| Tailwind CSS | 4.3.3 | `@tailwindcss/postcss`, no component library |

## 3. Commands executed

| Command | Result |
|---|---|
| `npm install` | 390 packages installed |
| `npm run typecheck` | Passed: shared, backend, worker and frontend |
| `npm run lint` | Passed, no findings |
| `npm test` | 13 tests passed |
| `npm run format:check` | Passed |
| `npm run build` | Passed: `tsc -b` plus `next build` (2 routes, standalone output) |
| `npm run db:validate` | `The schema at prisma/schema.prisma is valid` |
| `npm run db:generate` | Prisma Client 7.10.1 generated |
| `node dist/server.js` smoke test | `/api/v1/health` 200, `/api/v1/ready` 503 with per-check reasons, unknown route 404 with error envelope |
| `node dist/index.js` smoke test | Worker logs readiness, warns that no processor is registered, stays alive |

## 4. Assumptions and deviations

1. **Prisma 7 removed `url` from `schema.prisma`.** The connection URL now lives in
   `backend/prisma.config.ts` and is optional there so validation works without a database. Recorded
   in `docs/design/decisions.md` section 4.1.
2. **Prisma 7 requires a driver adapter at client construction.** No repository exists yet, so the
   scaffold does not instantiate a client. The first data-access milestone must add
   `@prisma/adapter-mariadb` with the `mariadb` driver.
3. **Prisma enums compile but are not yet migration-proven.** `prisma validate` accepts the native
   enums. The "one throwaway migration against MariaDB 11.4" proof is still outstanding because no
   local database was started.
4. **`database/` holds a pointer, not migrations.** Approved deviation from the blueprint tree.
5. **npm 11 blocked install scripts** for `prisma`, `@prisma/engines`, `esbuild` and
   `msgpackr-extract`. Validation, generation, build and tests all worked, so the scripts were not
   approved unattended. If a later step needs the engines, run `npm install-scripts approve <pkg>`
   after review.
6. **Node 24 is installed locally** while the decision pins a Node 22 baseline. `engines` accepts
   both; nothing in the scaffold depends on 24-only behaviour.
7. **Next.js rewrote `frontend/tsconfig.json`** (`jsx: react-jsx` and a `.next/dev/types` include).
   This is framework normalization, not a manual override.
8. **Vitest config uses `.mts`** to avoid Vite's CommonJS/ESM config warning.
9. **Request-id handling is local middleware**, not an external dependency. Express 5 was chosen
   directly; no compatibility shim is present.
10. **`backend/prisma.config.ts` is outside `backend/src`**, so it is linted but not included in the
    backend `tsc -b` project.

## 5. Deliberately not implemented

- Authentication, sessions, registration and authorization.
- Application, deployment, domain, environment-variable and node endpoints.
- BullMQ processors, scheduler, SSH/BuildKit/Docker/Traefik adapters.
- Dashboard screens beyond a status page; no component library.
- Any database migration, any IAAS access, any Cloudflare change, any Traefik deployment.
- The `ogulix-node` helper.

## 6. Items awaiting human confirmation

| Item | Owner |
|---|---|
| Validate one Prisma migration against a disposable MariaDB 11.4 container | Backend 1 |
| Decide whether local Docker Compose may be used on the dev machine | Backend 1 / IAAS |
| Confirm the Node baseline: stay on 22 LTS or move the decision to 24 LTS | Backend 1 |
| Select the UI component library before feature UI work | Frontend 1 |
| Verify the Traefik listener port and origin reachability from the Windows tunnel host | IAAS with Cloudflare owner |
| Measure the Server 1 memory budget per service | IAAS |

## 7. Suggested commit message

```
chore: scaffold OguLix PaaS workspace with shared contracts and Prisma schema
```
