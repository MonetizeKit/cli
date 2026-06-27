import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  buildStripeSignatureHeader,
  computeStripeWebhookSignature,
  verifyStripeWebhookSignature,
} from "../../src/lib/stripe-webhook.js";

describe("stripe webhook property tests", () => {
  // Feature: monetizekit-cli, Property 19: Stripe webhook secret validation
  it("verifies valid Stripe signatures and rejects wrong secrets", () => {
    const payloadArb = fc.string({ minLength: 1, maxLength: 1024 });
    const secretArb = fc.stringMatching(/^[a-zA-Z0-9_-]{8,64}$/);
    const timestampArb = fc.integer({
      min: 1_600_000_000,
      max: 2_200_000_000,
    });

    fc.assert(
      fc.property(payloadArb, secretArb, secretArb, timestampArb, (payload, secret, otherSecret, ts) => {
        const signature = computeStripeWebhookSignature(payload, secret, ts);
        const header = buildStripeSignatureHeader(signature, ts);
        expect(verifyStripeWebhookSignature(payload, header, secret)).toBe(true);
        if (otherSecret !== secret) {
          expect(verifyStripeWebhookSignature(payload, header, otherSecret)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});
