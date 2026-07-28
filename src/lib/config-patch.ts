import merge from "json-merge-patch";

import { CliConfigSchema, type CliConfig } from "./config.js";
import { mapZodIssuesToFieldErrors, type FieldError } from "./input-json.js";

export type ApplyConfigPatchResult =
  | { ok: true; config: CliConfig }
  | { ok: false; fieldErrors: FieldError[] };

/**
 * Requirement 4.1/4.2: applies `patch` as a JSON Merge Patch (RFC 7396)
 * against `current` and validates the merged result against Config_Schema
 * before the caller may write it. Never mutates `current`.
 */
export function applyConfigPatch(current: CliConfig, patch: unknown): ApplyConfigPatchResult {
  const merged = merge.apply(structuredClone(current), patch) as unknown;
  const result = CliConfigSchema.safeParse(merged);
  if (!result.success) {
    return { ok: false, fieldErrors: mapZodIssuesToFieldErrors(result.error.issues) };
  }

  return { ok: true, config: result.data };
}
