import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Locates the App Router root layout, trying `app/layout.tsx` before
 * `src/app/layout.tsx` (Requirement 2.1). Returns the path relative to
 * `projectRoot`, or `null` if neither exists.
 */
export async function findAppRouterLayoutPath(projectRoot: string): Promise<string | null> {
  const candidates = ["app/layout.tsx", "src/app/layout.tsx"];
  for (const candidate of candidates) {
    if (await pathExists(join(projectRoot, candidate))) {
      return candidate;
    }
  }

  return null;
}

/**
 * Resolves whether Next.js Deep_Scaffold file paths should live under
 * `src/` (`src/middleware.ts`, `src/app/...`) or the project root
 * (`middleware.ts`, `app/...`), mirroring the App Router directory the
 * project already uses. Falls back to a bare `src/` check, then defaults to
 * the project root, so steps 3-5 still produce a sensible path even when the
 * project has no `app/layout.tsx` yet (Requirement 2.3's skip only applies
 * to the provider-wrap step itself).
 */
export async function resolveNextjsSrcPrefix(projectRoot: string): Promise<"" | "src/"> {
  if (await pathExists(join(projectRoot, "src", "app"))) {
    return "src/";
  }

  if (await pathExists(join(projectRoot, "app"))) {
    return "";
  }

  if (await pathExists(join(projectRoot, "src"))) {
    return "src/";
  }

  return "";
}

export function resolveMiddlewarePath(srcPrefix: "" | "src/"): string {
  return `${srcPrefix}middleware.ts`;
}

export function resolveNextjsWebhookRoutePath(srcPrefix: "" | "src/"): string {
  return `${srcPrefix}app/api/webhooks/monetizekit/route.ts`;
}

export function resolveNextjsProtectedExamplePath(srcPrefix: "" | "src/"): string {
  return `${srcPrefix}app/monetizekit-example/page.tsx`;
}

/**
 * `node` projects use a `src/routes/` convention when `src/` already exists;
 * otherwise Deep_Scaffold falls back to `routes/` at the project root.
 */
export async function resolveNodeSrcPrefix(projectRoot: string): Promise<"" | "src/"> {
  if (await pathExists(join(projectRoot, "src"))) {
    return "src/";
  }

  return "";
}

export function resolveNodeWebhookRoutePath(srcPrefix: "" | "src/"): string {
  return `${srcPrefix}routes/monetizekit-webhooks.ts`;
}

export function resolveNodeProtectedExamplePath(srcPrefix: "" | "src/"): string {
  return `${srcPrefix}monetizekit-example.ts`;
}
