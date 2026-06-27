import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { OutputManager } from "../../src/lib/output.js";

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function createCapturedManager(options: ConstructorParameters<typeof OutputManager>[0]) {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const manager = new OutputManager(options, {
    stdout: (chunk) => stdout.push(chunk),
    stderr: (chunk) => stderr.push(chunk),
  });

  return { manager, stdout, stderr };
}

describe("output manager property tests", () => {
  // Feature: monetizekit-cli, Property 1: JSON output envelope structure
  it("writes schemaVersion + data envelope on stdout in json mode", () => {
    const dataArb = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 8 }),
      fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
    );
    const semverArb = fc
      .tuple(
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
      )
      .map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

    fc.assert(
      fc.property(dataArb, semverArb, (data, schemaVersion) => {
        const { manager, stdout, stderr } = createCapturedManager({
          json: true,
          quiet: false,
          noColor: false,
        });

        manager.info("info-channel-message");
        manager.result(data, schemaVersion);

        expect(stderr.join("")).toContain("info-channel-message");

        const payload = JSON.parse(stdout.join(""));
        expect(payload).toEqual({
          schemaVersion,
          data,
        });
      }),
      { numRuns: 100 },
    );
  });

  // Feature: monetizekit-cli, Property 2: Quiet mode suppresses non-essential output
  it("suppresses info/warn messages in quiet mode", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.string(), (info, warning, result) => {
        const { manager, stdout, stderr } = createCapturedManager({
          json: false,
          quiet: true,
          noColor: false,
        });

        manager.info(info);
        manager.warn(warning);
        manager.result(result, "1.0.0");

        expect(stderr.join("")).toBe("");
        expect(stdout.join("")).not.toBe("");
      }),
      { numRuns: 100 },
    );
  });

  // Feature: monetizekit-cli, Property 3: No-color mode strips ANSI codes
  it("strips ANSI escape sequences when no-color mode is active", () => {
    const ansiTextArb = fc
      .tuple(fc.string(), fc.string(), fc.string())
      .map(([left, middle, right]) => `${left}\u001b[31m${middle}\u001b[0m${right}`);

    fc.assert(
      fc.property(ansiTextArb, (ansiText) => {
        const { manager, stdout, stderr } = createCapturedManager({
          json: false,
          quiet: false,
          noColor: true,
        });

        manager.info(ansiText);
        manager.warn(ansiText);
        manager.error(ansiText);
        manager.result(ansiText, "1.0.0");

        const combinedOutput = `${stdout.join("")}${stderr.join("")}`;
        expect(combinedOutput).not.toMatch(ANSI_PATTERN);
      }),
      { numRuns: 100 },
    );
  });
});
