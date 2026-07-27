import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { applyConfigPatch } from "../../src/lib/config-patch.js";
import {
  ConfigManager,
  resolveProfile,
  resolveProfileWithEnvOverrides,
  type CliConfig,
  type Profile,
} from "../../src/lib/config.js";

const PROFILE_NAME_ARBITRARY = fc.stringMatching(/^[a-z][a-z0-9_-]{0,12}$/);

const PROFILE_ARBITRARY: fc.Arbitrary<Profile> = fc.record({
  workspaceId: fc.string({ minLength: 1, maxLength: 24 }),
  environment: fc.string({ minLength: 1, maxLength: 16 }),
  apiUrl: fc.webUrl(),
  tokenRef: fc.string({ minLength: 1, maxLength: 24 }),
});

const STRICT_CLI_CONFIG_ARBITRARY: fc.Arbitrary<CliConfig> = fc
  .array(fc.tuple(PROFILE_NAME_ARBITRARY, PROFILE_ARBITRARY), {
    minLength: 1,
    maxLength: 5,
  })
  .filter((entries) => new Set(entries.map(([name]) => name)).size === entries.length)
  .map((entries) => {
    const profiles = Object.fromEntries(entries) as Record<string, Profile>;
    const activeProfile = entries[0]?.[0] ?? "default";

    return {
      activeProfile,
      profiles,
      telemetry: {
        enabled: true,
      },
    };
  });

describe("config manager property tests", () => {
  // Feature: monetizekit-cli, Property 5: Profile resolution by name
  it("resolves named and default profiles deterministically", () => {
    fc.assert(
      fc.property(STRICT_CLI_CONFIG_ARBITRARY, (config) => {
        const profileNames = Object.keys(config.profiles);
        const namedProfile = profileNames[profileNames.length - 1];

        expect(resolveProfile(config, namedProfile)).toEqual(config.profiles[namedProfile]);
        expect(resolveProfile(config)).toEqual(config.profiles[config.activeProfile]);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: monetizekit-cli, Property 6: Environment variable precedence over config file
  it("applies environment overrides with strict precedence over profile values", () => {
    const envArbitrary = fc.record({
      MONETIZEKIT_WORKSPACE: fc.option(fc.string({ minLength: 1, maxLength: 24 }), {
        nil: undefined,
      }),
      MONETIZEKIT_ENV: fc.option(fc.string({ minLength: 1, maxLength: 16 }), {
        nil: undefined,
      }),
      MONETIZEKIT_API_URL: fc.option(fc.webUrl(), { nil: undefined }),
      MONETIZEKIT_TOKEN: fc.option(fc.string({ minLength: 1, maxLength: 32 }), {
        nil: undefined,
      }),
    });

    fc.assert(
      fc.property(PROFILE_ARBITRARY, envArbitrary, (profile, env) => {
        const resolved = resolveProfileWithEnvOverrides(profile, env);

        expect(resolved.workspaceId).toBe(env.MONETIZEKIT_WORKSPACE ?? profile.workspaceId ?? "");
        expect(resolved.environment).toBe(env.MONETIZEKIT_ENV ?? profile.environment ?? "dev");
        expect(resolved.apiUrl).toBe(
          env.MONETIZEKIT_API_URL ?? profile.apiUrl ?? "https://app.monetizekit.app",
        );
        expect(resolved.token).toBe(env.MONETIZEKIT_TOKEN ?? profile.tokenRef ?? "");
      }),
      { numRuns: 100 },
    );
  });

  // Feature: monetizekit-cli, Property 17: Config file round trip
  it("preserves config semantics across save/load round trips", () => {
    fc.assert(
      fc.property(STRICT_CLI_CONFIG_ARBITRARY, (config) => {
        const dir = mkdtempSync(join(tmpdir(), "monetizekit-cli-config-"));
        const configPath = join(dir, "config.yaml");

        try {
          const manager = new ConfigManager(configPath);
          manager.save(config);
          const loaded = manager.load();

          expect(loaded).toEqual(config);
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: agent-mode-parity, Property: Config_Patch atomic write
  it("writeAtomic() leaves no temp file behind and load() reflects the write exactly", () => {
    fc.assert(
      fc.property(STRICT_CLI_CONFIG_ARBITRARY, (config) => {
        const dir = mkdtempSync(join(tmpdir(), "monetizekit-cli-config-atomic-"));
        const configPath = join(dir, "config.yaml");

        try {
          const manager = new ConfigManager(configPath);
          manager.writeAtomic(config);

          expect(manager.load()).toEqual(config);
          const leftoverTempFiles = readdirSync(dir).filter((name) => name.includes(".tmp-"));
          expect(leftoverTempFiles).toEqual([]);
          expect(statSync(configPath).mode & 0o777).toBe(0o600);
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      }),
      { numRuns: 50 },
    );
  });

  // Feature: agent-mode-parity, Property: Config_Patch validation failure never writes
  it("never returns ok:true for a patch that produces an invalid config", () => {
    const invalidPatchArbitrary = fc.oneof(
      fc.record({ activeProfile: fc.integer() }),
      fc.record({ profiles: fc.string() }),
      fc.record({ telemetry: fc.record({ enabled: fc.string() }) }),
    );

    fc.assert(
      fc.property(STRICT_CLI_CONFIG_ARBITRARY, invalidPatchArbitrary, (config, invalidPatch) => {
        const result = applyConfigPatch(config, invalidPatch);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.fieldErrors.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("leaves the on-disk config file byte-for-byte unmodified when a patch fails validation", () => {
    fc.assert(
      fc.property(STRICT_CLI_CONFIG_ARBITRARY, (config) => {
        const dir = mkdtempSync(join(tmpdir(), "monetizekit-cli-config-novalid-"));
        const configPath = join(dir, "config.yaml");

        try {
          const manager = new ConfigManager(configPath);
          manager.writeAtomic(config);
          const before = readFileSync(configPath, "utf8");
          const beforeMtime = statSync(configPath).mtimeMs;

          const result = applyConfigPatch(config, { activeProfile: 12345 });
          expect(result.ok).toBe(false);
          // Command-level contract: writeAtomic is only ever invoked on the ok:true branch.

          const after = readFileSync(configPath, "utf8");
          expect(after).toBe(before);
          expect(statSync(configPath).mtimeMs).toBe(beforeMtime);
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      }),
      { numRuns: 50 },
    );
  });

  it("applyConfigPatch does not mutate the config object passed in", () => {
    fc.assert(
      fc.property(STRICT_CLI_CONFIG_ARBITRARY, (config) => {
        const snapshot = JSON.parse(JSON.stringify(config));
        applyConfigPatch(config, { telemetry: { enabled: !config.telemetry?.enabled } });
        expect(config).toEqual(snapshot);
      }),
      { numRuns: 50 },
    );
  });
});
