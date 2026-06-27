import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { readObjectFile } from "../../lib/io.js";

export default class CustomersUpdateCommand extends BaseCommand {
  static summary = "Update a customer from a JSON/YAML file";

  static args = {
    id: Args.string({ description: "Customer id", required: true }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
    from: Flags.string({
      description: "Path to JSON/YAML with customer fields to update",
      required: true,
    }),
    "if-match": Flags.string({
      description: "Optional ETag for optimistic concurrency",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(CustomersUpdateCommand);
    const payload = await readObjectFile(flags.from);
    const response = await this.api.patch(
      `/api/v1/customers/${encodeURIComponent(args.id)}`,
      payload,
      flags["if-match"],
    );
    this.output.result(response.data, "1.0.0");
  }
}
