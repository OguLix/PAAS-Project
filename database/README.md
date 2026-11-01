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
| Model reference    | `docs/design/database-erd.md`, `docs/design/database-design.md` |

This directory is for documentation, seed data and backup notes only.

The initial migration was generated from the Prisma schema. Before applying it, validate it against
a disposable MariaDB 11.4 instance. Use `npm run db:migrate:dev --workspace @ogulix/backend` only
with a local development database and `npm run db:migrate:deploy --workspace @ogulix/backend` only
after the documented backup and review steps. An agent must not run either command against an IAAS
database.

## Reminders

- Never run migrations against a live database from an agent session.
- Back up MariaDB before any production migration and verify a restore.
- Never commit database dumps or credentials.
