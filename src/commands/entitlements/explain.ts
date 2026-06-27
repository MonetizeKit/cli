import { Args } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";

export default class EntitlementsExplainCommand extends BaseCommand {
  static summary = "Explain entitlement precedence chain";

  static args = {
    customer: Args.string({ description: "Customer ID", required: true }),
    feature: Args.string({ description: "Feature key", required: true }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const { args } = await this.parse(EntitlementsExplainCommand);
    const response = await this.api.get(
      `/api/v1/entitlements/${encodeURIComponent(args.customer)}/${encodeURIComponent(args.feature)}?explain=true`,
    );
    this.output.result(response.data, "1.0.0");
  }
}
