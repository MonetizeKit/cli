import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { deepScaffoldProject } from "../../src/lib/deep-scaffold.js";
import { copyFixtureInputToTempDir, DEEP_SCAFFOLD_FIXTURES_ROOT, readFileTree } from "../support/fixtures.js";

const APP_ROUTER_FIXTURES_ROOT = join(DEEP_SCAFFOLD_FIXTURES_ROOT, "nextjs-app-router");
const MIDDLEWARE_FIXTURES_ROOT = join(DEEP_SCAFFOLD_FIXTURES_ROOT, "nextjs-middleware");

const NEXTJS_FIXTURE_DIRS = [
  join(APP_ROUTER_FIXTURES_ROOT, "bare-layout"),
  join(APP_ROUTER_FIXTURES_ROOT, "with-providers"),
  join(APP_ROUTER_FIXTURES_ROOT, "unrecognized-shape"),
  join(APP_ROUTER_FIXTURES_ROOT, "already-present"),
  join(MIDDLEWARE_FIXTURES_ROOT, "no-file"),
  join(MIDDLEWARE_FIXTURES_ROOT, "without-matcher"),
  join(MIDDLEWARE_FIXTURES_ROOT, "recognized-matcher"),
  join(MIDDLEWARE_FIXTURES_ROOT, "unrecognized-matcher"),
  join(MIDDLEWARE_FIXTURES_ROOT, "already-present"),
];

describe("deepScaffoldProject end-to-end property tests (all four steps combined)", () => {
  // Feature: init-scaffolding-depth, Property: Idempotent_Rerun produces zero diff (full command)
  it("running deepScaffoldProject twice makes zero additional changes for every fixture project", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...NEXTJS_FIXTURE_DIRS), async (fixtureDir) => {
        const projectRoot = await copyFixtureInputToTempDir(fixtureDir);

        const first = await deepScaffoldProject({ projectRoot, projectType: "nextjs", dryRun: false });
        const afterFirst = await readFileTree(projectRoot);

        const second = await deepScaffoldProject({ projectRoot, projectType: "nextjs", dryRun: false });
        const afterSecond = await readFileTree(projectRoot);

        expect(second.steps.every((step) => step.status !== "applied")).toBe(true);
        for (const [index, step] of first.steps.entries()) {
          if (step.status === "applied") {
            expect(second.steps[index]?.status).toBe("already-present");
          } else {
            expect(second.steps[index]).toEqual(step);
          }
        }

        expect(afterSecond).toEqual(afterFirst);
      }),
      { numRuns: NEXTJS_FIXTURE_DIRS.length },
    );
  });

  it("running deepScaffoldProject twice on a fresh node project makes zero additional changes", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "monetizekit-deep-scaffold-node-"));

    const first = await deepScaffoldProject({ projectRoot, projectType: "node", dryRun: false });
    const afterFirst = await readFileTree(projectRoot);

    const second = await deepScaffoldProject({ projectRoot, projectType: "node", dryRun: false });
    const afterSecond = await readFileTree(projectRoot);

    expect(second.steps.every((step) => step.status !== "applied")).toBe(true);
    for (const [index, step] of first.steps.entries()) {
      if (step.status === "applied") {
        expect(second.steps[index]?.status).toBe("already-present");
      } else {
        expect(second.steps[index]).toEqual(step);
      }
    }

    expect(afterSecond).toEqual(afterFirst);
  });

  // Feature: init-scaffolding-depth, Property: --dry-run never writes
  it("dry-run never writes, regardless of what any step's computed diff says would change", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...NEXTJS_FIXTURE_DIRS), async (fixtureDir) => {
        const projectRoot = await copyFixtureInputToTempDir(fixtureDir);
        const before = await readFileTree(projectRoot);

        await deepScaffoldProject({ projectRoot, projectType: "nextjs", dryRun: true });

        const after = await readFileTree(projectRoot);
        expect(after).toEqual(before);
      }),
      { numRuns: NEXTJS_FIXTURE_DIRS.length },
    );
  });
});
