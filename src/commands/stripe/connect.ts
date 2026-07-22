import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";

/**
 * Connect Stripe by providing a restricted (or secret) key. Idempotent — the
 * server upserts the (encrypted) credential, so re-running re-seals it. Enforces
 * the `settings:webhooks:manage` scope on your API key, and the connection is
 * recorded in the audit log (surface: cli) exactly like the UI.
 */
export default class StripeConnectCommand extends BaseCommand {
  static summary = "Connect Stripe with a restricted key (idempotent)";

  static flags = {
    ...BaseCommand.globalFlags,
    key: Flags.string({
      description: "Stripe restricted (rk_…) or secret (sk_…) key. Falls back to MONETIZEKIT_STRIPE_KEY.",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(StripeConnectCommand);
    const key = (flags.key ?? process.env.MONETIZEKIT_STRIPE_KEY ?? "").trim();
    if (!key) {
      this.error("Provide a Stripe key via --key or the MONETIZEKIT_STRIPE_KEY environment variable.");
    }

    const response = await this.api.post<Record<string, unknown>>("/api/v1/integrations/stripe", {
      action: "connect",
      apiKey: key,
    });
    this.output.result(response.data, "1.0.0");
  }
}
