# syntax=docker/dockerfile:1.7
#
# OguLix PaaS control-plane image.
#
# This file builds ONLY the control plane: the Next.js dashboard, the Express
# API, the BullMQ worker and the one-shot Prisma migration runner.
#
# It is NOT a template for user applications. Applications deployed by OguLix
# are built from their own repository Dockerfile by the worker/BuildKit adapter.
#
# Targets:
#   backend  - Express API            (node backend/dist/server.js)
#   worker   - BullMQ worker          (node worker/dist/index.js)
#   frontend - Next.js standalone     (node frontend/server.js)
#   migrate  - prisma migrate deploy  (one-shot)
#   seed     - prisma seed script     (one-shot, local tools only)
#
# Build one target explicitly, for example:
#   docker build --target backend -t ogulix/control-plane-backend:local .

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ---------------------------------------------------------------------------
# Full dependency install, used for building and for the one-shot Prisma tools.
# `npm ci` is required: the repository commits package-lock.json (lockfile v3).
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/package.json
COPY backend/package.json ./backend/package.json
COPY worker/package.json ./worker/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# Build: shared contracts, Prisma client, API, worker and the Next.js bundle.
# NEXT_PUBLIC_API_BASE_URL is inlined by Next.js at build time, so it must be a
# build argument and not only a runtime variable.
# ---------------------------------------------------------------------------
FROM deps AS build
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

COPY tsconfig.base.json tsconfig.json ./
COPY shared ./shared
COPY backend ./backend
COPY worker ./worker
COPY frontend ./frontend

RUN npm run db:generate
RUN npm run build

# ---------------------------------------------------------------------------
# Production dependencies only. The Prisma client is generated in `build` and
# copied separately, so the postinstall generate step is skipped here.
# ---------------------------------------------------------------------------
FROM base AS prod-deps
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=1
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/package.json
COPY backend/package.json ./backend/package.json
COPY worker/package.json ./worker/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --omit=dev --no-audit --no-fund

# ---------------------------------------------------------------------------
# One-shot migration runner. Needs the Prisma CLI, the schema and the
# migrations folder, so it is built from the full `build` stage.
# ---------------------------------------------------------------------------
FROM build AS migrate
CMD ["npm", "run", "db:migrate:deploy", "--workspace", "@ogulix/backend"]

# ---------------------------------------------------------------------------
# One-shot seed runner. Only used with the optional `tools` compose profile.
# ---------------------------------------------------------------------------
FROM build AS seed
CMD ["npm", "run", "db:seed", "--workspace", "@ogulix/backend"]

# ---------------------------------------------------------------------------
# Express API
# ---------------------------------------------------------------------------
FROM base AS backend
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=node:node shared/package.json ./shared/package.json
COPY --from=build --chown=node:node /app/shared/dist ./shared/dist
COPY --chown=node:node backend/package.json ./backend/package.json
COPY --from=build --chown=node:node /app/backend/dist ./backend/dist
USER node
WORKDIR /app/backend
EXPOSE 3001
CMD ["node", "dist/server.js"]

# ---------------------------------------------------------------------------
# BullMQ worker. The worker does not use Prisma, so no generated client here.
# ---------------------------------------------------------------------------
FROM base AS worker
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node shared/package.json ./shared/package.json
COPY --from=build --chown=node:node /app/shared/dist ./shared/dist
COPY --chown=node:node worker/package.json ./worker/package.json
COPY --from=build --chown=node:node /app/worker/dist ./worker/dist
USER node
WORKDIR /app/worker
CMD ["node", "dist/index.js"]

# ---------------------------------------------------------------------------
# Next.js dashboard. Next.js is never served by Nginx: the standalone server
# handles routing, image optimisation and the App Router.
# ---------------------------------------------------------------------------
FROM base AS frontend
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/frontend/.next/standalone ./
COPY --from=build --chown=node:node /app/frontend/.next/static ./frontend/.next/static
COPY --from=build --chown=node:node /app/frontend/public ./frontend/public
USER node
EXPOSE 3000
CMD ["node", "frontend/server.js"]
