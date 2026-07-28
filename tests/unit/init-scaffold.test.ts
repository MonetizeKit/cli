import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { scaffoldMonetizekitProject } from "../../src/lib/init.js";

async function freshProjectRoot(): Promise<string> {
  return await mkdtemp(join(tmpdir(), "monetizekit-init-scaffold-"));
}

describe("scaffoldMonetizekitProject dry-run support", () => {
  it("writes the shallow scaffold files when dryRun is false (unchanged existing behavior)", async () => {
    const projectRoot = await freshProjectRoot();

    const result = await scaffoldMonetizekitProject({
      projectRoot,
      projectType: "nextjs",
      stripe: false,
      dryRun: false,
    });

    expect(result.files).toEqual([".monetizekit/README.md", ".monetizekit/.env.example", ".monetizekit/sdk.example.ts"]);
    expect(result.diffs).toEqual([]);
    await expect(readFile(join(projectRoot, ".monetizekit/README.md"), "utf8")).resolves.toContain(
      "Detected project type: nextjs",
    );
  });

  it("includes the Stripe example file when stripe is true", async () => {
    const projectRoot = await freshProjectRoot();

    const result = await scaffoldMonetizekitProject({
      projectRoot,
      projectType: "node",
      stripe: true,
      dryRun: false,
    });

    expect(result.files).toContain(".monetizekit/stripe/webhook-handler.example.ts");
    await expect(
      readFile(join(projectRoot, ".monetizekit/stripe/webhook-handler.example.ts"), "utf8"),
    ).resolves.toContain("verifyStripeSignature");
  });

  it("under --dry-run, computes diffs for new files and writes nothing", async () => {
    const projectRoot = await freshProjectRoot();

    const result = await scaffoldMonetizekitProject({
      projectRoot,
      projectType: "nextjs",
      stripe: false,
      dryRun: true,
    });

    expect(result.files).toEqual([".monetizekit/README.md", ".monetizekit/.env.example", ".monetizekit/sdk.example.ts"]);
    expect(result.diffs).toHaveLength(3);
    expect(result.diffs.map((d) => d.path)).toEqual(result.files);
    for (const fileDiff of result.diffs) {
      expect(fileDiff.diff).toContain("/dev/null");
    }
    await expect(readFile(join(projectRoot, ".monetizekit/README.md"), "utf8")).rejects.toThrow();
  });

  it("under --dry-run, reports zero diffs for a file that already has the exact expected content", async () => {
    const projectRoot = await freshProjectRoot();
    await mkdir(join(projectRoot, ".monetizekit"), { recursive: true });
    await writeFile(
      join(projectRoot, ".monetizekit", ".env.example"),
      [
        "MONETIZEKIT_API_URL=https://app.monetizekit.app",
        "MONETIZEKIT_WORKSPACE=",
        "MONETIZEKIT_ENV=dev",
        "MONETIZEKIT_API_KEY=",
        "",
      ].join("\n"),
    );

    const result = await scaffoldMonetizekitProject({
      projectRoot,
      projectType: "nextjs",
      stripe: false,
      dryRun: true,
    });

    const envDiff = result.diffs.find((d) => d.path === ".monetizekit/.env.example");
    expect(envDiff).toBeUndefined();
  });

  it("under --dry-run, reports a non-empty diff for a file with different existing content", async () => {
    const projectRoot = await freshProjectRoot();
    await mkdir(join(projectRoot, ".monetizekit"), { recursive: true });
    await writeFile(join(projectRoot, ".monetizekit", ".env.example"), "MONETIZEKIT_API_URL=custom\n");

    const result = await scaffoldMonetizekitProject({
      projectRoot,
      projectType: "nextjs",
      stripe: false,
      dryRun: true,
    });

    const envDiff = result.diffs.find((d) => d.path === ".monetizekit/.env.example");
    expect(envDiff?.diff).toBeTruthy();
    await expect(readFile(join(projectRoot, ".monetizekit", ".env.example"), "utf8")).resolves.toBe(
      "MONETIZEKIT_API_URL=custom\n",
    );
  });
});
