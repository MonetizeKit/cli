import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { join } from "node:path";

import { applyProviderWrap } from "../../src/lib/deep-scaffold-provider-wrap.js";
import { copyFixtureInputToTempDir, DEEP_SCAFFOLD_FIXTURES_ROOT, readFileTree } from "../support/fixtures.js";

const APP_ROUTER_FIXTURES_ROOT = join(DEEP_SCAFFOLD_FIXTURES_ROOT, "nextjs-app-router");
const FIXTURE_NAMES = ["bare-layout", "with-providers", "unrecognized-shape", "already-present"];

describe("applyProviderWrap property tests", () => {
  // Feature: init-scaffolding-depth, Property: Idempotent_Rerun produces zero diff
  it("running twice makes zero additional changes for every fixture", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...FIXTURE_NAMES), async (fixtureName) => {
        const fixtureDir = join(APP_ROUTER_FIXTURES_ROOT, fixtureName);
        const projectRoot = await copyFixtureInputToTempDir(fixtureDir);

        const first = await applyProviderWrap({ projectRoot, projectType: "nextjs", dryRun: false });
        const afterFirst = await readFileTree(projectRoot);

        const second = await applyProviderWrap({ projectRoot, projectType: "nextjs", dryRun: false });
        const afterSecond = await readFileTree(projectRoot);

        expect(second.status).not.toBe("applied");
        if (first.status === "applied") {
          expect(second.status).toBe("already-present");
        } else {
          expect(second).toEqual(first);
        }

        expect(afterSecond).toEqual(afterFirst);
      }),
      { numRuns: FIXTURE_NAMES.length },
    );
  });

  // Feature: init-scaffolding-depth, Property: --dry-run never writes
  it("dry-run never writes, regardless of what the computed diff says would change", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...FIXTURE_NAMES), async (fixtureName) => {
        const fixtureDir = join(APP_ROUTER_FIXTURES_ROOT, fixtureName);
        const projectRoot = await copyFixtureInputToTempDir(fixtureDir);
        const before = await readFileTree(projectRoot);

        await applyProviderWrap({ projectRoot, projectType: "nextjs", dryRun: true });

        const after = await readFileTree(projectRoot);
        expect(after).toEqual(before);
      }),
      { numRuns: FIXTURE_NAMES.length },
    );
  });
});
