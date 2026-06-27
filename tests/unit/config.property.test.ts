import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import fc from "fast-check";
import { describe, expect, it } from "vitest";

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
          env.MONETIZEKIT_API_URL ?? profile.apiUrl ?? "https://api.monetizekit.com",
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
});
