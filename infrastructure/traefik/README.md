# Traefik configuration (not applied yet)

Traefik is the planned single public entry point on Server 1. Nothing in this
directory has been deployed, and no port has been verified as free.

## Hard constraints

- Do not bind Traefik to port 80. The existing Apache portfolio owns it.
- Do not expose MariaDB, Redis, the Docker API or SSH through this proxy.
- The listener port is a placeholder until IAAS confirms a free port and the
  origin is reachable from the machine running the Cloudflare Tunnel connector.

## Planned routing model

One origin serves both the dashboard and the API:

| Match                | Target                          |
| -------------------- | ------------------------------- |
| `PathPrefix('/api')` | Express API on `127.0.0.1:3001` |
| everything else      | Next.js on `127.0.0.1:3000`     |

Each deployed application gets its own hostname routed to the runtime node's
private address and its allocated host port (`30000-32767`).

## File provider

`dynamic/` is reserved for the file provider used to write per-application
routes. Route files are generated from validated deployment metadata, written
atomically, and validated before reload. The worker that performs this runs on
the same host, so route changes are local file operations, not remote commands.

## Status

| Item                                  | Status       |
| ------------------------------------- | ------------ |
| Listener port verified                | Not verified |
| Origin reachable from the tunnel host | Not verified |
| Configuration written                 | Not started  |
