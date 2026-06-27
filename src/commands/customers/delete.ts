import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";

export default class CustomersDeleteCommand extends BaseCommand {
  static summary = "Archive (soft-delete) a customer by id";

  static args = {
    id: Args.string({ description: "Customer id", required: true }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
    "if-match": Flags.string({
      description: "Optional ETag for optimistic concurrency",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(CustomersDeleteCommand);
    await this.api.delete(
      `/api/v1/customers/${encodeURIComponent(args.id)}`,
      flags["if-match"],
    );
    this.output.result({ id: args.id, archived: true }, "1.0.0");
  }
}
