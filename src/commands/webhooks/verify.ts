import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { verifyWebhookSignature } from "../../lib/webhook.js";

export default class WebhooksVerifyCommand extends BaseCommand {
  static summary = "Verify webhook payload signature";

  static args = {
    payload: Args.string({ description: "Raw payload string", required: true }),
    signature: Args.string({ description: "Provided signature", required: true }),
    secret: Args.string({ description: "Signing secret", required: true }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const { args } = await this.parse(WebhooksVerifyCommand);
    const valid = verifyWebhookSignature(args.payload, args.signature, args.secret);
    this.output.result({ valid }, "1.0.0");

    if (!valid) {
      this.exit(7);
    }
  }
}
