# Docker control plane (local)

The repository root `Dockerfile` and `docker-compose.yml` run the **control plane** on one machine:
the Next.js dashboard, the Express API, the BullMQ worker, MariaDB, Redis and a one-shot Prisma
migration runner.

They are not a deployment plan for the IAAS VMs. Applying this stack to Server 1, Server 2 or
Server 3 requires a separate, approved change. Nothing here replaces Traefik, the Cloudflare Tunnel,
Apache on Server 1, or the runtime-node setup.

## Boundaries

| Concern | This stack | User applications |
|---|---|---|
| Build input | Root `Dockerfile` | The application repository's own `Dockerfile` |
| Built by | `docker compose build` | The worker/BuildKit adapter on a runtime node |
| Runs on | The local control-plane host | Server 2 / Server 3 |
| Published ports | `127.0.0.1:3000`, `127.0.0.1:3001` | Runtime nodes, per approved ingress |

The root `Dockerfile` must never be reused as an application template.

## Services

| Service | Image target | Port | Notes |
|---|---|---|---|
| `frontend` | `frontend` | `127.0.0.1:3000` | Next.js standalone server, no Nginx |
| `backend` | `backend` | `127.0.0.1:3001` | Express API, healthcheck on `/api/v1/ready` |
| `worker` | `worker` | none | BullMQ worker; healthcheck pings Redis |
| `migrate` | `migrate` | none | One-shot `prisma migrate deploy`, runs as `node` |
| `seed` | `seed` | none | Optional, `tools` profile, runs as `node` |
| `mariadb` | `mariadb:11.4` | internal only | Named volume `mariadb-data` |
| `redis` | `redis:7.4-alpine` | internal only | AOF persistence, named volume `redis-data` |

`backend`, `worker` and `migrate` reach the data services by service name
(`mariadb:3306`, `redis:6379`). They never use `localhost`, which inside a container points at the
container itself.

## Prerequisites

- Docker Engine with Compose v2.17 or newer (`service_completed_successfully` dependency).
- A filled `.env` in the repository root:

  ```sh
  cp .env.example .env
  ```

  Every placeholder must be replaced. `ENV_ENCRYPTION_KEY` must be base64-encoded 32 bytes, for
  example `openssl rand -base64 32`. Never commit the filled file; `.dockerignore` keeps it and any
  other `.env*` file out of the image.

## Architecture notes

- **Multi-stage, multi-target.** `deps` installs with `npm ci`, `build` compiles `shared`, generates
  the Prisma client, builds the API and worker with `tsc -b`, then runs `next build`. `prod-deps`
  installs runtime dependencies with `npm ci --omit=dev`. Each service copies only what it needs.
- **Next.js is served by Node.** `output: 'standalone'` in `frontend/next.config.ts` produces
  `.next/standalone/frontend/server.js`, which the `frontend` target runs as `node
  frontend/server.js`. Static hosting through Nginx would break routing, image optimisation and the
  App Router.
- **The API URL is a build argument.** `NEXT_PUBLIC_API_BASE_URL` is inlined by Next.js at build
  time. Compose passes it as a build arg and the browser reaches the API through the published
  `localhost:3001` port. Changing it requires `docker compose build frontend`.
- **`NODE_ENV=development` locally.** The backend rejects a plain-HTTP `APP_ORIGIN` when
  `NODE_ENV=production`. Local Compose therefore runs `backend`, `worker` and `migrate` with
  `NODE_ENV=development` and `APP_ORIGIN=http://localhost:3000`. A real deployment sets
  `NODE_ENV=production` and an HTTPS origin.
- **No Mock API.** The dashboard always calls the real API. `services/mock/auth.mock.ts` is a test
  fixture and is not imported by application code. `RUNTIME_MODE=mock` is a worker setting and is
  unrelated to the removed dashboard mock mode.
- **Restart policy and health.** `mariadb` and `redis` are health-gated; `backend`, `worker` and
  `frontend` wait on `service_healthy` or `service_completed_successfully`. Containers get no static
  `container_name`, so Compose can scale and recreate them.
- **The API healthcheck is a readiness check.** `backend` calls `/api/v1/ready`, which returns `503`
  until `SELECT 1` succeeds and `REDIS_URL` is configured. The endpoint contract is unchanged:
  `/api/v1/health` still reports liveness only. As a result a backend with a broken database stays
  `starting`/`unhealthy` and `frontend` never receives traffic from a half-ready API.
- **Redis persists the queue.** Redis runs with AOF (`appendonly yes`, `appendfsync everysec`) on the
  `redis-data` volume, so queued jobs survive container recreation and `docker compose down`.
  RDB snapshots are disabled (`--save ""`) so there is one persistence format. `maxmemory-policy`
  stays `noeviction` because BullMQ requires it.
- **The worker fails fast instead of idling without a queue.** It keeps a single Redis client,
  reconnects with a bounded budget (10 attempts, exponential backoff 1s → 5s) and, when the budget is
  exhausted, exits with a non-zero code so `restart: unless-stopped` recovers it. Its Compose
  healthcheck performs a real `PING` from inside the container, so a lost queue connection is
  reported as `unhealthy` rather than hidden by a live process. No password, full URL or credential is
  ever logged.
- **Migration and seed are unprivileged.** `migrate` and `seed` run as the `node` user. They only read
  the schema/migrations and talk to MariaDB over the network, so root is never required.
- **No secrets in images.** The build context excludes `.env`, private keys and local databases. No
  secret is placed in a `NEXT_PUBLIC_*` variable, because those are compiled into the browser bundle.

### Prisma 7 client in the images

Prisma 7.10.1 has no `postinstall` lifecycle script, so `npm ci --omit=dev` neither generates nor
overwrites a client. The flow is:

1. `build` runs `prisma generate` and asserts `node_modules/.prisma/client/index.js` exists.
2. `prod-deps` installs runtime dependencies only; the `prisma` CLI is a dev dependency and is not
   present.
3. `backend` copies the generated `node_modules/.prisma` from `build` on top of the production
   `node_modules`. `@prisma/client` resolves `.prisma/client` at require time, so the generated client
   is the one that runs.
4. `migrate` and `seed` come from `build` because they need the CLI and the TypeScript runner.

## Commands

```sh
# Build and start everything
docker compose up --build

# Detached
docker compose up --build -d

# Follow logs for one service
docker compose logs -f backend

# Rebuild one target after a code change
docker compose build backend && docker compose up -d backend

# Apply migrations only
docker compose run --rm migrate

# Optional: seed a local database
docker compose --profile tools run --rm seed

# Stop the stack, keeping the MariaDB and Redis volumes
docker compose down

# Stop and delete BOTH volumes on purpose (local database and queue reset)
docker compose down -v
```

`docker compose down` never deletes `mariadb-data` or `redis-data`. Because Redis uses AOF, an
unfinished or queued job is still there after a recreate. `down -v` is the only supported way to wipe
local state; it is destructive and must never be run against anything but a disposable environment.

Checking the stack:

```sh
curl http://localhost:3001/api/v1/health   # liveness
curl http://localhost:3001/api/v1/ready    # readiness: database + queue configured
curl http://localhost:3000/                # dashboard
docker compose ps                          # health of every service
```

Checking Redis persistence and policy:

```sh
docker compose exec redis redis-cli ping
docker compose exec redis redis-cli CONFIG GET appendonly          # expect: appendonly yes
docker compose exec redis redis-cli CONFIG GET appendfsync          # expect: appendfsync everysec
docker compose exec redis redis-cli CONFIG GET maxmemory-policy     # expect: noeviction
docker compose exec redis redis-cli CONFIG GET dir                  # expect: /data
```

The dashboard is at `http://localhost:3000`.

## Relationship to `infrastructure/docker/compose.dev.yml`

`compose.dev.yml` is unchanged and still starts only MariaDB and Redis for host-based development
(`npm run dev:backend`, `npm run dev:worker`, `npm run dev:frontend`). Use it when you want fast
TypeScript reloads. Use the root stack when you need the real container wiring.

The two files use different Compose project names (`ogulix-control-plane` and
`ogulix-paas-dev`), and both bind host ports `3306`/`6379` only in the dev file. Do not run them at
the same time if `compose.dev.yml` already holds those ports.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `migrate` exits non-zero | `DATABASE_URL` built from `MARIADB_*` is wrong, or MariaDB is not healthy yet |
| `backend` restarts with an environment error | A placeholder in `.env` was not replaced, or `ENV_ENCRYPTION_KEY` is not base64 32 bytes |
| Login returns a connection error | `NEXT_PUBLIC_API_BASE_URL` does not match the published API port; rebuild `frontend` |
| Login returns CORS/`APP_ORIGIN` errors | `APP_ORIGIN` is not exactly the browser origin (`http://localhost:3000`) |
| Passwords with `@`, `:` or `/` fail | Those characters must be URL-encoded in the `mysql://` URL |
| `frontend` unhealthy | The standalone server did not start; check `docker compose logs frontend` |
| `backend` stays unhealthy while `curl /api/v1/health` works | `/ready` is failing: check MariaDB and `DATABASE_URL` with `docker compose logs backend` |
| `worker` is `unhealthy` or restarting | Redis is unreachable from the worker container; check `docker compose logs worker` for `queue reconnect` / `worker exiting without a queue connection` |
| Queue is empty after `docker compose down` | Expected only if `-v` was used; AOF survives a normal `down` |
| `migrate`/`seed` permission denied | They run as `node`; a mounted or rebuilt path is not readable by uid 1000 |

## Not covered here

- Installing Docker on the IAAS VMs.
- Traefik, Cloudflare Tunnel, DNS or Access changes.
- Running migrations against a production database.
- Building or scheduling user applications (that is the worker's deployment adapter, not this stack).
