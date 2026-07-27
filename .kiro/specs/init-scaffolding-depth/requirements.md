# Requirements Document

## Introduction

`monetizekit init` today (`src/commands/init.ts`, `src/lib/init.ts`) only writes new, additive files under a `.monetizekit/` directory: a `README.md`, a `.env.example`, a static `sdk.example.ts`, and (with `--stripe`) a static webhook-verification example. It never touches the user's actual application code. `monetizekit init sdk install` goes one step further (running the real package manager to add the SDK dependency) but still stops short of wiring the SDK into the project.

This is a materially shallower scaffolding experience than Clerk's `init`/onboarding flow, which — for a detected framework — edits the user's real files: injects `clerkMiddleware()` into `middleware.ts`, wraps the root layout in `<ClerkProvider>`, and scaffolds real sign-in/sign-up routes. Decision #8 in `docs/engineering/docs-platform-improvements-plan.md` confirms this gap should be closed with **full scaffolding capabilities immediately** (not staged/partial), for the frameworks MonetizeKit already has an SDK for.

## Glossary

- **Deep_Scaffold**: Scaffolding that edits or creates files inside the user's actual application source tree (e.g. `app/layout.tsx`, `middleware.ts`), as opposed to today's Shallow_Scaffold (files only under `.monetizekit/`).
- **Shallow_Scaffold**: The existing `.monetizekit/`-only behavior; this spec keeps it as the fallback for unsupported frameworks, not something it removes.
- **Supported_Framework**: A `ProjectType` (`src/lib/init.ts`) for which `@monetizekit/react` or `@monetizekit/node` is a real, published SDK today: `nextjs` and `node`. `go`, `python`, `java`, `generic` remain Shallow_Scaffold-only in this spec — there is no MonetizeKit SDK to wire into those languages yet, so a Deep_Scaffold for them would either be fake or require building an SDK first, which is out of scope for a CLI spec (tracked as a Non-Goal below, not silently dropped).
- **Codemod**: An idempotent, AST-aware source transformation (not blind string/regex replacement) applied to an existing file, implemented via `jscodeshift` or `ts-morph`.
- **Idempotent_Rerun**: Running `monetizekit init` a second time on an already-scaffolded project SHALL detect prior scaffolding and make no duplicate edits, rather than double-wrapping providers or re-inserting middleware.
- **Provider_Wrap**: Wrapping the framework's root component tree with `<MonetizeKitProvider>` from `@monetizekit/react`.
- **Webhook_Route_Scaffold**: A real (not `.example.ts`) route handler wired to the project's actual routing convention, implementing HMAC verification per the Webhooks guide's documented headers/algorithm.
- **Protected_Example**: A real page/route demonstrating an entitlement gate using the real SDK API (not documented in the abstract — an actual runnable example the user can immediately see working).

## Requirements

### Requirement 1: Framework detection drives scaffold depth

**User Story:** As a developer running `monetizekit init` in an existing project, I want the CLI to scaffold real, working integration code for my framework when one exists, so that I don't have to hand-translate example files myself.

#### Acceptance Criteria

1. THE CLI SHALL continue to use `detectProjectType()` (`src/lib/init.ts`) to classify the project, unchanged.
2. WHEN the detected `ProjectType` is a Supported_Framework, THE CLI SHALL perform Deep_Scaffold (Requirements 2–5) in addition to (not instead of) the existing Shallow_Scaffold `.monetizekit/` files.
3. WHEN the detected `ProjectType` is not a Supported_Framework, THE CLI SHALL fall back to today's Shallow_Scaffold-only behavior unchanged, and SHALL print a message naming which SDK/framework support would unlock Deep_Scaffold for this project type.
4. THE CLI SHALL NOT silently produce partial or fake Deep_Scaffold output for unsupported frameworks — Requirement 1.3's explicit fallback message is the only acceptable behavior for those cases (this is what "full capabilities immediately" excludes, per the spec's Non-Goals).

### Requirement 2: Provider wiring (Next.js App Router, `@monetizekit/react`)

**User Story:** As a developer with a Next.js App Router project, I want `monetizekit init` to wrap my app in the MonetizeKit provider automatically, so that I don't have to find and hand-edit my root layout.

#### Acceptance Criteria

1. WHEN `monetizekit init` runs on a detected `nextjs` project using the App Router (`app/layout.tsx` or `src/app/layout.tsx` exists), THE CLI SHALL apply a Codemod that wraps the layout's returned JSX children in `<MonetizeKitProvider>` imported from `@monetizekit/react`, preserving all existing JSX structure, props, and other providers already present.
2. IF the root layout already imports `MonetizeKitProvider` (Idempotent_Rerun), THEN THE CLI SHALL skip Requirement 2.1's edit and report `providerWrap: "already-present"` in its result rather than re-wrapping or erroring.
3. IF the Codemod cannot safely parse or locate a single unambiguous root layout (e.g. no `app/layout.tsx` found, or the file's export shape is unrecognized), THEN THE CLI SHALL skip the edit, report `providerWrap: "skipped"` with a reason, and continue with the rest of Deep_Scaffold rather than failing the whole command.
4. THE CLI SHALL support `--dry-run`, printing a unified diff of every file Deep_Scaffold would change without writing any of them.
5. Requirement 2 SHALL NOT apply to the Pages Router (`pages/_app.tsx`) in this spec's initial release — detected and reported the same way as Requirement 1.3's unsupported-framework message, tracked as follow-up in `tasks.md` rather than blocking this spec on it (Pages Router is legacy relative to the App Router, which `@monetizekit/react`'s own docs target first).

### Requirement 3: Middleware scaffolding (Next.js)

**User Story:** As a developer, I want `monetizekit init` to scaffold the middleware needed for entitlement-aware routing, so that protected routes work out of the box.

#### Acceptance Criteria

1. WHEN `monetizekit init` runs on a detected `nextjs` project, THE CLI SHALL create `middleware.ts` (or `src/middleware.ts`, matching the project's existing `app/`/`src/app/` layout) if it does not already exist, containing a MonetizeKit-aware middleware scaffold with a clearly marked, commented section for the user's own matcher/route config.
2. IF `middleware.ts` already exists, THEN THE CLI SHALL apply a Codemod inserting the MonetizeKit-specific logic into the existing file (preserving unrelated existing middleware logic) rather than overwriting it, and SHALL skip the insertion (Idempotent_Rerun) if MonetizeKit's marker comment is already present.
3. THE CLI SHALL warn (not fail) if it detects a conflicting `export const config = { matcher: ... }` it cannot safely merge, leaving the file untouched and reporting the conflict in the command's JSON result.

### Requirement 4: Webhook route scaffolding

**User Story:** As a developer, I want a real, working webhook endpoint scaffolded into my project, so that I can register it immediately instead of adapting an example file by hand.

#### Acceptance Criteria

1. WHEN `monetizekit init` runs on a Supported_Framework project, THE CLI SHALL create a real Webhook_Route_Scaffold at the framework's idiomatic location (`app/api/webhooks/monetizekit/route.ts` for `nextjs` App Router; an Express router file for `node`), replacing today's `.monetizekit/stripe/webhook-handler.example.ts`-style dead example with a file the project actually serves.
2. THE Webhook_Route_Scaffold SHALL implement HMAC-SHA256 signature verification matching the algorithm and header names documented in the Webhooks guide / `apps/docs/lib/docs/guide-facts.ts` in `app-monetizekit-monorepo` (cross-repo contract noted in `design.md`, not automated in this spec).
3. IF a file already exists at the target path, THEN THE CLI SHALL skip creating it (Idempotent_Rerun) and report `webhookRoute: "already-present"`, never overwriting user-modified code.
4. Requirement 4 replaces the `--stripe` flag's current scope (Stripe-specific webhook example) with the general MonetizeKit webhook route; Stripe-specific scaffolding (if still desired) is tracked as a separate follow-up task, not silently dropped.

### Requirement 5: Protected-route example

**User Story:** As a developer, I want a runnable example of an entitlement-gated route/component, so that I can see the SDK working end-to-end before wiring up my own business logic.

#### Acceptance Criteria

1. WHEN `monetizekit init` runs on a Supported_Framework project, THE CLI SHALL scaffold one Protected_Example file demonstrating an entitlement check using the real `@monetizekit/react` (`useEntitlement`/equivalent) or `@monetizekit/node` API, at a path clearly namespaced as MonetizeKit-owned (e.g. `app/monetizekit-example/page.tsx`) so it cannot collide with the user's own routes.
2. THE Protected_Example SHALL use a placeholder feature/entitlement key clearly marked as needing replacement (e.g. `"REPLACE_WITH_YOUR_FEATURE_KEY"`), not a real or guessed key.
3. IF the target path already exists, THEN THE CLI SHALL skip creation (Idempotent_Rerun) rather than overwrite a file the user may have since edited or renamed-in-place.

### Requirement 6: Idempotency and safety across the whole command

**User Story:** As a developer, I want to be able to re-run `monetizekit init` safely at any time, so that I can use it to "catch up" a project after upgrading the CLI without worrying about duplicated or corrupted code.

#### Acceptance Criteria

1. THE CLI SHALL make every Deep_Scaffold edit Idempotent_Rerun-safe: a second run on an already-scaffolded project SHALL report every already-applied step as skipped and SHALL make zero file changes, verified by a byte-for-byte diff of the project directory before/after the second run.
2. THE CLI SHALL support `--dry-run` for the full command (Shallow_Scaffold + Deep_Scaffold together), producing the same file list/diff output Requirement 2.4 specifies, extended to cover every file Deep_Scaffold would touch.
3. THE CLI's JSON result for `monetizekit init` SHALL report, per Deep_Scaffold step, one of `applied`, `already-present`, or `skipped` (with a reason for `skipped`) — never a bare boolean — so an agent or CI script can distinguish "nothing to do" from "something went wrong."
4. Codemods SHALL fail closed: if a Codemod cannot confidently apply an edit (ambiguous file shape, parse error), THE CLI SHALL skip that specific step (per Requirements 2.3/3.3) rather than applying a best-effort or partially-correct edit.

## Non-Goals

1. This spec does NOT build Deep_Scaffold support for `go`, `python`, or `java` project types — no MonetizeKit SDK exists for those languages today; scaffolding real integration code without a real SDK to call would be fake. Building those SDKs is separate, larger, out-of-repo work.
2. This spec does NOT scaffold Pages Router support in its initial release (Requirement 2.5) — tracked as explicit follow-up, not silently out of scope.
3. This spec does NOT remove or change today's Shallow_Scaffold `.monetizekit/` files — Deep_Scaffold is additive to them.
4. This spec does NOT implement a general-purpose codemod framework for third-party use — the Codemods here are specific, hand-written transforms for the exact files/patterns named in Requirements 2–4.
