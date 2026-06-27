import { Args } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";

export default class UsageValidateCommand extends BaseCommand {
  static summary = "Validate usage counters for customer + meter";

  static args = {
    customer: Args.string({ description: "Customer ID", required: true }),
    meter: Args.string({ description: "Meter ID", required: true }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const { args } = await this.parse(UsageValidateCommand);
    const response = await this.api.get(
      `/api/v1/usage/${encodeURIComponent(args.customer)}/${encodeURIComponent(args.meter)}`,
    );
    this.output.result(response.data, "1.0.0");
  }
}
