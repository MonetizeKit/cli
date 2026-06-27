import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { computeWebhookSignature, getWebhookFixture } from "../../lib/webhook.js";

export default class WebhooksTestCommand extends BaseCommand {
  static summary = "Send a signed webhook fixture to endpoint";

  static args = {
    endpoint: Args.string({ description: "Webhook endpoint URL", required: true }),
    event: Args.string({ description: "Fixture event type", required: true }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
    secret: Flags.string({
      description: "Signing secret (defaults to MONETIZEKIT_WEBHOOK_SECRET)",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(WebhooksTestCommand);
    const fixture = getWebhookFixture(args.event);
    if (!fixture) {
      this.error(`Unknown fixture event: ${args.event}`, { exit: 5 });
      return;
    }

    const secret = flags.secret ?? process.env.MONETIZEKIT_WEBHOOK_SECRET;
    if (!secret) {
      this.error("Missing signing secret. Provide --secret or MONETIZEKIT_WEBHOOK_SECRET.", {
        exit: 2,
      });
      return;
    }

    const payload = JSON.stringify(fixture.payload);
    const signature = computeWebhookSignature(payload, secret);
    const response = await fetch(args.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MonetizeKit-Signature": signature,
      },
      body: payload,
    });

    this.output.result(
      {
        delivered: response.ok,
        status: response.status,
        event: args.event,
      },
      "1.0.0",
    );
  }
}
