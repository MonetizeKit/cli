import { createHmac, timingSafeEqual } from "node:crypto";

export function computeStripeWebhookSignature(
  payload: string,
  secret: string,
  timestamp: number,
): string {
  const signedPayload = `${timestamp}.${payload}`;
  return createHmac("sha256", secret).update(signedPayload).digest("hex");
}

export function buildStripeSignatureHeader(signature: string, timestamp: number): string {
  return `t=${timestamp},v1=${signature}`;
}

export function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
): boolean {
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const signaturePart = parts.find((part) => part.startsWith("v1="));

  if (!timestampPart || !signaturePart) {
    return false;
  }

  const timestamp = Number(timestampPart.slice(2));
  const signature = signaturePart.slice(3);
  if (!Number.isFinite(timestamp) || signature.length === 0) {
    return false;
  }

  const expected = computeStripeWebhookSignature(payload, secret, timestamp);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}
