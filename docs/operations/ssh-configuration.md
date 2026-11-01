# SSH Configuration

## 1. Purpose

The control plane/worker uses SSH to request a small set of approved
runtime operations on Server 2 and Server 3. SSH is an infrastructure
adapter, not a user-facing terminal.

## 2. Credential requirements

-   Create a dedicated deployment account on each runtime node.
-   Use a dedicated key pair for the PaaS service.
-   Do not reuse a personal SSH key.
-   Do not store private keys in Git.
-   Restrict key file permissions and access to the worker process.
-   Prefer source-IP restrictions and private-network access where
    supported.
-   Rotate credentials and document revocation.

## 3. Command boundary

Do not accept shell command strings from dashboard users. The backend
maps validated operations to a small allowlist, and the allowlist is
enforced on the node, not only in application code.

The `authorized_keys` entry used by the worker must pin a forced command:

```text
command="/usr/local/bin/ogulix-node",no-pty,no-port-forwarding,no-agent-forwarding,no-x11-forwarding ssh-ed25519 AAAA... ogulix-worker
```

With this entry the key cannot request a shell, a PTY or a tunnel. The
helper reads one verb plus a JSON payload on stdin and accepts only:

-   `node-info` — node health and resource usage
-   `build` — run the approved BuildKit build with timeout and cache limits
-   `container-upsert` — create or replace a platform-managed container
-   `container-start`
-   `container-stop`
-   `container-inspect` — container state
-   `container-remove` — after authorization checks
-   `logs` — bounded, redacted log retrieval
-   `cleanup` — remove build workspace and dangling build cache

Container names, image references, ports, environment values and
resource limits must be validated and constructed by trusted code. Use
argument-safe process invocation inside the helper and avoid shell
interpolation entirely. Unknown verbs are rejected before any process is
spawned.

The protocol types live in `shared/contracts/node-protocol.ts`.

## 4. Privilege model

Do not grant unrestricted root login for routine operations. If Docker
group membership is used, document that membership is effectively highly
privileged and protect the credential accordingly. The forced-command
helper is mandatory in this design: it is the mechanism that keeps the
credential from becoming an interactive shell.

## 5. Verification

-   Test authentication from the worker host.
-   Test that the account can perform only intended operations.
-   Test that unauthorized commands are rejected.
-   Test credential revocation.
-   Confirm secrets do not appear in command logs or application logs.
