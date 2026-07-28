import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { scaffoldMonetizekitProject } from "../../src/lib/init.js";
import type { ProjectType } from "../../src/lib/init.js";
import { readFileTree } from "../support/fixtures.js";

const PROJECT_TYPES: ProjectType[] = ["nextjs", "node", "go", "python", "java", "generic"];

describe("scaffoldMonetizekitProject property tests", () => {
  // Feature: init-scaffolding-depth, Property: Idempotent_Rerun produces zero diff
  it("running twice makes zero additional changes, for every project type and stripe setting", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...PROJECT_TYPES), fc.boolean(), async (projectType, stripe) => {
        const projectRoot = await mkdtemp(join(tmpdir(), "monetizekit-init-scaffold-"));

        await scaffoldMonetizekitProject({ projectRoot, projectType, stripe, dryRun: false });
        const afterFirst = await readFileTree(projectRoot);

        await scaffoldMonetizekitProject({ projectRoot, projectType, stripe, dryRun: false });
        const afterSecond = await readFileTree(projectRoot);

        expect(afterSecond).toEqual(afterFirst);
      }),
      { numRuns: 20 },
    );
  });

  // Feature: init-scaffolding-depth, Property: --dry-run never writes
  it("dry-run never writes, regardless of what the computed diffs say would change", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...PROJECT_TYPES), fc.boolean(), async (projectType, stripe) => {
        const projectRoot = await mkdtemp(join(tmpdir(), "monetizekit-init-scaffold-"));
        const before = await readFileTree(projectRoot);

        await scaffoldMonetizekitProject({ projectRoot, projectType, stripe, dryRun: true });

        const after = await readFileTree(projectRoot);
        expect(after).toEqual(before);
      }),
      { numRuns: 20 },
    );
  });
});
