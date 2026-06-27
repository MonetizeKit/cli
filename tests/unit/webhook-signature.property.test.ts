import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { computeWebhookSignature, verifyWebhookSignature } from "../../src/lib/webhook.js";

describe("webhook signature property tests", () => {
  // Feature: monetizekit-cli, Property 13: Webhook HMAC-SHA256 verification
  it("accepts valid HMAC signatures and rejects mismatched secrets", () => {
    const payloadArb = fc.string({ minLength: 1, maxLength: 2048 });
    const secretArb = fc.stringMatching(/^[a-zA-Z0-9_-]{8,64}$/);

    fc.assert(
      fc.property(payloadArb, secretArb, secretArb, (payload, secret, otherSecret) => {
        const signature = computeWebhookSignature(payload, secret);
        expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);

        if (otherSecret !== secret) {
          expect(verifyWebhookSignature(payload, signature, otherSecret)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});
