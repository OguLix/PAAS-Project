# Tests

Cross-package and contract tests live here. Package-specific unit tests belong
next to their source once features exist.

| Level                               | Location                  | Status      |
| ----------------------------------- | ------------------------- | ----------- |
| Contract (shared types and schemas) | `tests/contracts.test.ts` | Implemented |
| API unit and integration            | `backend/`                | Not started |
| Worker and adapter tests            | `worker/`                 | Not started |
| Frontend UI and contract tests      | `frontend/`               | Not started |
| End-to-end                          | `tests/`                  | Not started |

Run with `npm test` from the repository root. The script builds the shared
package first, because the tests import the compiled `@ogulix/shared` output.

No test may target the live IAAS VMs, the live Cloudflare account or a
production database.
