import { Args } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";

export default class DiagnoseWebhooksCommand extends BaseCommand {
  static summary = "Inspect webhook delivery diagnostics for an endpoint";

  static args = {
    endpoint: Args.string({ description: "Webhook endpoint identifier", required: true }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const { args } = await this.parse(DiagnoseWebhooksCommand);
    try {
      const response = await this.api.get(
        `/api/v1/webhooks/deliveries?endpointId=${encodeURIComponent(args.endpoint)}`,
      );
      this.output.result(response.data, "1.0.0");
      return;
    } catch (error) {
      this.output.result(
        {
          endpointId: args.endpoint,
          supported: false,
          message:
            error instanceof Error
              ? error.message
              : "Webhook delivery diagnostics endpoint is unavailable.",
        },
        "1.0.0",
      );
    }
  }
}
