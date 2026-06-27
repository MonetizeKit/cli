import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../../../lib/base-command.js";
import { checkDestructiveGuard } from "../../../lib/destructive-guard.js";

function parseOverrideValue(raw: string): unknown {
  const normalized = raw.trim();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  const asNumber = Number(normalized);
  if (!Number.isNaN(asNumber) && normalized !== "") {
    return asNumber;
  }

  return normalized;
}

export default class EntitlementsOverridesSetCommand extends BaseCommand {
  static summary = "Create or update a customer entitlement override";

  static args = {
    customer: Args.string({ description: "Customer ID", required: true }),
    feature: Args.string({ description: "Feature key", required: true }),
    value: Args.string({ description: "Override value", required: true }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
    yes: Flags.boolean({
      char: "y",
      description: "Skip destructive confirmation prompt",
      default: false,
    }),
    reason: Flags.string({
      description: "Optional override reason",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(EntitlementsOverridesSetCommand);
    const guard = await checkDestructiveGuard({
      yes: flags.yes,
      dryRun: false,
      promptMessage: `Set override for ${args.customer}:${args.feature}?`,
    });

    if (!guard.proceed) {
      this.error(guard.message ?? "Operation cancelled.", { exit: guard.exitCode });
      return;
    }

    const response = await this.api.post("/api/v1/entitlements/overrides", {
      customerId: args.customer,
      feature: args.feature,
      value: parseOverrideValue(args.value),
      reason: flags.reason,
    });
    this.output.result(response.data, "1.0.0");
  }
}
