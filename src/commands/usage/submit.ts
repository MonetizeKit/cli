import { Args, Flags } from "@oclif/core";
import { z } from "zod";

import { BaseCommand } from "../../lib/base-command.js";

export const UsageSubmitInputSchema = z.object({
  customer: z.string().min(1),
  meter: z.string().min(1),
  value: z.coerce.number(),
  timestamp: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
});

export default class UsageSubmitCommand extends BaseCommand {
  static summary = "Submit a usage event";

  static inputSchema = UsageSubmitInputSchema;

  static args = {
    customer: Args.string({ description: "Customer ID", required: false }),
    meter: Args.string({ description: "Meter ID", required: false }),
    value: Args.string({ description: "Usage value", required: false }),
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
    const input = await this.resolveInput(UsageSubmitInputSchema, {
      inputJson: flags["input-json"],
      flagsCandidate: {
        customer: args.customer,
        meter: args.meter,
        value: args.value,
        timestamp: flags.timestamp,
        description: flags.description,
      },
    });

    const payload: Record<string, unknown> = {
      customerId: input.customer,
      meterId: input.meter,
      value: input.value,
    };

    if (input.timestamp) {
      payload.timestamp = input.timestamp;
    }
    if (input.description) {
      payload.description = input.description;
    }

    const response = await this.api.post(
      "/api/v1/usage/events",
      payload,
      flags["idempotency-key"] ?? undefined,
    );
    this.output.result(response.data, "1.0.0");
  }
}
