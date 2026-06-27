import { Args } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { verifyStripeWebhookSignature } from "../../lib/stripe-webhook.js";

export default class StripeVerifyWebhookCommand extends BaseCommand {
  static summary = "Verify Stripe webhook payload signature";

  static args = {
    payload: Args.string({ description: "Raw webhook payload", required: true }),
    signature: Args.string({ description: "Stripe-Signature header", required: true }),
    secret: Args.string({ description: "Webhook signing secret", required: true }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const { args } = await this.parse(StripeVerifyWebhookCommand);
    const valid = verifyStripeWebhookSignature(args.payload, args.signature, args.secret);

    this.output.result({ valid }, "1.0.0");
    if (!valid) {
      this.exit(7);
    }
  }
}
