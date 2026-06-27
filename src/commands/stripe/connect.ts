import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";

export default class StripeConnectCommand extends BaseCommand {
  static summary = "Display Stripe connection URL and onboarding guidance";

  static flags = {
    ...BaseCommand.globalFlags,
    url: Flags.string({
      description: "Override connect URL",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(StripeConnectCommand);
    const connectUrl =
      flags.url ??
      process.env.MONETIZEKIT_STRIPE_CONNECT_URL ??
      "https://dashboard.stripe.com/connect";

    this.output.result(
      {
        connectUrl,
        nextStep: "Complete Stripe account connection in browser, then run `monetizekit stripe status`.",
      },
      "1.0.0",
    );
  }
}
