import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { isRecord } from "../../lib/io.js";

function normalizeSubscriptions(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (isRecord(payload) && Array.isArray(payload.data)) {
    return payload.data.filter(isRecord);
  }

  return [];
}

export default class CustomersSubscriptionsCommand extends BaseCommand {
  static summary = "List subscriptions for a customer";

  static args = {
    id: Args.string({ description: "Customer id", required: true }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
    page: Flags.integer({
      description: "Page number",
      default: 1,
    }),
    "page-size": Flags.integer({
      description: "Page size",
      default: 50,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(CustomersSubscriptionsCommand);

    try {
      const response = await this.api.get<unknown>("/api/v1/subscriptions", {
        customerId: args.id,
        page: String(flags.page),
        pageSize: String(flags["page-size"]),
      });
      const subscriptions = normalizeSubscriptions(response.data).filter((subscription) => {
        const customerId = subscription.customerId;
        return typeof customerId !== "string" || customerId === args.id;
      });

      this.output.result(
        {
          customerId: args.id,
          subscriptions,
          supported: true,
        },
        "1.0.0",
      );
      return;
    } catch (error) {
      this.output.result(
        {
          customerId: args.id,
          subscriptions: [],
          supported: false,
          message:
            error instanceof Error
              ? error.message
              : "Subscriptions listing endpoint is unavailable.",
        },
        "1.0.0",
      );
    }
  }
}
