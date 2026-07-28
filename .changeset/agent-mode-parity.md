---
"@monetizekit/cli": minor
---

Add agent-mode parity: `--mode agent` global flag (forces deterministic, non-interactive, JSON output and fails fast instead of prompting), `--input-json`/`--input-json-schema` global flags with a `resolveInput()` helper rolled out to `catalog * create/update`, `customers create/update`, `entitlements simulate`, `usage submit`, and `config patch`, plus new `config schema`/`config patch` commands backed by Zod schemas, RFC 7396 JSON Merge Patch, and an atomic config writer.
