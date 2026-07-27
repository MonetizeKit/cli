# Design Document: Agent-Mode Parity

## Overview

Extend `BaseCommand` with two new global flags (`--mode`, `--input-json`) and add a new `config` command topic (`schema`, `patch`). All four capabilities reuse existing infrastructure — `OutputManager`, `ExitCodeMapper`, `ConfigManager` — rather than introducing a parallel system, so `--mode human` (default) behavior is provably unchanged.

## Architecture

### `--mode agent`: threading through `BaseCommand`

```ts
// src/lib/base-command.ts
static globalFlags = {
  ...
  mode: Flags.string({ description: "Execution mode", options: ["human", "agent"], default: "human" }),
  "input-json": Flags.string({ description: "Structured input as a JSON string, or '-' for stdin" }),
};

async init(): Promise<void> {
  ...
  const agentMode = flags.mode === "agent";

  if (agentMode && flags.output && flags.output !== "json") {
    this.error(/* structured conflict error */, { exit: ExitCode.InvalidArgs });
  }

  this.output = new OutputManager({
    json: Boolean(flags.json) || agentMode,
    quiet: Boolean(flags.quiet),
    noColor: Boolean(flags["no-color"]),
    output: agentMode ? "json" : (flags.output as OutputFormat | undefined),
  });

  this.progress = new ProgressIndicator({ json: Boolean(flags.json) || agentMode, quiet: Boolean(flags.quiet) });
  this.agentMode = agentMode; // new protected field, read by commands with Interactive_Prompt paths
}
```

### Suppressing `Interactive_Prompt`s under Agent_Mode

Every current Interactive_Prompt call site is already gated behind a resolvable condition (missing `--key`, missing `--yes`); Agent_Mode does not add new gating logic, it makes the **existing** "would I have to prompt?" check also fire when `this.agentMode` is true, not only when `!process.stdout.isTTY`:

```ts
// src/commands/auth/login.ts (pattern; not the literal current implementation)
protected requiresInteractivePrompt(): boolean {
  return !flags.key; // the actual missing-input condition, unchanged
}

async run() {
  if (this.requiresInteractivePrompt() && (this.agentMode || !process.stdin.isTTY)) {
    this.error("auth login requires --key when not running interactively.", { exit: ExitCode.InvalidArgs });
  }
  ...
}
```

A repo-wide audit of `@inquirer/prompts` call sites and `--yes`-gated destructive commands is task-tracked in `tasks.md` (Requirement 1.6) rather than solved by one shared abstraction, since each command's actual missing-input condition differs (a "confirm" prompt vs. a "select workspace" prompt need different non-interactive fallbacks).

### `--input-json` and `Command_Input_Schema`

Commands already validate flags/args by hand or via oclif's `Flags`/`Args` declarations. Requirement 2.5 requires the JSON Schema and the runtime validator to be the same source of truth. Approach:

1. For each command in scope (Requirement 2.7's list), define a Zod schema for its logical input (the same shape whether it arrives via flags or `--input-json`), e.g.:

   ```ts
   // src/commands/customers/create.ts
   const CustomersCreateInput = z.object({
     externalId: z.string(),
     email: z.string().email().optional(),
     name: z.string().optional(),
     metadata: z.record(z.unknown()).optional(),
   });
   ```

2. `BaseCommand` gains a helper `resolveInput<T>(schema: z.ZodType<T>, flags, args): T`:
   - If `--input-json` is set: parse (or read stdin for `-`), `schema.safeParse()`, and on failure map every Zod issue to `{ path, message }` and exit `7` (Requirement 2.3).
   - If `--input-json` is not set: build the equivalent object from oclif flags/args, then still run it through `schema.safeParse()` so behavior is identical either way.
   - If both are set: exit `2` (Requirement 2.4) before either path runs.
3. `<command> --input-json-schema` is a new flag handled in `BaseCommand.init()` before the command's `run()` executes: if present, call `zodToJsonSchema(schema)` (the `zod-to-json-schema` package, new dependency) and print via `this.output.result()`, then return without invoking `run()`.

### `config schema`

```ts
// src/commands/config/schema.ts
import { zodToJsonSchema } from "zod-to-json-schema";
import { CliConfigSchema } from "../../lib/config.js"; // new: Zod schema mirroring `CliConfig`

export default class ConfigSchemaCommand extends BaseCommand {
  async run(): Promise<void> {
    this.output.result(zodToJsonSchema(CliConfigSchema, "CliConfig"), "1.0.0");
  }
}
```

`src/lib/config.ts` gains a `CliConfigSchema` Zod schema alongside the existing `CliConfig` TypeScript interface (Requirement 3.2's "same types" constraint is satisfied by generating the TS type from the Zod schema via `z.infer<typeof CliConfigSchema>`, replacing the hand-written interface, rather than maintaining both by hand).

### `config patch`

```ts
// src/commands/config/patch.ts
export default class ConfigPatchCommand extends BaseCommand {
  static flags = { ...BaseCommand.globalFlags, "dry-run": Flags.boolean({ default: false }) };

  async run(): Promise<void> {
    const { flags } = await this.parse(ConfigPatchCommand);
    if (!flags["input-json"]) this.error("config patch requires --input-json.", { exit: ExitCode.InvalidArgs });

    const patch = JSON.parse(await this.readInputJson(flags["input-json"])); // handles "-" stdin
    const current = this.configManager.load();
    const merged = applyMergePatch(current, patch); // RFC 7396, e.g. the `json-merge-patch` package

    const result = CliConfigSchema.safeParse(merged);
    if (!result.success) {
      this.output.result({ errors: result.error.issues.map(toFieldError) }, "1.0.0");
      this.exit(ExitCode.ValidationFailed);
    }

    if (flags["dry-run"]) {
      this.output.result(result.data, "1.0.0");
      return;
    }

    this.configManager.writeAtomic(result.data); // new: temp-file + rename, replacing any direct write
  }
}
```

`ConfigManager` gains `writeAtomic()`: write to `${configPath}.tmp-${pid}`, `fsync`, then `renameSync` over the real path — satisfying Requirement 4.3 without changing `load()`/existing callers.

### Why no automated cross-repo contract test (Requirement 5.2)

The two repos (`cli`, `app-monetizekit-monorepo`) are separate npm/pnpm workspaces with independent release cadences; there is no existing mechanism (in either repo, as surveyed) that pins one repo's CI to assert a specific *published* version of the other. Enforcing "docs only reference `--mode agent` once a released CLI version implements it" automatically would require either a new artifact (e.g. the docs repo depending on `@monetizekit/cli` as an npm dependency purely to read its version, which it does not otherwise need) or a manual release-notes-linked checklist. This design defers that enforcement mechanism as a follow-up decision for whoever picks up the docs-side prose work post-this-spec, rather than inventing cross-repo CI plumbing speculatively here.

## Testing strategy

Following this repo's existing convention (`tests/unit/*.property.test.ts`, Vitest + `fast-check`), add:

- **Property: Agent_Mode implies JSON output** — for any command and any combination of `--json`/`--output`, `--mode agent` results in `OutputManager` configured with `json: true`.
- **Property: `--input-json` and flags are mutually exclusive** — for any in-scope command, supplying both exits `2` before any side effect (assert via a spy that the command's core logic function was never called).
- **Property: `--input-json-schema` never executes the command** — for any in-scope command, calling with `--input-json-schema` never invokes the mocked API client.
- **Property: Config_Patch validation failure never writes** — for any patch document that fails `CliConfigSchema`, the config file's mtime/contents are unchanged after `config patch` runs.
- **Property: Config_Patch atomic write** — simulate a process kill between temp-file write and rename (or directly unit-test `writeAtomic()`'s two-step behavior); the original config file is never observed in a partially-written state.
