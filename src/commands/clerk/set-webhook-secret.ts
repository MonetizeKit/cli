import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";

/**
 * Store the Svix webhook signing secret (whsec_…) for the workspace's Clerk
 * sync endpoint, once the endpoint has been created in the Clerk dashboard.
 * Idempotent.
 */
export default class ClerkSetWebhookSecretCommand extends BaseCommand {
  static summary = "Store the Clerk (Svix) webhook signing secret for this connection";

  static flags = {
    ...BaseCommand.globalFlags,
    secret: Flags.string({
      description: "Svix signing secret (whsec_…). Falls back to MONETIZEKIT_CLERK_WEBHOOK_SECRET.",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ClerkSetWebhookSecretCommand);
    const secret = (flags.secret ?? process.env.MONETIZEKIT_CLERK_WEBHOOK_SECRET ?? "").trim();
    if (!secret) {
      this.error("Provide a webhook secret via --secret or the MONETIZEKIT_CLERK_WEBHOOK_SECRET environment variable.");
    }

    const response = await this.api.post<Record<string, unknown>>("/api/v1/integrations/clerk", {
      action: "set_webhook_secret",
      secret,
    });
    this.output.result(response.data, "1.0.0");
  }
}
