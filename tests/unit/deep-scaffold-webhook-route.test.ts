import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { applyWebhookRouteScaffold } from "../../src/lib/deep-scaffold-webhook-route.js";

async function freshProjectRoot(): Promise<string> {
  return await mkdtemp(join(tmpdir(), "monetizekit-webhook-route-"));
}

describe("applyWebhookRouteScaffold fixture tests", () => {
  it("creates a Next.js App Router route handler when none exists", async () => {
    const projectRoot = await freshProjectRoot();

    const result = await applyWebhookRouteScaffold({ projectRoot, projectType: "nextjs", dryRun: false });

    expect(result).toEqual({
      step: "webhookRoute",
      status: "applied",
      path: "app/api/webhooks/monetizekit/route.ts",
    });
    const content = await readFile(join(projectRoot, result.path ?? ""), "utf8");
    expect(content).toContain("X-MonetizeKit-Signature");
    expect(content).toContain("X-MonetizeKit-Timestamp");
    expect(content).toContain("sha256=");
    expect(content).toContain("export async function POST(");
  });

  it("uses src/app when the project already has a src/app directory", async () => {
    const projectRoot = await freshProjectRoot();
    await mkdir(join(projectRoot, "src", "app"), { recursive: true });
    await writeFile(join(projectRoot, "src", "app", "layout.tsx"), "export default function RootLayout() {}\n");

    const result = await applyWebhookRouteScaffold({ projectRoot, projectType: "nextjs", dryRun: false });

    expect(result.path).toBe("src/app/api/webhooks/monetizekit/route.ts");
  });

  it("reports already-present without overwriting an existing route file", async () => {
    const projectRoot = await freshProjectRoot();
    const existingPath = join(projectRoot, "app", "api", "webhooks", "monetizekit", "route.ts");
    await mkdir(join(projectRoot, "app", "api", "webhooks", "monetizekit"), { recursive: true });
    await writeFile(existingPath, "// user-modified\nexport async function POST() {}\n");

    const result = await applyWebhookRouteScaffold({ projectRoot, projectType: "nextjs", dryRun: false });

    expect(result).toEqual({
      step: "webhookRoute",
      status: "already-present",
      path: "app/api/webhooks/monetizekit/route.ts",
    });
    expect(await readFile(existingPath, "utf8")).toBe("// user-modified\nexport async function POST() {}\n");
  });

  it("creates a node/Express router file when none exists", async () => {
    const projectRoot = await freshProjectRoot();

    const result = await applyWebhookRouteScaffold({ projectRoot, projectType: "node", dryRun: false });

    expect(result).toEqual({
      step: "webhookRoute",
      status: "applied",
      path: "routes/monetizekit-webhooks.ts",
    });
    const content = await readFile(join(projectRoot, result.path ?? ""), "utf8");
    expect(content).toContain("X-MonetizeKit-Signature");
    expect(content).toContain("export default router");
  });

  it("uses src/routes when the project already has a src directory", async () => {
    const projectRoot = await freshProjectRoot();
    await mkdir(join(projectRoot, "src"), { recursive: true });

    const result = await applyWebhookRouteScaffold({ projectRoot, projectType: "node", dryRun: false });

    expect(result.path).toBe("src/routes/monetizekit-webhooks.ts");
  });

  it("skips unsupported project types", async () => {
    const projectRoot = await freshProjectRoot();

    const result = await applyWebhookRouteScaffold({ projectRoot, projectType: "python", dryRun: false });

    expect(result.status).toBe("skipped");
  });

  it("under --dry-run, computes a diff and writes nothing", async () => {
    const projectRoot = await freshProjectRoot();

    const result = await applyWebhookRouteScaffold({ projectRoot, projectType: "nextjs", dryRun: true });

    expect(result.status).toBe("applied");
    expect(result.diff).toBeTruthy();
    await expect(readFile(join(projectRoot, "app/api/webhooks/monetizekit/route.ts"), "utf8")).rejects.toThrow();
  });
});
