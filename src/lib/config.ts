import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { z } from "zod";
import YAML from "yaml";

export const ProfileSchema = z.object({
  workspaceId: z.string().optional(),
  environment: z.string().optional(),
  apiUrl: z.string().optional(),
  tokenRef: z.string().optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const CliConfigSchema = z.object({
  activeProfile: z.string(),
  profiles: z.record(ProfileSchema),
  telemetry: z.object({ enabled: z.boolean() }).optional(),
});
export type CliConfig = z.infer<typeof CliConfigSchema>;

export interface ResolvedProfile {
  workspaceId: string;
  environment: string;
  apiUrl: string;
  token: string;
}

const DEFAULT_API_URL = "https://app.monetizekit.app";
const DEFAULT_ENVIRONMENT = "dev";

function getDefaultConfig(): CliConfig {
  return {
    activeProfile: "default",
    profiles: {
      default: {},
    },
    telemetry: {
      enabled: false,
    },
  };
}

export function getDefaultConfigPath(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (platform === "win32") {
    const appData = env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(appData, "MonetizeKit", "config.yaml");
  }

  return join(homedir(), ".config", "monetizekit", "config.yaml");
}

export function resolveProfile(config: CliConfig, name?: string): Profile {
  const profileName = name ?? config.activeProfile ?? "default";
  return config.profiles[profileName] ?? config.profiles.default ?? {};
}

export function resolveProfileWithEnvOverrides(
  profile: Profile,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedProfile {
  return {
    workspaceId: env.MONETIZEKIT_WORKSPACE ?? profile.workspaceId ?? "",
    environment: env.MONETIZEKIT_ENV ?? profile.environment ?? DEFAULT_ENVIRONMENT,
    apiUrl: env.MONETIZEKIT_API_URL ?? profile.apiUrl ?? DEFAULT_API_URL,
    token: env.MONETIZEKIT_TOKEN ?? profile.tokenRef ?? "",
  };
}

export class ConfigManager {
  private readonly configPath: string;

  constructor(configPath = getDefaultConfigPath()) {
    this.configPath = configPath;
  }

  load(): CliConfig {
    if (!existsSync(this.configPath)) {
      return getDefaultConfig();
    }

    const raw = readFileSync(this.configPath, "utf8");
    const parsed = YAML.parse(raw) as Partial<CliConfig> | null;
    const defaults = getDefaultConfig();

    return {
      activeProfile: parsed?.activeProfile ?? defaults.activeProfile,
      profiles: parsed?.profiles ?? defaults.profiles,
      telemetry: parsed?.telemetry ?? defaults.telemetry,
    };
  }

  save(config: CliConfig): void {
    mkdirSync(dirname(this.configPath), { recursive: true });
    writeFileSync(this.configPath, YAML.stringify(config), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  /**
   * Requirement 4.3: writes the config file atomically (temp file in the
   * same directory, fsync'd, then renamed over the real path), so a crash or
   * concurrent write during `config patch` never leaves a partially-written
   * or corrupted config file. `save()` is left untouched for existing
   * callers per `design.md`.
   */
  writeAtomic(config: CliConfig): void {
    const dir = dirname(this.configPath);
    mkdirSync(dir, { recursive: true });

    const tempPath = join(dir, `.config.yaml.tmp-${process.pid}-${Date.now()}`);
    const fd = openSync(tempPath, "w", 0o600);
    try {
      writeFileSync(fd, YAML.stringify(config));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }

    renameSync(tempPath, this.configPath);
  }

  getProfile(name?: string): Profile {
    return resolveProfile(this.load(), name);
  }

  setProfile(name: string, profile: Profile): void {
    const config = this.load();
    config.profiles[name] = profile;
    this.save(config);
  }

  getActiveProfile(): Profile {
    return this.getProfile();
  }

  resolveWithEnvOverrides(profile: Profile): ResolvedProfile {
    return resolveProfileWithEnvOverrides(profile);
  }
}
