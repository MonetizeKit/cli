import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { applyProviderWrap } from "../../src/lib/deep-scaffold-provider-wrap.js";
import { copyFixtureInputToTempDir, DEEP_SCAFFOLD_FIXTURES_ROOT, readFileTree } from "../support/fixtures.js";

const APP_ROUTER_FIXTURES_ROOT = join(DEEP_SCAFFOLD_FIXTURES_ROOT, "nextjs-app-router");

describe("applyProviderWrap fixture tests", () => {
  it("wraps a bare layout's children in MonetizeKitProvider", async () => {
    const fixtureDir = join(APP_ROUTER_FIXTURES_ROOT, "bare-layout");
    const projectRoot = await copyFixtureInputToTempDir(fixtureDir);

    const result = await applyProviderWrap({ projectRoot, projectType: "nextjs", dryRun: false });

    expect(result).toEqual({ step: "providerWrap", status: "applied", path: "app/layout.tsx" });
    const actual = await readFile(join(projectRoot, "app/layout.tsx"), "utf8");
    const expected = await readFile(join(fixtureDir, "expected/app/layout.tsx"), "utf8");
    expect(actual).toBe(expected);
  });

  it("wraps a layout that already has other providers, preserving them", async () => {
    const fixtureDir = join(APP_ROUTER_FIXTURES_ROOT, "with-providers");
    const projectRoot = await copyFixtureInputToTempDir(fixtureDir);

    const result = await applyProviderWrap({ projectRoot, projectType: "nextjs", dryRun: false });

    expect(result).toEqual({ step: "providerWrap", status: "applied", path: "app/layout.tsx" });
    const actual = await readFile(join(projectRoot, "app/layout.tsx"), "utf8");
    const expected = await readFile(join(fixtureDir, "expected/app/layout.tsx"), "utf8");
    expect(actual).toBe(expected);
  });

  it("skips a layout with an unrecognized return shape, leaving the file untouched", async () => {
    const fixtureDir = join(APP_ROUTER_FIXTURES_ROOT, "unrecognized-shape");
    const projectRoot = await copyFixtureInputToTempDir(fixtureDir);
    const before = await readFileTree(projectRoot);

    const result = await applyProviderWrap({ projectRoot, projectType: "nextjs", dryRun: false });

    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("unrecognized layout return shape");
    const after = await readFileTree(projectRoot);
    expect(after).toEqual(before);
  });

  it("reports already-present without editing a layout that already imports the provider", async () => {
    const fixtureDir = join(APP_ROUTER_FIXTURES_ROOT, "already-present");
    const projectRoot = await copyFixtureInputToTempDir(fixtureDir);
    const before = await readFileTree(projectRoot);

    const result = await applyProviderWrap({ projectRoot, projectType: "nextjs", dryRun: false });

    expect(result).toEqual({ step: "providerWrap", status: "already-present", path: "app/layout.tsx" });
    const after = await readFileTree(projectRoot);
    expect(after).toEqual(before);
  });

  it("skips when no app/layout.tsx or src/app/layout.tsx exists", async () => {
    const projectRoot = await copyFixtureInputToTempDir(join(APP_ROUTER_FIXTURES_ROOT, "..", "empty-project"));

    const result = await applyProviderWrap({ projectRoot, projectType: "nextjs", dryRun: false });

    expect(result).toEqual({
      step: "providerWrap",
      status: "skipped",
      reason: "no app/layout.tsx or src/app/layout.tsx found",
    });
  });

  it("under --dry-run, computes a diff and writes nothing", async () => {
    const fixtureDir = join(APP_ROUTER_FIXTURES_ROOT, "bare-layout");
    const projectRoot = await copyFixtureInputToTempDir(fixtureDir);
    const before = await readFileTree(projectRoot);

    const result = await applyProviderWrap({ projectRoot, projectType: "nextjs", dryRun: true });

    expect(result.status).toBe("applied");
    expect(result.diff).toBeTruthy();
    expect(result.diff).toContain("MonetizeKitProvider");
    const after = await readFileTree(projectRoot);
    expect(after).toEqual(before);
  });
});
