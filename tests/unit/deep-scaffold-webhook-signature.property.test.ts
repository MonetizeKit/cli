import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  buildMonetizekitSignatureHeader,
  verifyMonetizekitWebhookSignature,
} from "../../src/lib/deep-scaffold-webhook-signature.js";

describe("deep-scaffold webhook signature property tests", () => {
  // Feature: init-scaffolding-depth, Property: generated webhook route HMAC-SHA256 verification
  it("accepts valid signatures over `${timestamp}.${rawBody}` and rejects wrong secrets/timestamps", () => {
    const rawBodyArb = fc.string({ minLength: 1, maxLength: 2048 });
    const secretArb = fc.stringMatching(/^[a-zA-Z0-9_-]{8,64}$/);
    const timestampArb = fc.integer({ min: 1_600_000_000, max: 2_200_000_000 }).map((value) => String(value));

    fc.assert(
      fc.property(
        rawBodyArb,
        secretArb,
        secretArb,
        timestampArb,
        timestampArb,
        (rawBody, secret, otherSecret, timestamp, otherTimestamp) => {
          const header = buildMonetizekitSignatureHeader(rawBody, timestamp, secret);
          expect(header.startsWith("sha256=")).toBe(true);
          expect(verifyMonetizekitWebhookSignature(rawBody, timestamp, header, secret)).toBe(true);

          if (otherSecret !== secret) {
            expect(verifyMonetizekitWebhookSignature(rawBody, timestamp, header, otherSecret)).toBe(false);
          }

          if (otherTimestamp !== timestamp) {
            expect(verifyMonetizekitWebhookSignature(rawBody, otherTimestamp, header, secret)).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("rejects a signature header without the sha256= prefix", () => {
    expect(verifyMonetizekitWebhookSignature("{}", "1700000000", "deadbeef", "secret")).toBe(false);
  });
});
