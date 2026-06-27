import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { checkDestructiveGuard } from "../../src/lib/destructive-guard.js";

describe("destructive guard property tests", () => {
  // Feature: monetizekit-cli, Property 9: Destructive operation safety
  it("enforces yes/dry-run/interactive guard invariants", () => {
    fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        async (yes, dryRun, interactive, promptDecision) => {
          let promptCalled = false;
          let dryRunCalled = false;

          const result = await checkDestructiveGuard({
            yes,
            dryRun,
            interactive,
            prompt: async () => {
              promptCalled = true;
              return promptDecision;
            },
            onDryRun: () => {
              dryRunCalled = true;
            },
          });

          if (dryRun) {
            expect(result.exitCode).toBe(0);
            expect(result.reason).toBe("dry_run");
            expect(dryRunCalled).toBe(true);
            expect(promptCalled).toBe(false);
            return;
          }

          if (yes) {
            expect(result.proceed).toBe(true);
            expect(result.exitCode).toBe(0);
            expect(result.reason).toBe("confirmed");
            expect(promptCalled).toBe(false);
            return;
          }

          if (!interactive) {
            expect(result.proceed).toBe(false);
            expect(result.exitCode).toBe(2);
            expect(result.reason).toBe("missing_yes_flag");
            expect(promptCalled).toBe(false);
            return;
          }

          expect(promptCalled).toBe(true);
          if (promptDecision) {
            expect(result.proceed).toBe(true);
            expect(result.exitCode).toBe(0);
            expect(result.reason).toBe("confirmed");
          } else {
            expect(result.proceed).toBe(false);
            expect(result.exitCode).toBe(2);
            expect(result.reason).toBe("cancelled");
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
