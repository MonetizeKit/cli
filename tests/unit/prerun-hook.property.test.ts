import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { hasAgentModeArgument, hasWorkspaceArgument } from "../../src/hooks/prerun.js";

const NOISE_ARGV_ARBITRARY = fc.array(
  fc.stringMatching(/^--[a-z][a-z-]{0,12}$/).filter((value) => value !== "--mode" && value !== "--workspace"),
  { maxLength: 5 },
);

describe("prerun hook argv detection property tests", () => {
  // Feature: agent-mode-parity, Requirement 1.4/1.6: TTY_Fallback generalizes to --mode agent
  it("detects '--mode agent' and '--mode=agent' regardless of surrounding argv noise", () => {
    fc.assert(
      fc.property(NOISE_ARGV_ARBITRARY, NOISE_ARGV_ARBITRARY, fc.constantFrom("split", "equals"), (before, after, form) => {
        const modeArgs = form === "split" ? ["--mode", "agent"] : ["--mode=agent"];
        const argv = [...before, ...modeArgs, ...after];
        expect(hasAgentModeArgument(argv)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("does not detect agent mode for --mode human or absent --mode", () => {
    fc.assert(
      fc.property(NOISE_ARGV_ARBITRARY, fc.constantFrom<string[]>([], ["--mode", "human"], ["--mode=human"]), (argv, modeArgs) => {
        expect(hasAgentModeArgument([...argv, ...modeArgs])).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("detects --workspace and --workspace=<value> regardless of surrounding argv noise", () => {
    fc.assert(
      fc.property(
        NOISE_ARGV_ARBITRARY,
        NOISE_ARGV_ARBITRARY,
        fc.constantFrom("bare", "equals"),
        (before, after, form) => {
          const workspaceArg = form === "bare" ? "--workspace" : "--workspace=ws_123";
          const argv = [...before, workspaceArg, ...after];
          expect(hasWorkspaceArgument(argv)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
