# @monetizekit/cli

## 0.2.0

### Minor Changes

- 78d336e: Add agent-mode parity: `--mode agent` global flag (forces deterministic, non-interactive, JSON output and fails fast instead of prompting), `--input-json`/`--input-json-schema` global flags with a `resolveInput()` helper rolled out to `catalog * create/update`, `customers create/update`, `entitlements simulate`, `usage submit`, and `config patch`, plus new `config schema`/`config patch` commands backed by Zod schemas, RFC 7396 JSON Merge Patch, and an atomic config writer.
- 0a5cc79: Tri-surface integration parity (FRD-PO-006): new `clerk` command group (`status`, `inspect`, `connect`, `set-webhook-secret`, `import`, `disconnect`), new `posthog` command group (`status`, `preview`, `connect`, `drain`, `disconnect`), and `integrations list` — every integration the dashboard can manage is now manageable from the CLI via the `/api/v1/integrations/*` endpoints. Manage commands require the `integrations:manage` API-key scope (the legacy `settings:webhooks:manage` is still accepted).
