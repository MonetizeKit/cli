import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  buildOutputOptions,
  detectModeOutputConflict,
  type OutputFlagsInput,
} from "../../src/lib/base-command.js";

const OUTPUT_FORMAT_ARBITRARY = fc.constantFrom<"json" | "yaml" | "table" | undefined>(
  "json",
  "yaml",
  "table",
  undefined,
);

const OUTPUT_FLAGS_ARBITRARY: fc.Arbitrary<OutputFlagsInput> = fc.record({
  json: fc.boolean(),
  output: OUTPUT_FORMAT_ARBITRARY,
  quiet: fc.boolean(),
  noColor: fc.boolean(),
});

describe("base command agent-mode property tests", () => {
  // Feature: agent-mode-parity, Property: Agent_Mode implies JSON output
  it("forces json output and the json output format whenever agent mode is active", () => {
    fc.assert(
      fc.property(OUTPUT_FLAGS_ARBITRARY, fc.boolean(), (flags, agentMode) => {
        const options = buildOutputOptions(flags, agentMode);

        if (agentMode) {
          expect(options.json).toBe(true);
          expect(options.output).toBe("json");
        } else {
          expect(options.json).toBe(Boolean(flags.json));
          expect(options.output).toBe(flags.output);
        }

        expect(options.quiet).toBe(Boolean(flags.quiet));
        expect(options.noColor).toBe(Boolean(flags.noColor));
      }),
      { numRuns: 100 },
    );
  });

  // Feature: agent-mode-parity, Property: --mode agent + non-JSON --output conflict
  it("flags a conflict only when agent mode is combined with a non-json --output", () => {
    fc.assert(
      fc.property(fc.boolean(), OUTPUT_FORMAT_ARBITRARY, (agentMode, outputFlag) => {
        const conflict = detectModeOutputConflict(agentMode, outputFlag);
        const expected = agentMode && outputFlag !== undefined && outputFlag !== "json";
        expect(conflict).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });
});
