import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { redact } from "../../src/lib/redaction.js";

describe("redaction property tests", () => {
  // Feature: monetizekit-cli, Property 7: Secret redaction in all output
  it("masks known secret token patterns without leaking raw values", () => {
    const secretCaseArb = fc.oneof(
      fc.stringMatching(/^[A-Za-z0-9_-]{16,64}$/).map((value) => ({
        input: `mk_live_${value}`,
        rawSecret: `mk_live_${value}`,
      })),
      fc.stringMatching(/^[A-Za-z0-9_-]{16,64}$/).map((value) => ({
        input: `mk_test_${value}`,
        rawSecret: `mk_test_${value}`,
      })),
      fc.stringMatching(/^[A-Za-z0-9_-]{16,64}$/).map((value) => ({
        input: `pk_live_${value}`,
        rawSecret: `pk_live_${value}`,
      })),
      fc.stringMatching(/^[A-Za-z0-9_-]{16,64}$/).map((value) => ({
        input: `pk_test_${value}`,
        rawSecret: `pk_test_${value}`,
      })),
      fc.stringMatching(/^[A-Za-z0-9_-]{16,64}$/).map((value) => ({
        input: `whsec_${value}`,
        rawSecret: `whsec_${value}`,
      })),
      fc.stringMatching(/^[A-Za-z0-9._-]{16,64}$/).map((value) => ({
        input: `Bearer ${value}`,
        rawSecret: value,
      })),
      fc.stringMatching(/^[A-Za-z0-9._-]{16,64}$/).map((value) => ({
        input: `Authorization: Bearer ${value}`,
        rawSecret: value,
      })),
    );

    fc.assert(
      fc.property(secretCaseArb, fc.string(), fc.string(), (secretCase, left, right) => {
        const combined = `${left} ${secretCase.input} ${right}`;
        const redacted = redact(combined);

        expect(redacted).not.toContain(secretCase.rawSecret);
        expect(redacted).toContain("****");
      }),
      { numRuns: 100 },
    );
  });
});
