# Implementation Plan: Agent-Mode Parity

## Overview

Ship in dependency order: global flags + `BaseCommand` plumbing first (everything else depends on `agentMode`/`resolveInput` existing), then `config schema`/`config patch` (self-contained, good first proof of the `--input-json` pattern), then the repo-wide Interactive_Prompt audit, then `--input-json` rollout to the remaining in-scope commands.

## Tasks

- [ ] 1. `--mode agent` global flag and `BaseCommand` plumbing
  - [ ] 1.1 Add `mode` flag to `BaseCommand.globalFlags`; add protected `agentMode: boolean` field set in `init()`
    - _Requirements: 1.1, 1.2, 1.3_
  - [ ] 1.2 Add the `--mode agent` + conflicting `--output table` structured-conflict error
    - _Requirements: 1.2_
  - [ ] 1.3 Write property test: Agent_Mode implies JSON output (see `design.md` testing strategy)
    - **Property: Agent_Mode implies JSON output**
    - _Requirements: 1.2, 1.3_

- [ ] 2. `--input-json` global flag and `resolveInput()` helper
  - [ ] 2.1 Add `zod-to-json-schema` dependency
  - [ ] 2.2 Add `input-json` flag to `BaseCommand.globalFlags`; add `readInputJson()` helper (inline string or `-` → stdin)
    - _Requirements: 2.1_
  - [ ] 2.3 Add `resolveInput<T>()` on `BaseCommand` (schema validation, field-path error mapping, flags/`--input-json` mutual-exclusion check)
    - _Requirements: 2.2, 2.3, 2.4, 2.5_
  - [ ] 2.4 Add `--input-json-schema` handling in `init()` (print schema, skip `run()`)
    - _Requirements: 2.6_
  - [ ] 2.5 Write property tests: mutual exclusion, schema-print-never-executes
    - **Property: `--input-json` and flags are mutually exclusive**
    - **Property: `--input-json-schema` never executes the command**
    - _Requirements: 2.3, 2.4, 2.6_

- [ ] 3. `config schema` and `config patch`
  - [ ] 3.1 Replace hand-written `CliConfig`/`Profile` interfaces in `src/lib/config.ts` with Zod schemas (`CliConfigSchema`, `ProfileSchema`) + `z.infer` type aliases
  - [ ] 3.2 Add `ConfigManager.writeAtomic()` (temp-file + rename)
    - _Requirements: 4.3_
  - [ ] 3.3 Add `src/commands/config/schema.ts`
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ] 3.4 Add `src/commands/config/patch.ts` (`--input-json` required, `--dry-run`, RFC 7396 merge patch via a merge-patch dependency, validate-before-write)
    - _Requirements: 4.1, 4.2, 4.4, 4.5_
  - [ ] 3.5 Write property tests: validation failure never writes, atomic write never leaves partial state
    - **Property: Config_Patch validation failure never writes**
    - **Property: Config_Patch atomic write**
    - _Requirements: 4.2, 4.3_

- [ ] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Repo-wide Interactive_Prompt audit (Requirement 1.4, 1.6)
  - [ ] 5.1 Audit every `@inquirer/prompts` call site and every `--yes`-gated destructive command (`catalog * delete`, `entitlements overrides clear`, `entitlements overrides set`, `workspace use`, `auth login`) for its actual missing-input condition
  - [ ] 5.2 For each, add the Agent_Mode-or-non-TTY fast-fail check per `design.md`'s pattern, naming the specific flag that would have supplied the input
  - [ ] 5.3 Add the structured `error` object (`code`, `message`, `remediation`) to every exit path touched by 5.2
    - _Requirements: 1.4, 1.5, 1.6_
  - [ ] 5.4 Write an integration-style test per audited command asserting Agent_Mode + missing required input exits `2` without hanging (bounded timeout in the test itself, so a regression that reintroduces a prompt fails the test suite instead of hanging CI)
    - _Requirements: 1.4, 1.6_

- [ ] 6. `--input-json` rollout to in-scope commands
  - [ ] 6.1 `catalog products/plans/features/addons/meters create` + `update`
  - [ ] 6.2 `customers create` + `update`
  - [ ] 6.3 `entitlements simulate`
  - [ ] 6.4 `usage submit`
    - _Requirements: 2.7_
  - [ ] 6.5 Write per-command property test: `--input-json` produces the same result as the equivalent flags (round-trip equivalence)
    - **Property: `--input-json` and flag input are equivalent**
    - _Requirements: 2.2, 2.5_

- [ ] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Documentation
  - [ ] 8.1 Update README with `--mode agent`, `--input-json`, `config schema`, `config patch` sections + runnable examples
    - _Requirements: 5.1_
  - [ ] 8.2 Update command `--help` summaries/descriptions for the four capabilities
    - _Requirements: 5.1_
  - [ ] 8.3 Cut a release; hand the released version number to whoever picks up the `app-monetizekit-monorepo` "for AI agents" prose work (decision #6 unblock)
    - _Requirements: 5.2_
