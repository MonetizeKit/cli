import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  serializeCatalogSnapshot,
  validateCatalogSnapshot,
} from "../../src/lib/catalog-files.js";
import { loadCatalogObjectFromFile, writeCatalogOutputFile } from "../../src/lib/catalog.js";

const ID_ARB = fc.stringMatching(/^[a-z][a-z0-9_-]{2,18}$/);

const CATALOG_OBJECT_ARB = fc.record({
  id: ID_ARB,
  name: fc.string({ minLength: 1, maxLength: 40 }),
  description: fc.string({ maxLength: 80 }),
  enabled: fc.boolean(),
  metadata: fc.dictionary(
    fc.stringMatching(/^[a-z][a-z0-9_-]{0,10}$/),
    fc.oneof(fc.string({ maxLength: 20 }), fc.integer({ min: -1000, max: 1000 }), fc.boolean()),
  ),
  limits: fc.array(fc.integer({ min: 0, max: 10000 }), { minLength: 0, maxLength: 5 }),
});

describe("catalog property tests", () => {
  // Feature: monetizekit-cli, Property 10: Catalog file I/O round trip
  it("preserves catalog object semantics across --out/--from style file round trips", () => {
    fc.assert(
      fc.asyncProperty(CATALOG_OBJECT_ARB, fc.constantFrom("yaml", "json"), async (object, format) => {
        const dir = mkdtempSync(join(tmpdir(), "monetizekit-cli-catalog-"));
        const path = join(dir, `object.${format}`);

        try {
          await writeCatalogOutputFile(path, object);
          const loaded = await loadCatalogObjectFromFile(path);
          expect(loaded).toEqual(object);
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: monetizekit-cli, Property 11: Catalog export deterministic ordering
  it("serializes export file entries deterministically", () => {
    const objectArrayArb = fc.uniqueArray(CATALOG_OBJECT_ARB, {
      selector: (object) => object.id,
      minLength: 0,
      maxLength: 5,
    });

    fc.assert(
      fc.property(
        objectArrayArb,
        objectArrayArb,
        objectArrayArb,
        objectArrayArb,
        objectArrayArb,
        (plans, features, addons, products, meters) => {
          const snapshot = {
            plans,
            features,
            addons,
            products,
            meters,
          };

          const first = serializeCatalogSnapshot(snapshot);
          const second = serializeCatalogSnapshot(snapshot);
          expect(first).toEqual(second);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: monetizekit-cli, Property 12: Catalog validation detects cross-reference errors
  it("reports broken plan cross-references with explicit reference type", () => {
    fc.assert(
      fc.property(
        ID_ARB,
        ID_ARB,
        fc.constantFrom<"feature" | "meter" | "addon">("feature", "meter", "addon"),
        (planId, missingId, referenceType) => {
          const entitlements =
            referenceType === "feature"
              ? [{ feature: missingId }]
              : referenceType === "meter"
                ? [{ meter: missingId }]
                : [{ addon: missingId }];

          const snapshot = {
            plans: [{ id: planId, entitlements }],
            features: [],
            addons: [],
            products: [],
            meters: [],
          };

          const errors = validateCatalogSnapshot(snapshot);
          const expectedReferenceLabel =
            referenceType === "addon" ? "add-on" : referenceType;
          expect(errors.some((error) => error.includes(`plans/${planId}`))).toBe(true);
          expect(errors.some((error) => error.includes(`missing ${expectedReferenceLabel}`))).toBe(
            true,
          );
          expect(errors.some((error) => error.includes(`"${missingId}"`))).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
