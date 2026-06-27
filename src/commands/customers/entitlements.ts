import { Args } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";

export default class CustomersEntitlementsCommand extends BaseCommand {
  static summary = "Get effective entitlements for a customer";

  static args = {
    id: Args.string({ description: "Customer id", required: true }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const { args } = await this.parse(CustomersEntitlementsCommand);
    const response = await this.api.get(`/api/v1/entitlements/${encodeURIComponent(args.id)}`);
    this.output.result(response.data, "1.0.0");
  }
}
