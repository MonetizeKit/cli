import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Header names, signature prefix, and signing input format hand-synced
 * against `apps/docs/lib/docs/guide-facts.ts` (`WEBHOOK_HEADERS`,
 * `WEBHOOK_SIGNATURE_PREFIX`) in the `app-monetizekit-monorepo` repo, as of
 * 2026-07-27. That file is the source of truth the Webhooks guide's
 * contract tests assert against; there is no shared package between the two
 * repos, so re-check it there if the signature scheme ever changes.
 */
export const MONETIZEKIT_SIGNATURE_HEADER = "X-MonetizeKit-Signature";
export const MONETIZEKIT_TIMESTAMP_HEADER = "X-MonetizeKit-Timestamp";
export const MONETIZEKIT_SIGNATURE_PREFIX = "sha256=";

/**
 * The exact algorithm `applyWebhookRouteScaffold()`'s generated route/router
 * files implement — kept here as a real, independently testable function so
 * the generated (never-executed-by-the-CLI-itself) scaffold text has a
 * verified reference implementation to match against.
 */
export function computeMonetizekitWebhookSignature(rawBody: string, timestamp: string, secret: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function buildMonetizekitSignatureHeader(rawBody: string, timestamp: string, secret: string): string {
  return `${MONETIZEKIT_SIGNATURE_PREFIX}${computeMonetizekitWebhookSignature(rawBody, timestamp, secret)}`;
}

export function verifyMonetizekitWebhookSignature(
  rawBody: string,
  timestamp: string,
  signatureHeader: string,
  secret: string,
): boolean {
  if (!signatureHeader.startsWith(MONETIZEKIT_SIGNATURE_PREFIX)) {
    return false;
  }

  const providedSignature = signatureHeader.slice(MONETIZEKIT_SIGNATURE_PREFIX.length);
  const expectedSignature = computeMonetizekitWebhookSignature(rawBody, timestamp, secret);

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const providedBuffer = Buffer.from(providedSignature, "utf8");
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}
