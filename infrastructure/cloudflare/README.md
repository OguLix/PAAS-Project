# Cloudflare configuration (documentation only)

No Cloudflare change has been applied. This directory holds reviewed templates
and checklists from `docs/operations/cloudflare-operations.md`.

## Rules

- AI agents and the API must never modify the live Cloudflare account, DNS,
  Tunnel ingress or Access policies. A human applies those changes.
- Existing routes for the portfolio, Proxmox and SSH hostnames are preserved
  unchanged.
- Never write a Tunnel token, API token, account identifier or tunnel UUID into
  this repository, logs or documentation. Use placeholders.
- `paas.ogulix.tech` and `*.apps.ogulix.tech` are added only after IAAS confirms
  the Traefik origin address, port and reachability from the Windows tunnel host.
- DNS and Tunnel ingress are separate concerns; both must be configured and
  tested.

## Files

| File                         | Purpose                                                      |
| ---------------------------- | ------------------------------------------------------------ |
| `tunnel-ingress.example.yml` | Placeholder fragment showing only the two new PaaS hostnames |
