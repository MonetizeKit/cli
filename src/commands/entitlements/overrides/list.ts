import { Args } from "@oclif/core";

import { BaseCommand } from "../../../lib/base-command.js";

export default class EntitlementsOverridesListCommand extends BaseCommand {
  static summary = "List customer entitlement overrides";

  static args = {
    customer: Args.string({ description: "Customer ID", required: true }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const { args } = await this.parse(EntitlementsOverridesListCommand);
    const response = await this.api.get(
      `/api/v1/entitlements/overrides?customerId=${encodeURIComponent(args.customer)}`,
    );
    this.output.result(response.data, "1.0.0");
  }
}
