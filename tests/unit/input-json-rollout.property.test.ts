import fc from "fast-check";
import type { z } from "zod";
import { describe, expect, it } from "vitest";

import { EntitlementsSimulateInputSchema } from "../../src/commands/entitlements/simulate.js";
import { UsageSubmitInputSchema } from "../../src/commands/usage/submit.js";
import { CatalogObjectInputSchema } from "../../src/lib/catalog.js";
import { CustomerCreateInputSchema, CustomerUpdateInputSchema } from "../../src/lib/customers.js";
import { validateAgainstSchema } from "../../src/lib/input-json.js";

/**
 * Feature: agent-mode-parity, Property: --input-json and flag input are equivalent
 *
 * Each in-scope command builds a plain object from flags/args, then validates
 * it against the same Zod schema used for `--input-json`. This property
 * asserts that for any logically-equivalent document, taking the flags path
 * (validating the object directly) and the --input-json path (round-tripping
 * the same object through JSON serialization first) produce identical
 * validation results — the schema is the single source of truth either way.
 */
function expectEquivalentPaths(schema: z.ZodType<unknown>, document: unknown): void {
  const flagsPathResult = validateAgainstSchema(schema, document);
  const inputJsonPathResult = validateAgainstSchema(schema, JSON.parse(JSON.stringify(document)) as unknown);

  expect(inputJsonPathResult).toEqual(flagsPathResult);
}

describe("--input-json rollout: flag input and --input-json are equivalent", () => {
  it("catalog create/update body: CatalogObjectInputSchema", () => {
    const catalogObjectArb = fc.dictionary(
      fc.stringMatching(/^[a-z][a-z0-9_]{0,10}$/),
      fc.oneof(fc.string({ maxLength: 20 }), fc.integer(), fc.boolean()),
    );

    fc.assert(
      fc.property(catalogObjectArb, (document) => {
        expectEquivalentPaths(CatalogObjectInputSchema, document);
      }),
      { numRuns: 100 },
    );
  });

  it("customers create: CustomerCreateInputSchema", () => {
    const customerCreateArb = fc.record({
      externalId: fc.string({ minLength: 1, maxLength: 24 }),
      email: fc.option(fc.emailAddress(), { nil: undefined }),
      name: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: undefined }),
    });

    fc.assert(
      fc.property(customerCreateArb, (document) => {
        expectEquivalentPaths(CustomerCreateInputSchema, document);
      }),
      { numRuns: 100 },
    );
  });

  it("customers update: CustomerUpdateInputSchema", () => {
    const customerUpdateArb = fc.record({
      externalId: fc.option(fc.string({ minLength: 1, maxLength: 24 }), { nil: undefined }),
      name: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: undefined }),
    });

    fc.assert(
      fc.property(customerUpdateArb, (document) => {
        expectEquivalentPaths(CustomerUpdateInputSchema, document);
      }),
      { numRuns: 100 },
    );
  });

  it("entitlements simulate: EntitlementsSimulateInputSchema", () => {
    const simulateArb = fc.record({
      customer: fc.string({ minLength: 1, maxLength: 24 }),
      feature: fc.string({ minLength: 1, maxLength: 24 }),
      context: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: undefined }),
    });

    fc.assert(
      fc.property(simulateArb, (document) => {
        expectEquivalentPaths(EntitlementsSimulateInputSchema, document);
      }),
      { numRuns: 100 },
    );
  });

  it("usage submit: UsageSubmitInputSchema", () => {
    const usageSubmitArb = fc.record({
      customer: fc.string({ minLength: 1, maxLength: 24 }),
      meter: fc.string({ minLength: 1, maxLength: 24 }),
      value: fc.integer({ min: -1_000_000, max: 1_000_000 }),
      timestamp: fc.option(fc.string({ minLength: 1, maxLength: 24 }), { nil: undefined }),
      description: fc.option(fc.string({ minLength: 1, maxLength: 60 }), { nil: undefined }),
    });

    fc.assert(
      fc.property(usageSubmitArb, (document) => {
        expectEquivalentPaths(UsageSubmitInputSchema, document);
      }),
      { numRuns: 100 },
    );
  });
});
