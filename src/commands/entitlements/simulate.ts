import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";

export default class EntitlementsSimulateCommand extends BaseCommand {
  static summary = "Simulate effective entitlement decision";

  static args = {
    customer: Args.string({ description: "Customer ID", required: true }),
    feature: Args.string({ description: "Feature key", required: true }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
    context: Flags.string({
      description: "Optional JSON context payload",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(EntitlementsSimulateCommand);
    const query = flags.context ? `?context=${encodeURIComponent(flags.context)}` : "";
    const response = await this.api.get(
      `/api/v1/entitlements/${encodeURIComponent(args.customer)}/${encodeURIComponent(args.feature)}${query}`,
    );
    this.output.result(response.data, "1.0.0");
  }
}
