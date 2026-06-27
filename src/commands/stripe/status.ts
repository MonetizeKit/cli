import { BaseCommand } from "../../lib/base-command.js";

export default class StripeStatusCommand extends BaseCommand {
  static summary = "Show Stripe integration readiness status";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const hasSecretKey = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
    const hasWebhookSecret = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
    const accountId = process.env.STRIPE_ACCOUNT_ID?.trim() ?? null;

    this.output.result(
      {
        connected: hasSecretKey,
        accountId,
        webhook: {
          configured: hasWebhookSecret,
          endpointStatus: hasWebhookSecret ? "configured" : "missing_secret",
        },
        lastEventAt: null,
      },
      "1.0.0",
    );
  }
}
