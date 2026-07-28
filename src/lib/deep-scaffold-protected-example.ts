import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

import { renderUnifiedDiff } from "./deep-scaffold-diff.js";
import {
  resolveNextjsProtectedExamplePath,
  resolveNextjsSrcPrefix,
  resolveNodeProtectedExamplePath,
  resolveNodeSrcPrefix,
} from "./deep-scaffold-paths.js";
import type { DeepScaffoldOptions, DeepScaffoldStepResult } from "./deep-scaffold.js";
import { writeTextFile } from "./io.js";

const PLACEHOLDER_FEATURE_KEY = "REPLACE_WITH_YOUR_FEATURE_KEY";

export async function applyProtectedExample(options: DeepScaffoldOptions): Promise<DeepScaffoldStepResult> {
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
        step: "protectedExample",
        status: "skipped",
        reason: "protected example only applies to nextjs/node projects",
      };
    default:
      return assertNever(options.projectType);
  }
}

async function applyForNextjs(options: DeepScaffoldOptions): Promise<DeepScaffoldStepResult> {
  const srcPrefix = await resolveNextjsSrcPrefix(options.projectRoot);
  const relativePath = resolveNextjsProtectedExamplePath(srcPrefix);
  return await writeIfAbsent(options, relativePath, buildNextjsProtectedExampleContent());
}

async function applyForNode(options: DeepScaffoldOptions): Promise<DeepScaffoldStepResult> {
  const srcPrefix = await resolveNodeSrcPrefix(options.projectRoot);
  const relativePath = resolveNodeProtectedExamplePath(srcPrefix);
  return await writeIfAbsent(options, relativePath, buildNodeProtectedExampleContent());
}

/**
 * Self-contained, like the webhook route (Requirement 5.3) — an existing
 * file at the target path is treated as unambiguous evidence a prior run
 * (or the user) already created it, so no merge is attempted.
 */
async function writeIfAbsent(
  options: DeepScaffoldOptions,
  relativePath: string,
  content: string,
): Promise<DeepScaffoldStepResult> {
  const absolutePath = join(options.projectRoot, relativePath);

  if (await pathExists(absolutePath)) {
    return { step: "protectedExample", status: "already-present", path: relativePath };
  }

  if (options.dryRun) {
    const { diff } = renderUnifiedDiff(relativePath, null, content);
    return { step: "protectedExample", status: "applied", path: relativePath, diff };
  }

  await writeTextFile(absolutePath, content);
  return { step: "protectedExample", status: "applied", path: relativePath };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function buildNextjsProtectedExampleContent(): string {
  return [
    '"use client";',
    "",
    'import { useEntitlement } from "@monetizekit/react";',
    "",
    "// This page is namespaced under monetizekit-example/ so it can't collide",
    "// with your own routes. Feel free to delete it once you've wired your own",
    "// entitlement checks using the pattern below.",
    "export default function MonetizekitExamplePage() {",
    `  const entitlement = useEntitlement("${PLACEHOLDER_FEATURE_KEY}");`,
    "",
    "  if (entitlement.loading) {",
    "    return <p>Loading entitlement…</p>;",
    "  }",
    "",
    "  if (!entitlement.allowed) {",
    "    return <p>You don&apos;t have access to this feature yet.</p>;",
    "  }",
    "",
    "  return <p>You have access to this feature.</p>;",
    "}",
    "",
  ].join("\n");
}

function buildNodeProtectedExampleContent(): string {
  return [
    'import { MonetizeKit } from "@monetizekit/node";',
    "",
    "const client = new MonetizeKit({",
    '  apiKey: process.env.MONETIZEKIT_API_KEY ?? "",',
    '  baseUrl: process.env.MONETIZEKIT_API_URL ?? "https://app.monetizekit.app",',
    "});",
    "",
    "// This module is namespaced as monetizekit-example so it can't collide with",
    "// your own modules. Feel free to delete it once you've wired your own",
    "// entitlement checks using the pattern below.",
    "export async function checkMonetizekitExampleEntitlement(customerId: string): Promise<boolean> {",
    `  const result = await client.entitlements.check(customerId, "${PLACEHOLDER_FEATURE_KEY}");`,
    "  // `EntitlementResult.effectiveValue` is the resolved boolean/limit/enum/string",
    "  // value after plan + add-on + override are applied.",
    "  return Boolean(result.effectiveValue);",
    "}",
    "",
  ].join("\n");
}

function assertNever(value: never): never {
  throw new Error(`Unhandled project type: ${JSON.stringify(value)}`);
}
