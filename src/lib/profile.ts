import type { CliConfig, Profile } from "./config.js";

export function resolveProfileName(config: CliConfig, requestedName?: string): string {
  return requestedName ?? config.activeProfile ?? "default";
}

export function resolveTokenRef(profileName: string, profile: Profile): string {
  return profile.tokenRef ?? `monetizekit:${profileName}`;
}
