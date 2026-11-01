# Scripts

No operational script is implemented in the scaffold.

Planned contents, each requiring human review before use:

| Script        | Purpose                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| `ogulix-node` | The restricted runtime-node helper installed on Server 2 and Server 3. Reads one allowlisted verb plus JSON on stdin. |

Rules for anything added here:

- No script may accept a shell string composed from user input.
- No script may be invoked through an unrestricted root session.
- Nothing here may modify Apache, Proxmox, existing Cloudflare routes or SSH
  configuration.
