import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

import { renderUnifiedDiff } from "./deep-scaffold-diff.js";
import {
  resolveNextjsSrcPrefix,
  resolveNextjsWebhookRoutePath,
  resolveNodeSrcPrefix,
  resolveNodeWebhookRoutePath,
} from "./deep-scaffold-paths.js";
import {
  MONETIZEKIT_SIGNATURE_HEADER,
  MONETIZEKIT_SIGNATURE_PREFIX,
  MONETIZEKIT_TIMESTAMP_HEADER,
} from "./deep-scaffold-webhook-signature.js";
import type { DeepScaffoldOptions, DeepScaffoldStepResult } from "./deep-scaffold.js";
import { writeTextFile } from "./io.js";

export async function applyWebhookRouteScaffold(options: DeepScaffoldOptions): Promise<DeepScaffoldStepResult> {
  switch (options.projectType) {
    case "nextjs":
      return await applyForNextjs(options);
    case "node":
      return await applyForNode(options);
    case "go":
    case "python":
    case "java":
    case "generic":
      return {
        step: "webhookRoute",
        status: "skipped",
        reason: "webhook route scaffold only applies to nextjs/node projects",
      };
    default:
      return assertNever(options.projectType);
  }
}

async function applyForNextjs(options: DeepScaffoldOptions): Promise<DeepScaffoldStepResult> {
  const srcPrefix = await resolveNextjsSrcPrefix(options.projectRoot);
  const relativePath = resolveNextjsWebhookRoutePath(srcPrefix);
  return await writeIfAbsent(options, relativePath, buildNextjsWebhookRouteContent());
}

async function applyForNode(options: DeepScaffoldOptions): Promise<DeepScaffoldStepResult> {
  const srcPrefix = await resolveNodeSrcPrefix(options.projectRoot);
  const relativePath = resolveNodeWebhookRoutePath(srcPrefix);
  return await writeIfAbsent(options, relativePath, buildNodeWebhookRouteContent());
}

/**
 * A webhook route handler is self-contained — nothing else in the project
 * needs to import it for it to work — so an existing file at the target
 * path is unambiguous evidence a prior run (or the user) already created
 * it. No merge Codemod is attempted here (Requirement 4.3).
 */
async function writeIfAbsent(
  options: DeepScaffoldOptions,
  relativePath: string,
  content: string,
): Promise<DeepScaffoldStepResult> {
  const absolutePath = join(options.projectRoot, relativePath);

  if (await pathExists(absolutePath)) {
    return { step: "webhookRoute", status: "already-present", path: relativePath };
  }

  if (options.dryRun) {
    const { diff } = renderUnifiedDiff(relativePath, null, content);
    return { step: "webhookRoute", status: "applied", path: relativePath, diff };
  }

  await writeTextFile(absolutePath, content);
  return { step: "webhookRoute", status: "applied", path: relativePath };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Shared between the nextjs/node templates so the verification logic they
 * embed can't drift from each other — both must match
 * `verifyMonetizekitWebhookSignature()` in `deep-scaffold-webhook-signature.ts`,
 * which carries the property-tested reference implementation.
 */
function buildVerifySignatureFunctionLines(): string[] {
  return [
    `const SIGNATURE_HEADER = "${MONETIZEKIT_SIGNATURE_HEADER}";`,
    `const TIMESTAMP_HEADER = "${MONETIZEKIT_TIMESTAMP_HEADER}";`,
    `const SIGNATURE_PREFIX = "${MONETIZEKIT_SIGNATURE_PREFIX}";`,
    "",
    "function verifyMonetizekitSignature(",
    "  rawBody: string,",
    "  timestamp: string,",
    "  signatureHeader: string,",
    "  secret: string,",
    "): boolean {",
    "  if (!signatureHeader.startsWith(SIGNATURE_PREFIX)) {",
    "    return false;",
    "  }",
    "",
    "  const providedSignature = signatureHeader.slice(SIGNATURE_PREFIX.length);",
    '  const expectedSignature = createHmac("sha256", secret)',
    '    .update(`${timestamp}.${rawBody}`)',
    '    .digest("hex");',
    "",
    '  const expectedBuffer = Buffer.from(expectedSignature, "utf8");',
    '  const providedBuffer = Buffer.from(providedSignature, "utf8");',
    "  if (expectedBuffer.length !== providedBuffer.length) {",
    "    return false;",
    "  }",
    "",
    "  return timingSafeEqual(expectedBuffer, providedBuffer);",
    "}",
  ];
}

function buildNextjsWebhookRouteContent(): string {
  return [
    'import { createHmac, timingSafeEqual } from "node:crypto";',
    'import { NextResponse } from "next/server";',
    'import type { NextRequest } from "next/server";',
    "",
    ...buildVerifySignatureFunctionLines(),
    "",
    "export async function POST(request: NextRequest): Promise<NextResponse> {",
    "  const secret = process.env.MONETIZEKIT_WEBHOOK_SECRET;",
    "  if (!secret) {",
    '    return NextResponse.json({ error: "MONETIZEKIT_WEBHOOK_SECRET is not configured" }, { status: 500 });',
    "  }",
    "",
    "  const signatureHeader = request.headers.get(SIGNATURE_HEADER);",
    "  const timestamp = request.headers.get(TIMESTAMP_HEADER);",
    "  const rawBody = await request.text();",
    "",
    "  if (",
    "    !signatureHeader ||",
    "    !timestamp ||",
    "    !verifyMonetizekitSignature(rawBody, timestamp, signatureHeader, secret)",
    "  ) {",
    '    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });',
    "  }",
    "",
    "  const event = JSON.parse(rawBody) as { type?: string };",
    "",
    '  // TODO: handle event.type (e.g. "entitlement.changed", "usage.threshold",',
    '  // "credit.depleted") — see https://docs.monetizekit.com/guides/webhooks.',
    '  console.log("Received MonetizeKit webhook", event.type);',
    "",
    "  return NextResponse.json({ received: true });",
    "}",
    "",
  ].join("\n");
}

function buildNodeWebhookRouteContent(): string {
  return [
    'import { createHmac, timingSafeEqual } from "node:crypto";',
    'import { Router } from "express";',
    'import type { Request, Response } from "express";',
    "",
    ...buildVerifySignatureFunctionLines(),
    "",
    "const router = Router();",
    "",
    "// Mount this router with `express.raw({ type: \"application/json\" })` (not",
    "// `express.json()`) so `request.body` below is the exact raw payload bytes",
    "// the signature was computed over.",
    'router.post("/monetizekit-webhooks", (request: Request, response: Response) => {',
    "  const secret = process.env.MONETIZEKIT_WEBHOOK_SECRET;",
    "  if (!secret) {",
    '    response.status(500).json({ error: "MONETIZEKIT_WEBHOOK_SECRET is not configured" });',
    "    return;",
    "  }",
    "",
    "  const signatureHeader = request.header(SIGNATURE_HEADER);",
    "  const timestamp = request.header(TIMESTAMP_HEADER);",
    "  const rawBody = Buffer.isBuffer(request.body)",
    '    ? request.body.toString("utf8")',
    "    : JSON.stringify(request.body);",
    "",
    "  if (",
    "    !signatureHeader ||",
    "    !timestamp ||",
    "    !verifyMonetizekitSignature(rawBody, timestamp, signatureHeader, secret)",
    "  ) {",
    '    response.status(401).json({ error: "Invalid webhook signature" });',
    "    return;",
    "  }",
    "",
    "  const event = JSON.parse(rawBody) as { type?: string };",
    "",
    '  // TODO: handle event.type (e.g. "entitlement.changed", "usage.threshold",',
    '  // "credit.depleted") — see https://docs.monetizekit.com/guides/webhooks.',
    '  console.log("Received MonetizeKit webhook", event.type);',
    "",
    "  response.json({ received: true });",
    "});",
    "",
    "export default router;",
    "",
  ].join("\n");
}

function assertNever(value: never): never {
  throw new Error(`Unhandled project type: ${JSON.stringify(value)}`);
}
