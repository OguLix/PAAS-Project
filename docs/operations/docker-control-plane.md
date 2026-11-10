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
| `backend` | `backend` | `127.0.0.1:3001` | Express API, `/api/v1/health` |
| `worker` | `worker` | none | BullMQ worker; readiness is the Redis connection |
| `migrate` | `migrate` | none | One-shot `prisma migrate deploy` |
| `seed` | `seed` | none | Optional, `tools` profile only |
| `mariadb` | `mariadb:11.4` | internal only | Named volume `mariadb-data` |
| `redis` | `redis:7.4-alpine` | internal only | `noeviction`, no persistence |

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
- **No secrets in images.** The build context excludes `.env`, private keys and local databases. No
  secret is placed in a `NEXT_PUBLIC_*` variable, because those are compiled into the browser bundle.

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

# Stop, keeping the database volume
docker compose down

# Stop and delete local data
docker compose down -v
```

Checking the stack:

```sh
curl http://localhost:3001/api/v1/health
curl http://localhost:3001/api/v1/ready
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

## Not covered here

- Installing Docker on the IAAS VMs.
- Traefik, Cloudflare Tunnel, DNS or Access changes.
- Running migrations against a production database.
- Building or scheduling user applications (that is the worker's deployment adapter, not this stack).
