import fc from "fast-check";
import { z } from "zod";
import { describe, expect, it } from "vitest";

import { ExitCode } from "../../src/lib/exit-codes.js";
import {
  checkMutualExclusion,
  hasAnyDefinedValue,
  mapZodIssuesToFieldErrors,
  validateAgainstSchema,
} from "../../src/lib/input-json.js";

const FLAGS_CANDIDATE_ARBITRARY = fc.option(
  fc.dictionary(
    fc.string({ minLength: 1, maxLength: 8 }),
    fc.option(fc.oneof(fc.string(), fc.integer(), fc.boolean()), { nil: undefined }),
  ),
  { nil: undefined },
);

describe("input-json property tests", () => {
  // Feature: agent-mode-parity, Property: --input-json and flags are mutually exclusive
  it("flags a conflict exactly when --input-json is set and a flag/arg also has a defined value", () => {
    fc.assert(
      fc.property(
        fc.option(fc.string(), { nil: undefined }),
        FLAGS_CANDIDATE_ARBITRARY,
        (inputJson, flagsCandidate) => {
          const result = checkMutualExclusion(inputJson, flagsCandidate);
          const expectConflict = inputJson !== undefined && hasAnyDefinedValue(flagsCandidate);

          if (expectConflict) {
            expect(result).not.toBeNull();
            expect(result?.exitCode).toBe(ExitCode.InvalidArguments);
          } else {
            expect(result).toBeNull();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: agent-mode-parity, Property: schema validation failures report every failing field
  it("maps every failing field to a JSON Pointer path and message, not just the first", () => {
    const schema = z.object({
      externalId: z.string().min(1),
      email: z.string().email(),
      count: z.number().int(),
    });

    fc.assert(
      fc.property(
        fc.record({
          externalId: fc.constant(""),
          email: fc.constant("not-an-email"),
          count: fc.constant(1.5),
        }),
        (invalidDocument) => {
          const result = validateAgainstSchema(schema, invalidDocument);
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.exitCode).toBe(ExitCode.ValidationFailed);
            expect(result.fieldErrors?.length).toBeGreaterThanOrEqual(3);
            const paths = result.fieldErrors?.map((fieldError) => fieldError.path) ?? [];
            expect(paths).toContain("/externalId");
            expect(paths).toContain("/email");
            expect(paths).toContain("/count");
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  // Feature: agent-mode-parity, Property: valid documents parse to typed data
  it("returns the parsed data on success", () => {
    const schema = z.object({ value: z.number() });

    fc.assert(
      fc.property(fc.integer(), (value) => {
        const result = validateAgainstSchema(schema, { value });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.data).toEqual({ value });
        }
      }),
      { numRuns: 100 },
    );
  });

  it("converts zod issue paths into JSON Pointer strings", () => {
    const schema = z.object({ nested: z.object({ deep: z.string() }) });
    const result = validateAgainstSchema(schema, { nested: { deep: 42 } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(mapZodIssuesToFieldErrors) // sanity: exported and used internally
        .toBeTypeOf("function");
      expect(result.fieldErrors).toEqual([{ path: "/nested/deep", message: expect.any(String) }]);
    }
  });
});
