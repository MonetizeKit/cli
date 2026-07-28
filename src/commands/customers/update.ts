import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { CustomerUpdateInputSchema } from "../../lib/customers.js";
import { ExitCode } from "../../lib/exit-codes.js";
import { readObjectFile } from "../../lib/io.js";

export default class CustomersUpdateCommand extends BaseCommand {
  static summary = "Update a customer from a JSON/YAML file or --input-json";

  static description =
    "Accepts the fields to update either via --from <file> or --input-json " +
    "(inline or `-` for stdin), never both.";

  static inputSchema = CustomerUpdateInputSchema;

  static args = {
    id: Args.string({ description: "Customer id", required: true }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
    from: Flags.string({
      description: "Path to JSON/YAML with customer fields to update",
      required: false,
    }),
    "if-match": Flags.string({
      description: "Optional ETag for optimistic concurrency",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(CustomersUpdateCommand);

    if (flags["input-json"] === undefined && !flags.from) {
      this.failStructured(
        ExitCode.InvalidArguments,
        "customers update requires --from <file> or --input-json.",
        "Pass --from <file>, or --input-json '<json>' (or --input-json - for stdin).",
      );
    }

    if (flags["input-json"] !== undefined && flags.from) {
      this.failStructured(
        ExitCode.InvalidArguments,
        "--input-json cannot be combined with --from for this command's input.",
        "Supply either --input-json or --from, not both.",
      );
    }

    const payload = await this.resolveInput(CustomerUpdateInputSchema, {
      inputJson: flags["input-json"],
      flagsCandidate: flags["input-json"] === undefined ? await readObjectFile(flags.from!) : undefined,
    });

    const response = await this.api.patch(
      `/api/v1/customers/${encodeURIComponent(args.id)}`,
      payload,
      flags["if-match"],
    );
    this.output.result(response.data, "1.0.0");
  }
}
