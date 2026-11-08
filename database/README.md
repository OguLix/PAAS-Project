# Database

The Prisma schema and migrations live in `backend/prisma/`, not here. Prisma
requires the schema and its `migrations/` directory to stay together inside the
package that generates the client, so a second copy under `database/migrations/`
was rejected in `docs/design/decisions.md`.

| Item               | Location                                                        |
| ------------------ | --------------------------------------------------------------- |
| Schema             | `backend/prisma/schema.prisma`                                  |
| Migrations         | `backend/prisma/migrations/`                                    |
| Local dev services | `infrastructure/docker/compose.dev.yml`                         |
| Local seed         | `backend/src/scripts/seed.ts`                                   |
| Model reference    | `docs/design/database-erd.md`, `docs/design/database-design.md` |

This directory is for documentation and backup notes only. The executable local seed lives in
`backend/src/scripts/seed.ts` because it uses the backend Prisma client and Argon2.

Run `npm run db:seed --workspace @ogulix/backend` after migrations with `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD` set in the environment. The seed never contains a hardcoded admin password and
refuses `NODE_ENV=production` unless `SEED_ALLOW_PRODUCTION=true`.

The initial migration was generated from the Prisma schema. Before applying it, validate it against
a disposable MariaDB 11.4 instance. Use `npm run db:migrate:dev --workspace @ogulix/backend` only
with a local development database and `npm run db:migrate:deploy --workspace @ogulix/backend` only
after the documented backup and review steps. An agent must not run either command against an IAAS
database.

## Reminders

- Never run migrations against a live database from an agent session.
- Back up MariaDB before any production migration and verify a restore.
- Never commit database dumps or credentials.
