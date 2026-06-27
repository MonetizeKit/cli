import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { replayUsageEvents, type UsageReplayEvent } from "../../src/lib/usage-replay.js";

const EVENT_ARBITRARY: fc.Arbitrary<UsageReplayEvent> = fc.record({
  customerId: fc.stringMatching(/^[a-zA-Z0-9_-]{3,24}$/),
  meterId: fc.stringMatching(/^[a-zA-Z0-9_-]{3,24}$/),
  value: fc.integer({ min: 0, max: 10000 }),
  timestamp: fc.option(
    fc
      .integer({
        min: Date.parse("2000-01-01T00:00:00.000Z"),
        max: Date.parse("2100-01-01T00:00:00.000Z"),
      })
      .map((epochMs) => new Date(epochMs).toISOString()),
    { nil: undefined },
  ),
  idempotencyKey: fc.option(fc.stringMatching(/^[a-zA-Z0-9_-]{6,30}$/), {
    nil: undefined,
  }),
});

describe("usage replay property tests", () => {
  // Feature: monetizekit-cli, Property 16: Usage replay preserves order and reports partial failures
  it("preserves event submission order and reports partial failures", () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(EVENT_ARBITRARY, { minLength: 1, maxLength: 20 }),
        fc.set(fc.integer({ min: 0, max: 19 }), { minLength: 0, maxLength: 8 }),
        async (events, rawFailureIndexes) => {
          const failureIndexes = new Set(
            [...rawFailureIndexes].filter((index) => index < events.length),
          );
          const seen: UsageReplayEvent[] = [];

          const result = await replayUsageEvents(events, async (event) => {
            const index = seen.length;
            seen.push(event);
            if (failureIndexes.has(index)) {
              throw new Error(`synthetic-failure-${index}`);
            }
          });

          expect(seen).toEqual(events);
          expect(result.failureCount).toBe(failureIndexes.size);
          expect(result.successCount).toBe(events.length - failureIndexes.size);
          expect(result.failures.map((failure) => failure.line)).toEqual(
            [...failureIndexes].sort((a, b) => a - b).map((index) => index + 1),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
