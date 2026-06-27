import { writeFile } from "node:fs/promises";

import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { runDoctorChecks } from "../../lib/doctor.js";
import { resolveProfileName, resolveTokenRef } from "../../lib/profile.js";

function redactBundle(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactBundle(item));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key.toLowerCase().includes("token") || key.toLowerCase().includes("secret")) {
      result[key] = "****";
      continue;
    }
    result[key] = redactBundle(entry);
  }
  return result;
}

export default class DiagnoseExportCommand extends BaseCommand {
  static summary = "Export redacted diagnostic bundle";

  static flags = {
    ...BaseCommand.globalFlags,
    out: Flags.string({
      description: "Output path for diagnostic bundle",
      default: "monetizekit-diagnostic-bundle.json",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DiagnoseExportCommand);
    const config = this.configManager.load();
    const profileName = resolveProfileName(config, flags.profile);
    const profile = config.profiles[profileName] ?? {};
    const tokenRef = resolveTokenRef(profileName, profile);

    const doctorReport = await runDoctorChecks({
      api: this.api,
      credentials: this.credentials,
      tokenRef,
      profile,
    });

    const bundle = {
      generatedAt: new Date().toISOString(),
      profile: {
        name: profileName,
        workspaceId: profile.workspaceId ?? null,
        environment: profile.environment ?? null,
      },
      doctorReport,
    };

    const redacted = redactBundle(bundle);
    await writeFile(flags.out, `${JSON.stringify(redacted, null, 2)}\n`, "utf8");
    this.output.result({ output: flags.out }, "1.0.0");
  }
}
