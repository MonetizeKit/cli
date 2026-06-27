import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../../../lib/base-command.js";
import { checkDestructiveGuard } from "../../../lib/destructive-guard.js";

export default class EntitlementsOverridesClearCommand extends BaseCommand {
  static summary = "Clear a customer entitlement override";

  static args = {
    customer: Args.string({ description: "Customer ID", required: true }),
    feature: Args.string({ description: "Feature key", required: true }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
    yes: Flags.boolean({
      char: "y",
      description: "Skip destructive confirmation prompt",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(EntitlementsOverridesClearCommand);
    const guard = await checkDestructiveGuard({
      yes: flags.yes,
      dryRun: false,
      promptMessage: `Clear override for ${args.customer}:${args.feature}?`,
    });

    if (!guard.proceed) {
      this.error(guard.message ?? "Operation cancelled.", { exit: guard.exitCode });
      return;
    }

    const response = await this.api.post("/api/v1/entitlements/overrides/clear", {
      customerId: args.customer,
      feature: args.feature,
    });
    const payload = response.data;
    this.output.result(payload, "1.0.0");
  }
}
