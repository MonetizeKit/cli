import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { renderJUnitXml } from "../../src/lib/ci-report.js";
import type { CiRunResult } from "../../src/lib/ci.js";

describe("ci report property tests", () => {
  // Feature: monetizekit-cli, Property 21: JUnit report generation is deterministic and status-accurate
  it("renders deterministic XML with accurate pass/fail/skipped accounting", () => {
    const checkArb = fc.record({
      name: fc.string({ minLength: 1, maxLength: 40 }),
      status: fc.constantFrom<"pass" | "fail" | "skipped">("pass", "fail", "skipped"),
      message: fc.string({ maxLength: 80 }),
      durationMs: fc.integer({ min: 0, max: 10_000 }),
      details: fc.option(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 10 }),
          fc.oneof(
            fc.string({ maxLength: 20 }),
            fc.integer({ min: -10_000, max: 10_000 }),
            fc.boolean(),
            fc.constant(null),
          ),
        ),
        {
          nil: undefined,
        },
      ),
    });

    fc.assert(
      fc.property(fc.array(checkArb, { minLength: 1, maxLength: 10 }), (checks) => {
        const result: CiRunResult = {
          kind: "contract-test",
          generatedAt: "2026-01-01T00:00:00.000Z",
          checks,
          summary: {
            total: checks.length,
            pass: checks.filter((check) => check.status === "pass").length,
            fail: checks.filter((check) => check.status === "fail").length,
            skipped: checks.filter((check) => check.status === "skipped").length,
          },
        };

        const first = renderJUnitXml(result);
        const second = renderJUnitXml(result);
        expect(first).toBe(second);
        expect(first).toContain(`tests="${String(result.summary.total)}"`);
        expect(first).toContain(`failures="${String(result.summary.fail)}"`);
        expect(first).toContain(`skipped="${String(result.summary.skipped)}"`);
        expect(first.startsWith("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
