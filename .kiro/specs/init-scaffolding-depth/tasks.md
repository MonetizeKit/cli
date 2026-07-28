# Implementation Plan: Init Scaffolding Depth

## Overview

Build one Codemod step at a time, each fully tested (fixtures + idempotency property tests) before starting the next, since each is independently shippable and independently risky (editing a user's real files). Wire into `init.ts` only after all four steps exist, so the command-level integration task is a small, low-risk final step.

## Tasks

- [x] 1. Scaffolding for the scaffolding: shared infrastructure
  - [x] 1.1 Add `ts-morph` and `diff` dependencies
  - [x] 1.2 Create `src/lib/deep-scaffold.ts` with `DeepScaffoldStepResult`/`DeepScaffoldResult` types and the `deepScaffoldProject()` shell (unsupported-project-type short-circuit only, no steps yet)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 1.3 Add shared layout/middleware-path detection helper (`app/` vs `src/app/`) reused by steps 2–5
  - [x] 1.4 Write property test: unsupported project types always return `{ supported: false, steps: [] }`
    - _Requirements: 1.3, 1.4_

- [x] 2. Requirement 2: Provider wrap Codemod
  - [x] 2.1 Build fixture set (`tests/fixtures/deep-scaffold/nextjs-app-router/`): bare layout, layout with existing providers, unrecognized-shape layout
  - [x] 2.2 Implement `applyProviderWrap()` per `design.md`
  - [x] 2.3 Fixture tests: bare/with-providers cases produce expected wrapped output; unrecognized-shape case is skipped with a reason and the file is byte-for-byte unchanged
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 2.4 Add `--dry-run` diff computation for this step
    - _Requirements: 2.4_
  - [x] 2.5 Write property test: Idempotent_Rerun (running `applyProviderWrap()` twice makes zero additional changes)
    - **Property: Idempotent_Rerun produces zero diff**
    - _Requirements: 2.2_

- [x] 3. Checkpoint — Ensure all tests pass

- [x] 4. Requirement 3: Middleware Codemod
  - [x] 4.1 Build fixture set (`tests/fixtures/deep-scaffold/nextjs-middleware/`): no file, file without matcher, file with recognized matcher array, file with unrecognized matcher shape
  - [x] 4.2 Implement `applyMiddlewareScaffold()` per `design.md`, including the marker-comment idempotency check
  - [x] 4.3 Fixture tests for all four cases
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 4.4 Write property test: Idempotent_Rerun for this step

- [x] 5. Checkpoint — Ensure all tests pass

- [x] 6. Requirement 4: Webhook route scaffold
  - [x] 6.1 Hand-sync the HMAC verification constants (header names, signature prefix, signing input format) against `app-monetizekit-monorepo`'s `apps/docs/lib/docs/guide-facts.ts` as of this task's implementation date; note the sync date in a code comment so a future drift is at least detectable by inspection
    - _Requirements: 4.2_
  - [x] 6.2 Implement `applyWebhookRouteScaffold()` for `nextjs` (App Router route handler)
    - _Requirements: 4.1, 4.3_
  - [x] 6.3 Implement `applyWebhookRouteScaffold()` for `node` (Express router file)
    - _Requirements: 4.1, 4.3_
  - [x] 6.4 Fixture/unit tests: file-does-not-exist creates the real handler; file-exists is skipped with `already-present`
  - [x] 6.5 Decide and implement the Requirement 4.4 follow-up (Stripe-specific webhook scaffolding via a flag, if still wanted) or explicitly close it as no-longer-needed
    - **Decision:** closed as no-longer-needed for this spec, tracked as a follow-up (see below) rather than implemented now. Requirement 4 already replaces the `--stripe` flag's *effective* role (a real webhook endpoint) with the general MonetizeKit webhook route for Supported_Framework projects; per the ground rule not to change existing Shallow_Scaffold behavior, the `--stripe` flag's existing `.monetizekit/stripe/webhook-handler.example.ts` output is left untouched rather than removed or altered. A dedicated Stripe-specific *Deep_Scaffold* webhook variant (e.g. gated by `--stripe` writing to the real webhook route path with Stripe's own signature scheme instead of MonetizeKit's) remains a distinct, separately-scoped follow-up.

- [x] 7. Requirement 5: Protected example
  - [x] 7.1 Implement `applyProtectedExample()` for `nextjs` and `node`
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 7.2 Fixture/unit tests: creation case and already-present case

- [x] 8. Checkpoint — Ensure all tests pass

- [x] 9. Command integration (`src/commands/init.ts`)
  - [x] 9.1 Add `--dry-run` flag; call `deepScaffoldProject()` after `scaffoldMonetizekitProject()`; merge `steps` into the JSON result
    - _Requirements: 6.2, 6.3_
  - [x] 9.2 Render unified diffs for `--dry-run` across both Shallow_Scaffold and Deep_Scaffold file changes
    - _Requirements: 2.4, 6.2_
  - [x] 9.3 Add the Requirement 1.3 fallback message for unsupported project types
    - _Requirements: 1.3_
  - [x] 9.4 Write end-to-end property test: full-command Idempotent_Rerun across all four steps combined, against each fixture project
    - **Property: Idempotent_Rerun produces zero diff (full command)**
    - **Property: `--dry-run` never writes**
    - _Requirements: 6.1, 6.2, 6.4_

- [x] 10. Checkpoint — Ensure all tests pass

- [x] 11. Documentation
  - [x] 11.1 Update README's `init` section describing Deep_Scaffold behavior per Supported_Framework, `--dry-run`, and the per-step status reporting
  - [x] 11.2 Update `init` command's oclif `summary`/flag descriptions

## Explicit follow-ups (not blocking this spec, tracked so they aren't lost)

- Pages Router support for Requirement 2 (Non-Goal #2 in `requirements.md`)
- Deep_Scaffold for `go`/`python`/`java` once/if a MonetizeKit SDK exists for them (Non-Goal #1)
- Stripe-specific Deep_Scaffold webhook route (Requirement 4.4 follow-up, decided in task 6.5): today's `--stripe` flag still only produces the existing Shallow_Scaffold `.monetizekit/stripe/webhook-handler.example.ts`; a real, served Stripe-signature-verifying route (as opposed to MonetizeKit's own webhook route from Requirement 4) has not been built
