# Database Design

## 1. Database technology

-   Database: MariaDB
-   ORM: Prisma
-   Schema and migrations: Prisma Migrate
-   Database host target: Server 1
-   Network access: local/private only; never public

Use a MariaDB version supported by the selected Prisma version and pin
the chosen server image/package version during implementation.

Use a MariaDB version supported by the selected Prisma version and pin
the chosen server image/package version during implementation. Local
development uses the MariaDB 11.4 container from the local compose file;
the Server 1 package version is pinned to the same major version so
migrations are validated against the engine that will run them.

## 2. Initial entities

  -----------------------------------------------------------------------
  Entity                  Purpose                 Important fields
  ----------------------- ----------------------- -----------------------
  User                    Platform account        id, email,
                                                  passwordHash, role,
                                                  createdAt

  Session                 Revocable login         id, userId, tokenHash,
                          session                 expiresAt, lastSeenAt,
                                                  revokedAt

  Application             Deployable application  id, ownerId, name,
                                                  sourceRepository,
                                                  defaultBranch, status

  RuntimeNode             Registered VM           id, name, host,
                                                  sshPort, status,
                                                  capacity metadata

  Deployment              One build/release       id, applicationId,
                          attempt                 runtimeNodeId,
                                                  commitSha,
                                                  imageReference,
                                                  imageDigest,
                                                  allocatedPort,
                                                  idempotencyKey,
                                                  status, timestamps

  DeploymentLog           Bounded build output    id, deploymentId,
                                                  sequence, level,
                                                  stream, message,
                                                  createdAt

  Domain                  Hostname assigned to    id, applicationId,
                          app                     hostname, status

  EnvironmentVariable     App configuration       id, applicationId, key,
                          metadata                encryptedValue,
                                                  isSecret

  AuditEvent              Security-sensitive      id, actorId, action,
                          action history          resourceType,
                                                  resourceId, requestId,
                                                  createdAt
  -----------------------------------------------------------------------

`auditEvent.actorId` is nullable because failed logins have no actor. Use
foreign keys and indexes for ownership, application lookups, deployment
history and node scheduling queries. The full index list is in
`database-erd.md`.

## 3. Data rules

-   Every application belongs to an owner or authorized project.
-   Every API query that reads or changes an application must enforce
    ownership/role checks.
-   Deployment records are append-oriented history; do not overwrite
    historical source revisions or image digests.
-   Store immutable image digests in deployment records.
-   Store secrets encrypted at application level; the encryption key
    must be outside the database and source repository.
-   Never return decrypted secret values in ordinary API responses.
-   Redact secret values from worker logs and audit events.
-   Use UTC timestamps in storage and convert for display in the
    frontend.

## 4. Prisma conventions

-   The schema lives at `backend/prisma/schema.prisma` with its migrations in
    `backend/prisma/migrations/`. Prisma requires schema and migrations to stay together, so the root
    `database/` directory holds only pointers, seeds and backup notes. This was approved in
    `docs/design/decisions.md`.
-   Prisma model fields are `camelCase` and map to `snake_case` columns with `@map`/`@@map`. Do not
    add ad-hoc case translation anywhere else.
-   Use Prisma enums for `UserRole`, `ApplicationStatus`, `NodeStatus`, `DeploymentStatus` and
    `DomainStatus`, verified against a throwaway MariaDB 11.4 database.
-   Commit migration files, never commit production database dumps or
    credentials.
-   Use migrations for schema changes; do not rely on `db push` for
    production deployment. `db push` is acceptable only against a disposable local database.
-   Test migrations against a disposable database before applying them
    to the live instance.
-   Back up MariaDB before production migrations and document restore
    verification.

## 5. Retention and backups

Retention is fixed in `docs/design/decisions.md`: deployment logs are kept for 30 days and capped at
2000 lines or 200 KB per deployment; audit events are kept for 180 days. Runtime container stdout is
not persisted at all.

Back up MariaDB and document runtime-node image retention. The initial
MVP has no central registry. A backup is not considered verified until
a restore test has succeeded.
