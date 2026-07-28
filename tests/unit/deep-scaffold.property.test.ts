import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { deepScaffoldProject } from "../../src/lib/deep-scaffold.js";
import type { ProjectType } from "../../src/lib/init.js";

const UNSUPPORTED_PROJECT_TYPES: ProjectType[] = ["go", "python", "java", "generic"];

describe("deep-scaffold property tests", () => {
  // Feature: init-scaffolding-depth, Property: unsupported project types are always unsupported
  it("returns { supported: false, steps: [] } for every unsupported project type", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "monetizekit-deep-scaffold-"));

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...UNSUPPORTED_PROJECT_TYPES),
        fc.boolean(),
        async (projectType, dryRun) => {
          const result = await deepScaffoldProject({ projectRoot, projectType, dryRun });
          expect(result).toEqual({ supported: false, steps: [] });
        },
      ),
      { numRuns: 20 },
    );
  });
});
