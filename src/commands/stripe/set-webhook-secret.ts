import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";

/**
 * Store the Stripe webhook signing secret (whsec_…) for the workspace's
 * per-connection endpoint (restricted-key mode). Idempotent; recorded in the
 * audit log (surface: cli).
 */
export default class StripeSetWebhookSecretCommand extends BaseCommand {
  static summary = "Store the Stripe webhook signing secret for this connection";

  static flags = {
    ...BaseCommand.globalFlags,
    secret: Flags.string({
      description: "Stripe webhook signing secret (whsec_…). Falls back to MONETIZEKIT_STRIPE_WEBHOOK_SECRET.",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(StripeSetWebhookSecretCommand);
    const secret = (flags.secret ?? process.env.MONETIZEKIT_STRIPE_WEBHOOK_SECRET ?? "").trim();
    if (!secret) {
      this.error("Provide a webhook secret via --secret or the MONETIZEKIT_STRIPE_WEBHOOK_SECRET environment variable.");
    }

    const response = await this.api.post<Record<string, unknown>>("/api/v1/integrations/stripe", {
      action: "set_webhook_secret",
      secret,
    });
    this.output.result(response.data, "1.0.0");
  }
}
