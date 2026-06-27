import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { resolveProfileWithEnvOverrides } from "../../lib/config.js";
import { readObjectFile } from "../../lib/io.js";
import { resolveProfileName } from "../../lib/profile.js";

function isProductionEnvironment(environment: string): boolean {
  const normalized = environment.trim().toLowerCase();
  return normalized === "prod" || normalized === "production";
}

export default class CustomersCreateCommand extends BaseCommand {
  static summary = "Create a sandbox customer from a JSON/YAML file";

  static flags = {
    ...BaseCommand.globalFlags,
    from: Flags.string({
      description: "Path to JSON/YAML customer definition",
      required: true,
    }),
    "idempotency-key": Flags.string({
      description: "Optional idempotency key",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(CustomersCreateCommand);
    const config = this.configManager.load();
    const profileName = resolveProfileName(config, flags.profile);
    const profile = config.profiles[profileName] ?? {};
    const resolvedProfile = resolveProfileWithEnvOverrides({
      ...profile,
      environment: flags.env ?? profile.environment,
    });

    if (isProductionEnvironment(resolvedProfile.environment)) {
      this.error(
        "customers create is restricted to non-production environments. Use --env dev/staging.",
        {
          exit: 2,
        },
      );
      return;
    }

    const payload = await readObjectFile(flags.from);
    const response = await this.api.post(
      "/api/v1/customers",
      payload,
      flags["idempotency-key"],
    );
    this.output.result(response.data, "1.0.0");
  }
}
