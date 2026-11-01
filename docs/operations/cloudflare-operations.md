# Cloudflare Operations

## 1. Purpose and ownership

This document covers public ingress for OguLix PaaS through the existing Cloudflare Tunnel connector, which currently runs as a Windows service. The assigned owner is the **Frontend Engineer & Cloudflare/Edge Infrastructure Engineer**, working in coordination with the IAAS member.

The IAAS member owns the private origin: VM/network readiness and server-side Traefik. The Cloudflare owner owns the public DNS/Tunnel configuration for the new PaaS hostnames. Neither role may independently modify existing unrelated routes.

## 2. Domain plan

| Hostname | Intended destination | Status / rule |
|---|---|---|
| `server1.ogulix.tech` | Existing Apache portfolio on Server 1 | Existing; preserve unchanged |
| `pve.ogulix.tech` | Proxmox VE | Existing; preserve protection and route |
| Existing SSH hostnames | Existing SSH access routes | Preserve unchanged |
| `paas.ogulix.tech` | Server 1 Traefik listener | Proposed; add only after origin verification |
| `*.apps.ogulix.tech` | Server 1 Traefik listener | Proposed; wildcard DNS and Tunnel ingress are not configured yet |

The exact Traefik origin port is not fixed by this document. The example port 8080 is only a candidate and must be verified as free by IAAS. Never route Traefik to Apache's existing port 80.

Traefik exposes a single origin for the control plane: `/api/*` is routed internally to the Express API and all other paths to Next.js. The tunnel therefore needs one origin URL for `paas.ogulix.tech`, not separate entries for the dashboard and the API.

## 3. Change prerequisites

Before changing Cloudflare configuration, obtain confirmation from IAAS that:

- Traefik is installed/configured and healthy on Server 1 (or another explicitly agreed origin).
- Its listener binds to the intended private interface/address and verified port.
- Apache portfolio still serves normally on port 80.
- Traefik can route a test hostname to a test application on Server 2 or Server 3.
- Firewall rules allow only the intended origin traffic.
- The exact origin URL has been tested from the Windows machine running the tunnel connector.

The Cloudflare owner must also capture the current tunnel configuration safely (without exposing tokens) and record existing ingress rules before editing.

## 4. DNS and Tunnel are separate

DNS makes the hostname resolvable through Cloudflare. Tunnel ingress maps a hostname to a private origin service through the connector. Both sides must be configured consistently. A wildcard DNS record alone does not create a Tunnel ingress rule, and a Tunnel ingress rule alone does not guarantee the hostname resolves.

Proposed additions:

- `paas.ogulix.tech` -> the existing tunnel -> verified Traefik origin URL.
- `*.apps.ogulix.tech` -> the existing tunnel -> the same verified Traefik origin URL.

Do not create or change records for the existing portfolio, Proxmox or SSH hostnames as part of this task.

## 5. Safe change procedure

1. Obtain explicit approval for the exact new hostnames and origin URL.
2. Export/record the current tunnel ingress configuration securely; redact tokens and account secrets from all notes.
3. Add only the two new PaaS hostname rules. Preserve existing rules and their behavior. Keep specific hostnames ahead of catch-all rules.
4. Add the matching DNS records using the existing tunnel's supported Cloudflare workflow. Confirm whether the dashboard manages DNS automatically or requires a separate record; do not assume.
5. Validate configuration syntax before reload/restart.
6. Apply the change through the approved Windows service/configuration procedure. Do not restart or replace the tunnel service unnecessarily.
7. Test `paas.ogulix.tech`, one sample `*.apps.ogulix.tech` hostname, and every existing hostname affected by the connector.
8. Record date, change, operator, test evidence and rollback result.

Do not paste a Tunnel token, API token, private key or full secret-bearing configuration into Git, issue trackers or chat. Use placeholders in examples.

## 6. Cloudflare Access

If `paas.ogulix.tech` should be restricted to team members, configure an Access application/policy for that hostname after confirming the intended identity provider and allowed users. Do not automatically apply the same policy to `*.apps.ogulix.tech`: deployed user applications may need public access. Decide dashboard and app access policies separately.

Access policy changes must be reviewed with the project owner and tested for both authorized and unauthorized sessions. Never weaken the existing `pve.ogulix.tech` protection.

## 7. Rollback

If a new PaaS route fails:

- Remove or disable only the newly added PaaS ingress rule(s) and matching DNS record(s).
- Restore the previous tunnel configuration if the new config causes a broader regression.
- Re-validate existing portfolio, Proxmox and SSH hostnames.
- Keep the PaaS origin private until the issue is fixed.
- Record the failure and rollback evidence.

Do not delete or rewrite the entire tunnel configuration as a rollback shortcut.

## 8. Acceptance checklist

- [ ] IAAS confirmed Traefik origin address and port.
- [ ] Apache portfolio remains available on `server1.ogulix.tech`.
- [ ] Existing Proxmox route and Access protection remain unchanged.
- [ ] Existing SSH hostnames still work.
- [ ] `paas.ogulix.tech` reaches the PaaS dashboard through the tunnel.
- [ ] A sample `*.apps.ogulix.tech` hostname reaches the correct runtime app.
- [ ] MariaDB, Redis, SSH and Docker API are not publicly reachable.
- [ ] Change and rollback procedures are documented.
