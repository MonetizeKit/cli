import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { applyProtectedExample } from "../../src/lib/deep-scaffold-protected-example.js";

async function freshProjectRoot(): Promise<string> {
  return await mkdtemp(join(tmpdir(), "monetizekit-protected-example-"));
}

describe("applyProtectedExample fixture tests", () => {
  it("creates a Next.js example page using the real useEntitlement hook", async () => {
    const projectRoot = await freshProjectRoot();

    const result = await applyProtectedExample({ projectRoot, projectType: "nextjs", dryRun: false });

    expect(result).toEqual({
      step: "protectedExample",
      status: "applied",
      path: "app/monetizekit-example/page.tsx",
    });
    const content = await readFile(join(projectRoot, result.path ?? ""), "utf8");
    expect(content).toContain('import { useEntitlement } from "@monetizekit/react"');
    expect(content).toContain('useEntitlement("REPLACE_WITH_YOUR_FEATURE_KEY")');
  });

  it("uses src/app when the project already has a src/app directory", async () => {
    const projectRoot = await freshProjectRoot();
    await mkdir(join(projectRoot, "src", "app"), { recursive: true });
    await writeFile(join(projectRoot, "src", "app", "layout.tsx"), "export default function RootLayout() {}\n");

    const result = await applyProtectedExample({ projectRoot, projectType: "nextjs", dryRun: false });

    expect(result.path).toBe("src/app/monetizekit-example/page.tsx");
  });

  it("reports already-present without overwriting an existing example page", async () => {
    const projectRoot = await freshProjectRoot();
    const existingPath = join(projectRoot, "app", "monetizekit-example", "page.tsx");
    await mkdir(join(projectRoot, "app", "monetizekit-example"), { recursive: true });
    await writeFile(existingPath, "// user-modified\nexport default function Page() { return null; }\n");

    const result = await applyProtectedExample({ projectRoot, projectType: "nextjs", dryRun: false });

    expect(result).toEqual({
      step: "protectedExample",
      status: "already-present",
      path: "app/monetizekit-example/page.tsx",
    });
    expect(await readFile(existingPath, "utf8")).toBe(
      "// user-modified\nexport default function Page() { return null; }\n",
    );
  });

  it("creates a node module using the real @monetizekit/node client method", async () => {
    const projectRoot = await freshProjectRoot();

    const result = await applyProtectedExample({ projectRoot, projectType: "node", dryRun: false });

    expect(result).toEqual({
      step: "protectedExample",
      status: "applied",
      path: "monetizekit-example.ts",
    });
    const content = await readFile(join(projectRoot, result.path ?? ""), "utf8");
    expect(content).toContain('import { MonetizeKit } from "@monetizekit/node"');
    expect(content).toContain('client.entitlements.check(customerId, "REPLACE_WITH_YOUR_FEATURE_KEY")');
  });

  it("uses src/ when the project already has a src directory", async () => {
    const projectRoot = await freshProjectRoot();
    await mkdir(join(projectRoot, "src"), { recursive: true });

    const result = await applyProtectedExample({ projectRoot, projectType: "node", dryRun: false });

    expect(result.path).toBe("src/monetizekit-example.ts");
  });

  it("skips unsupported project types", async () => {
    const projectRoot = await freshProjectRoot();

    const result = await applyProtectedExample({ projectRoot, projectType: "go", dryRun: false });

    expect(result.status).toBe("skipped");
  });

  it("under --dry-run, computes a diff and writes nothing", async () => {
    const projectRoot = await freshProjectRoot();

    const result = await applyProtectedExample({ projectRoot, projectType: "nextjs", dryRun: true });

    expect(result.status).toBe("applied");
    expect(result.diff).toBeTruthy();
    await expect(readFile(join(projectRoot, "app/monetizekit-example/page.tsx"), "utf8")).rejects.toThrow();
  });
});
