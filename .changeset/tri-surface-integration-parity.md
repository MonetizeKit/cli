---
"@monetizekit/cli": minor
---

Tri-surface integration parity (FRD-PO-006): new `clerk` command group (`status`, `inspect`, `connect`, `set-webhook-secret`, `import`, `disconnect`), new `posthog` command group (`status`, `preview`, `connect`, `drain`, `disconnect`), and `integrations list` — every integration the dashboard can manage is now manageable from the CLI via the `/api/v1/integrations/*` endpoints. Manage commands require the `integrations:manage` API-key scope (the legacy `settings:webhooks:manage` is still accepted).
