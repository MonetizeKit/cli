# Design Document: Init Scaffolding Depth

## Overview

Extend `src/lib/init.ts`'s `scaffoldMonetizekitProject()` with a new, separate `deepScaffoldProject()` step that runs after today's Shallow_Scaffold and only for `Supported_Framework` project types. Deep_Scaffold is implemented as a small set of named, single-purpose Codemods (one per Requirement 2–5), each independently skippable, rather than one monolithic "scaffold everything" function — this is what makes Requirement 6's per-step `applied`/`already-present`/`skipped` reporting and fail-closed behavior tractable.

## Architecture

### New module: `src/lib/deep-scaffold.ts`

```ts
export type DeepScaffoldStepStatus = "applied" | "already-present" | "skipped";

export interface DeepScaffoldStepResult {
  step: "providerWrap" | "middleware" | "webhookRoute" | "protectedExample";
  status: DeepScaffoldStepStatus;
  path?: string;
  reason?: string; // required when status === "skipped"
}

export interface DeepScaffoldResult {
  supported: boolean;
  steps: DeepScaffoldStepResult[];
}

export async function deepScaffoldProject(
  options: { projectRoot: string; projectType: ProjectType; dryRun: boolean },
): Promise<DeepScaffoldResult> {
  if (options.projectType !== "nextjs" && options.projectType !== "node") {
    return { supported: false, steps: [] };
  }

  const steps: DeepScaffoldStepResult[] = [];
  steps.push(await applyProviderWrap(options));      // Requirement 2
  steps.push(await applyMiddlewareScaffold(options)); // Requirement 3
  steps.push(await applyWebhookRouteScaffold(options)); // Requirement 4
  steps.push(await applyProtectedExample(options));   // Requirement 5
  return { supported: true, steps };
}
```

`src/commands/init.ts` calls `deepScaffoldProject()` after `scaffoldMonetizekitProject()` and merges `steps` into the command's JSON result (Requirement 6.3), alongside a new `--dry-run` flag threaded into every step.

### Codemod implementation: `ts-morph` over `jscodeshift`

`ts-morph` is chosen over `jscodeshift` for this repo because:
- It gives a typed, ergonomic API for the specific edits needed here (find a default-exported function/JSX return, insert a JSX wrapper, insert an import) without writing raw AST visitor boilerplate.
- The CLI already depends on TypeScript (`tsconfig.json`, dev dependency); `ts-morph` wraps the TypeScript compiler API directly, so no second parser/grammar is introduced.
- `jscodeshift`'s recast-based printer is tuned for large-scale one-off codebase migrations across many files; here each Codemod runs against exactly one target file per project, where preserving the user's exact formatting outside the touched region matters more than migration throughput.

### Requirement 2: Provider wrap (`applyProviderWrap`)

1. Locate the layout file: try `app/layout.tsx`, then `src/app/layout.tsx`; if neither exists, return `{ step: "providerWrap", status: "skipped", reason: "no app/layout.tsx or src/app/layout.tsx found" }` (Requirement 2.3).
2. Parse with `ts-morph`. If an import specifier `@monetizekit/react` already exists in the file, return `{ status: "already-present" }` (Requirement 2.2) without further edits — this is the Idempotent_Rerun check for this step.
3. Find the default-exported function's `return` statement. If it does not return a single recognizable JSX root element (e.g. it returns a conditional/fragment shape the Codemod does not special-case), return `{ status: "skipped", reason: "unrecognized layout return shape" }` (Requirement 2.3) — fail closed rather than guess.
4. Otherwise: insert `import { MonetizeKitProvider } from "@monetizekit/react";`, and wrap the existing root JSX element's children in `<MonetizeKitProvider>...</MonetizeKitProvider>`, preserving the original element and all its props/attributes unchanged.
5. Under `--dry-run`, compute the edit in memory and return the resulting file's unified diff (via `ts-morph`'s in-memory `getFullText()` before/after, diffed with a small diff library) instead of calling `.save()`.

### Requirement 3: Middleware scaffold (`applyMiddlewareScaffold`)

1. Determine the middleware path (`middleware.ts` or `src/middleware.ts`, matching whichever of `app/`/`src/app/` exists — mirroring the layout-detection logic from `applyProviderWrap`).
2. If the file does not exist: write a new file containing a `monetizekitMiddleware()` scaffold plus a marker comment (`// @monetizekit:middleware-start` / `-end`) delimiting the MonetizeKit-owned block, and a clearly commented placeholder for the user's own `matcher` config (Requirement 3.1).
3. If the file exists: search for the marker comment.
   - Present → `{ status: "already-present" }` (Idempotent_Rerun).
   - Absent → parse with `ts-morph`; if the file exports `config.matcher` in a shape the Codemod recognizes (a string or array-of-strings literal), append MonetizeKit's own matcher patterns into that array and insert the marker-delimited logic block above the existing `export default`; otherwise skip with reason `"existing matcher config not recognized"` (Requirement 3.3) — this is the one Codemod in this spec where "insert into an existing, unpredictable file" is inherently the highest-risk edit, so the fail-closed bar is strictest here.

### Requirement 4: Webhook route scaffold (`applyWebhookRouteScaffold`)

1. Target path: `app/api/webhooks/monetizekit/route.ts` (or `src/app/...`) for `nextjs`; `src/routes/monetizekit-webhooks.ts` (or equivalent Express convention detected from existing `src/routes/`) for `node`.
2. If the target file already exists, return `{ status: "already-present" }` (Requirement 4.3) — no Codemod merge attempted here, unlike Requirement 3's middleware case, because a webhook route handler is self-contained (nothing else in the project needs to import/reference it for it to work), so "already exists" is unambiguous evidence a prior run (or the user) already created it.
3. Otherwise, write a real handler implementing HMAC-SHA256 verification against `X-Monetizekit-Signature`/`X-Monetizekit-Timestamp` (header names, prefix format, and the `"{timestamp}.{rawBody}"` signing input all sourced from the same constants the Webhooks guide's contract tests assert against in `app-monetizekit-monorepo`'s `apps/docs/lib/docs/guide-facts.ts` — kept as a hand-synced constant here since these are two separate repos/release pipelines; Requirement 4.2's "cross-repo contract noted, not automated" caveat is exactly this: a person updating the signature scheme in one repo must remember to update the other, same as any other cross-repo API contract without a shared package).

### Requirement 5: Protected example (`applyProtectedExample`)

1. Target path: `app/monetizekit-example/page.tsx` (or `src/app/...`) for `nextjs`; `src/monetizekit-example.ts` for `node`.
2. If it exists, `{ status: "already-present" }` (Requirement 5.3) — same self-contained-file reasoning as Requirement 4.
3. Otherwise, write a minimal, real page/module calling `@monetizekit/react`'s entitlement hook (or `@monetizekit/node`'s equivalent client method) with `"REPLACE_WITH_YOUR_FEATURE_KEY"` and a comment explaining the placeholder (Requirement 5.2).

### `--dry-run` and diff output (Requirement 2.4, 6.2)

`deepScaffoldProject({ dryRun: true })` runs every step's detection/parsing logic identically, but every step that would write returns its computed new content instead of writing, and `src/commands/init.ts` renders a unified diff (new dependency: a small diff library, e.g. `diff`) per changed/created file, reusing the same rendering for both Deep_Scaffold and the existing Shallow_Scaffold file list (today's `init` has no `--dry-run` at all; this spec adds it for the whole command, not only Deep_Scaffold).

## Testing strategy

Fixture-based, not property-based, for the Codemods themselves (AST edits are best tested against representative real-world file shapes, not randomly generated ones):

- `tests/fixtures/deep-scaffold/nextjs-app-router/` — a handful of representative `app/layout.tsx` shapes (bare default export, export with other providers already wrapping children, export with a non-JSX-root return shape that must be skipped) and matching expected-output fixtures.
- `tests/fixtures/deep-scaffold/nextjs-middleware/` — no existing file, existing file without matcher, existing file with a recognized matcher, existing file with an unrecognized matcher (must skip).
- Unit tests run each `apply*()` function against a temp copy of each fixture and assert the resulting file content matches the expected-output fixture exactly (or, for skip cases, that the file is byte-for-byte unchanged and the reported `reason` matches).

Property tests (fits this repo's existing `fast-check` convention) for the parts that are genuinely property-shaped rather than fixture-shaped:

- **Property: Idempotent_Rerun produces zero diff** — for every fixture project, running `deepScaffoldProject()` twice in sequence results in the second run reporting every step as `already-present`/`skipped` and making zero file writes (assert via directory content hash before/after the second run).
- **Property: `--dry-run` never writes** — for every fixture project and every step, running with `dryRun: true` leaves the fixture directory byte-for-byte unchanged, regardless of what the computed diff says would change.
