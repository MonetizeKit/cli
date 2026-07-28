import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { resolveProfileWithEnvOverrides } from "../../lib/config.js";
import { CustomerCreateInputSchema } from "../../lib/customers.js";
import { ExitCode } from "../../lib/exit-codes.js";
import { readObjectFile } from "../../lib/io.js";
import { resolveProfileName } from "../../lib/profile.js";

function isProductionEnvironment(environment: string): boolean {
  const normalized = environment.trim().toLowerCase();
  return normalized === "prod" || normalized === "production";
}

export default class CustomersCreateCommand extends BaseCommand {
  static summary = "Create a sandbox customer from a JSON/YAML file or --input-json";

  static description =
    "Accepts the customer definition either via --from <file> or --input-json " +
    "(inline or `-` for stdin), never both. Restricted to non-production environments.";

  static inputSchema = CustomerCreateInputSchema;

  static flags = {
    ...BaseCommand.globalFlags,
    from: Flags.string({
      description: "Path to JSON/YAML customer definition",
      required: false,
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

    if (flags["input-json"] === undefined && !flags.from) {
      this.failStructured(
        ExitCode.InvalidArguments,
        "customers create requires --from <file> or --input-json.",
        "Pass --from <file>, or --input-json '<json>' (or --input-json - for stdin).",
      );
    }

    if (flags["input-json"] !== undefined && flags.from) {
      this.failStructured(
        ExitCode.InvalidArguments,
        "--input-json cannot be combined with --from for this command's input.",
        "Supply either --input-json or --from, not both.",
      );
    }

    const payload = await this.resolveInput(CustomerCreateInputSchema, {
      inputJson: flags["input-json"],
      flagsCandidate: flags["input-json"] === undefined ? await readObjectFile(flags.from!) : undefined,
    });

    const response = await this.api.post(
      "/api/v1/customers",
      payload,
      flags["idempotency-key"],
    );
    this.output.result(response.data, "1.0.0");
  }
}
