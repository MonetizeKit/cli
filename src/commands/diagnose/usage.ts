import { Args } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";

export default class DiagnoseUsageCommand extends BaseCommand {
  static summary = "Inspect usage diagnostics for customer and meter";

  static args = {
    customer: Args.string({ description: "Customer ID", required: true }),
    meter: Args.string({ description: "Meter ID", required: true }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const { args } = await this.parse(DiagnoseUsageCommand);
    const current = await this.api.get(
      `/api/v1/usage/${encodeURIComponent(args.customer)}/${encodeURIComponent(args.meter)}`,
    );
    this.output.result(
      {
        customerId: args.customer,
        meterId: args.meter,
        current: current.data,
      },
      "1.0.0",
    );
  }
}
