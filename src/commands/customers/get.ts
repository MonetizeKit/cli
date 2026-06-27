import { Args } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";

export default class CustomersGetCommand extends BaseCommand {
  static summary = "Get a customer by id";

  static args = {
    id: Args.string({ description: "Customer id", required: true }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const { args } = await this.parse(CustomersGetCommand);
    const response = await this.api.get(`/api/v1/customers/${encodeURIComponent(args.id)}`);
    this.output.result(response.data, "1.0.0");
  }
}
