import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";

export default class UsageSubmitCommand extends BaseCommand {
  static summary = "Submit a usage event";

  static args = {
    customer: Args.string({ description: "Customer ID", required: true }),
    meter: Args.string({ description: "Meter ID", required: true }),
    value: Args.string({ description: "Usage value", required: true }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
    "idempotency-key": Flags.string({
      description: "Optional idempotency key",
      required: false,
    }),
    timestamp: Flags.string({
      description: "Optional ISO timestamp",
      required: false,
    }),
    description: Flags.string({
      description: "Optional usage description",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(UsageSubmitCommand);
    const value = Number(args.value);
    if (Number.isNaN(value)) {
      this.error("value must be numeric", { exit: 2 });
      return;
    }

    const payload: Record<string, unknown> = {
      customerId: args.customer,
      meterId: args.meter,
      value,
    };

    if (flags.timestamp) {
      payload.timestamp = flags.timestamp;
    }
    if (flags.description) {
      payload.description = flags.description;
    }

    const response = await this.api.post(
      "/api/v1/usage/events",
      payload,
      flags["idempotency-key"] ?? undefined,
    );
    this.output.result(response.data, "1.0.0");
  }
}
