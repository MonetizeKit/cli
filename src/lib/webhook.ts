import { createHmac, timingSafeEqual } from "node:crypto";

export interface WebhookFixture {
  type: string;
  payload: Record<string, unknown>;
}

export const WEBHOOK_FIXTURES: WebhookFixture[] = [
  {
    type: "entitlement.changed",
    payload: {
      id: "evt_fixture_entitlement_changed",
      type: "entitlement.changed",
      customerId: "cust_fixture",
      featureKey: "feature_fixture",
      allowed: true,
      effectiveValue: 100,
    },
  },
  {
    type: "usage.threshold",
    payload: {
      id: "evt_fixture_usage_threshold",
      type: "usage.threshold",
      customerId: "cust_fixture",
      meterId: "meter_fixture",
      value: 98,
      threshold: 100,
    },
  },
  {
    type: "credit.depleted",
    payload: {
      id: "evt_fixture_credit_depleted",
      type: "credit.depleted",
      customerId: "cust_fixture",
      remainingCredits: 0,
    },
  },
];

export function computeWebhookSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expected = computeWebhookSignature(payload, secret);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function getWebhookFixture(type: string): WebhookFixture | undefined {
  return WEBHOOK_FIXTURES.find((fixture) => fixture.type === type);
}
