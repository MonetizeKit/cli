# Requirements Document

## Introduction

The `apps/docs` documentation site (in the `app-monetizekit-monorepo` repo) wants a "for AI agents" prose pattern describing how an autonomous coding agent — not a human at a terminal — should drive the MonetizeKit CLI: fully deterministic, non-interactive, structured-input/structured-output, self-describing. That prose pattern is explicitly gated on this spec (decision #6 in `docs/engineering/docs-platform-improvements-plan.md`): **docs may only describe a CLI capability once it is real**. Today, three of the four capabilities that prose would need to reference do not exist:

- `--mode agent` (a global flag forcing deterministic, non-interactive behavior)
- `--input-json` (a global flag accepting one structured JSON blob instead of many individual flags)
- `config schema` / `config patch` (commands to introspect and non-interactively mutate the CLI's own config file)

The CLI already has some of the raw material this depends on: global `--json`/`--output json|yaml|table` output, `--quiet`, `--debug`, `--trace`, and consistent `ExitCode` mapping (`src/lib/exit-codes.ts`). This spec extends that foundation rather than replacing it.

## Glossary

- **Agent_Mode**: The behavior activated by the global `--mode agent` flag — no interactive prompts, no spinners/animations, structured JSON errors, and hard failure (never a hang) on any code path that would otherwise wait on a TTY.
- **Input_JSON**: A single JSON document, supplied via `--input-json <value>` or `--input-json -` (read from stdin), that supplies a command's entire parameter set in one shot instead of individual flags/positional args.
- **Command_Input_Schema**: The JSON Schema describing the shape `--input-json` accepts for a given command, derived from the same Zod validators the command already uses (or newly added ones), so the schema and the runtime validation can never drift from each other.
- **Config_Schema**: The JSON Schema for `CliConfig` (`src/lib/config.ts`: `activeProfile`, `profiles`, `telemetry`), printed by `monetizekit config schema`.
- **Config_Patch**: A JSON Merge Patch (RFC 7396) document applied to the config file by `monetizekit config patch`, validated against Config_Schema before being written.
- **Interactive_Prompt**: Any code path that calls `@inquirer/prompts` or otherwise blocks on stdin (e.g. destructive-op confirmation, `auth login` browser flow).
- **TTY_Fallback**: Existing behavior where a command already refuses to prompt when `process.stdout`/`stdin` is not a TTY (referenced in the CLI survey as "prerun requires `--workspace` or `MONETIZEKIT_WORKSPACE` when not a TTY"); Agent_Mode SHALL generalize this existing pattern to every remaining prompt, not introduce a second, inconsistent mechanism.

## Requirements

### Requirement 1: `--mode agent` global flag

**User Story:** As an autonomous coding agent operating the CLI on a user's behalf, I want a single flag that guarantees the CLI will never block waiting for interactive input, so that I can run any command unattended without deadlocking.

#### Acceptance Criteria

1. THE CLI SHALL support a global flag `--mode <human|agent>` on `BaseCommand.globalFlags`, defaulting to `human`.
2. WHEN `--mode agent` is set, THE CLI SHALL behave as if `--json` were also set (Agent_Mode implies JSON output), even if `--output table` is separately requested — in that conflicting case THE CLI SHALL exit with code `2` and a structured error explaining the conflict, rather than silently picking one.
3. WHEN `--mode agent` is set, THE CLI SHALL disable all spinners/progress animations (the same suppression `ProgressIndicator` already applies for `--quiet`/`--json`).
4. WHEN `--mode agent` is set AND a command would otherwise invoke an Interactive_Prompt, THE CLI SHALL instead exit immediately with code `2` and a structured error identifying which flag(s) would have supplied the missing input non-interactively (e.g. `auth login` under Agent_Mode without `--key` SHALL error naming `--key`, not open a browser; a destructive op under Agent_Mode without `--yes` SHALL error naming `--yes`, not prompt for confirmation).
5. WHEN `--mode agent` is set, THE CLI SHALL include a machine-actionable `error` object in JSON error output with fields `code` (matching the existing `ExitCode` name), `message`, and `remediation` (reusing `formatRemediationMessage()` where applicable), so an agent can act on a failure without parsing human prose.
6. THE CLI SHALL apply Agent_Mode's prompt-suppression uniformly across every existing command that has an Interactive_Prompt today (`auth login`, any `--yes`-gated destructive command), not only newly written commands.

### Requirement 2: `--input-json` global flag

**User Story:** As an autonomous coding agent, I want to supply a command's entire input as one JSON document, so that I don't have to generate and shell-escape a long, error-prone sequence of individual CLI flags.

#### Acceptance Criteria

1. THE CLI SHALL support a global flag `--input-json <value>` accepting either an inline JSON string or the literal value `-` (read the JSON document from stdin).
2. WHEN `--input-json` is provided, THE CLI SHALL validate the parsed document against that command's Command_Input_Schema before executing any side-effecting logic.
3. IF the provided document fails schema validation, THEN THE CLI SHALL exit with code `7` (validation failed) and a structured error listing every failing field's JSON Pointer path and the validation message — not just the first failure.
4. WHEN `--input-json` is provided together with individual flags/args for the same command, THE CLI SHALL treat this as a usage conflict and exit with code `2`, rather than silently letting one silently override the other.
5. THE CLI SHALL derive each command's Command_Input_Schema from the same Zod validators used for that command's existing flags/args (via `zod-to-json-schema` or equivalent), so the schema and runtime validation cannot drift apart.
6. THE CLI SHALL expose a command's Command_Input_Schema on demand via `<command> --input-json-schema` (printing the schema and exiting 0 without executing the command), so an agent can discover the expected shape without out-of-band documentation.
7. Requirement 2 SHALL apply first to commands whose current parameter surface is genuinely multi-field and error-prone to flag-ify (`catalog * create/update`, `customers create/update`, `entitlements simulate`, `usage submit`, `config patch`); commands with zero or one parameter (e.g. `version`, `auth status`) are exempt since `--input-json` provides no value there — tracked per-command in `tasks.md`.

### Requirement 3: `config schema` command

**User Story:** As an autonomous coding agent, I want to ask the CLI what its own configuration looks like, so that I can generate or validate a config file without reading source code.

#### Acceptance Criteria

1. WHEN `monetizekit config schema` is executed, THE CLI SHALL print the Config_Schema (JSON Schema for `CliConfig`) to stdout and exit `0`.
2. THE Config_Schema SHALL be generated from the same TypeScript types (`CliConfig`, `Profile`) `ConfigManager` already uses, so it cannot describe a config shape the CLI does not actually accept.
3. `monetizekit config schema` SHALL work identically under `--mode agent`, `--mode human`, `--json`, and default output — it is a pure read with no destructive/interactive path to suppress.

### Requirement 4: `config patch` command

**User Story:** As an autonomous coding agent, I want to apply a partial update to the CLI's config file non-interactively, so that I can set up a profile or toggle telemetry without an interactive wizard.

#### Acceptance Criteria

1. WHEN `monetizekit config patch --input-json <patch>` is executed, THE CLI SHALL apply the given document as a JSON Merge Patch (RFC 7396) against the current `CliConfig` and write the result back to the config file.
2. THE CLI SHALL validate the patched result against Config_Schema before writing; IF validation fails, THEN THE CLI SHALL exit with code `7` and leave the existing config file byte-for-byte unmodified.
3. THE CLI SHALL write the config file atomically (write to a temp file in the same directory, then rename), so a crash or concurrent write during `config patch` SHALL NOT leave a partially-written or corrupted config file.
4. WHEN `monetizekit config patch --input-json <patch> --dry-run` is executed, THE CLI SHALL print the resulting config (post-patch, pre-validation-failure) without writing it, and exit `0` (or `7` if the dry-run result itself fails validation).
5. `config patch` SHALL be a genuine Interactive_Prompt-free command by construction (Requirement 1 does not need to suppress anything here) — it SHALL always require `--input-json`, and SHALL exit with code `2` if omitted, in both `--mode human` and `--mode agent`.

### Requirement 5: Docs-facing truthfulness

**User Story:** As a docs platform maintainer, I want a clear, checkable signal that every CLI capability the docs describe actually exists, so the "for AI agents" prose never makes a false claim again (the prior incident this decision follows from: a false `npx skills add` claim in `agent-prompt.ts`).

#### Acceptance Criteria

1. Once Requirements 1–4 are implemented and released, THE CLI's README and `--help` output SHALL document `--mode agent`, `--input-json`, `config schema`, and `config patch` with runnable examples.
2. THE `app-monetizekit-monorepo` docs platform SHALL NOT ship any guide prose referencing `--mode agent`, `--input-json`, `config schema`, or `config patch` until a released CLI version implementing this spec is published (tracked as a cross-repo dependency, not enforced by an automated check in this spec — see `design.md` for why a cross-repo contract test is out of scope here).

## Non-Goals

1. This spec does NOT add a general plugin/extension mechanism for third-party commands to declare their own Command_Input_Schema — only first-party commands listed in Requirement 2.7.
2. This spec does NOT change the existing `--json`/`--output` flags' behavior in `--mode human` (default) — Agent_Mode is strictly additive.
3. This spec does NOT implement the actual "for AI agents" docs prose — that is `app-monetizekit-monorepo` work, sequenced after this spec ships (per decision #6).
