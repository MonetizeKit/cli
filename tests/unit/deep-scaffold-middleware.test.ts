import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { applyMiddlewareScaffold } from "../../src/lib/deep-scaffold-middleware.js";
import { copyFixtureInputToTempDir, DEEP_SCAFFOLD_FIXTURES_ROOT, readFileTree } from "../support/fixtures.js";

const MIDDLEWARE_FIXTURES_ROOT = join(DEEP_SCAFFOLD_FIXTURES_ROOT, "nextjs-middleware");

async function expectApplied(fixtureName: string) {
  const fixtureDir = join(MIDDLEWARE_FIXTURES_ROOT, fixtureName);
  const projectRoot = await copyFixtureInputToTempDir(fixtureDir);

  const result = await applyMiddlewareScaffold({ projectRoot, projectType: "nextjs", dryRun: false });

  expect(result).toEqual({ step: "middleware", status: "applied", path: "middleware.ts" });
  const actual = await readFile(join(projectRoot, "middleware.ts"), "utf8");
  const expected = await readFile(join(fixtureDir, "expected/middleware.ts"), "utf8");
  expect(actual).toBe(expected);
}

describe("applyMiddlewareScaffold fixture tests", () => {
  it("creates middleware.ts when none exists", async () => {
    await expectApplied("no-file");
  });

  it("merges the marker block and matcher into a file with no matcher config", async () => {
    await expectApplied("without-matcher");
  });

  it("merges MonetizeKit's pattern into an existing recognized matcher array", async () => {
    await expectApplied("recognized-matcher");
  });

  it("skips a file with an unrecognized matcher shape, leaving it untouched", async () => {
    const fixtureDir = join(MIDDLEWARE_FIXTURES_ROOT, "unrecognized-matcher");
    const projectRoot = await copyFixtureInputToTempDir(fixtureDir);
    const before = await readFileTree(projectRoot);

    const result = await applyMiddlewareScaffold({ projectRoot, projectType: "nextjs", dryRun: false });

    expect(result).toEqual({
      step: "middleware",
      status: "skipped",
      path: "middleware.ts",
      reason: "existing matcher config not recognized",
    });
    const after = await readFileTree(projectRoot);
    expect(after).toEqual(before);
  });

  it("reports already-present without editing a file that already has the marker", async () => {
    const fixtureDir = join(MIDDLEWARE_FIXTURES_ROOT, "already-present");
    const projectRoot = await copyFixtureInputToTempDir(fixtureDir);
    const before = await readFileTree(projectRoot);

    const result = await applyMiddlewareScaffold({ projectRoot, projectType: "nextjs", dryRun: false });

    expect(result).toEqual({ step: "middleware", status: "already-present", path: "middleware.ts" });
    const after = await readFileTree(projectRoot);
    expect(after).toEqual(before);
  });

  it("skips for non-Next.js project types", async () => {
    const fixtureDir = join(MIDDLEWARE_FIXTURES_ROOT, "no-file");
    const projectRoot = await copyFixtureInputToTempDir(fixtureDir);

    const result = await applyMiddlewareScaffold({ projectRoot, projectType: "node", dryRun: false });

    expect(result.status).toBe("skipped");
    expect(result.path).toBeUndefined();
  });
});
