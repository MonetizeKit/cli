import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";

/**
 * Connect the workspace's Clerk instance. Idempotent — the server upserts the
 * (encrypted) credentials. The account model must be passed explicitly
 * (`--account-model`); run `clerk inspect` first to see the server's proposal.
 * Requires the `integrations:manage` scope (or the legacy
 * `settings:webhooks:manage`) on your API key; recorded in the integration
 * audit trail exactly like the UI.
 */
export default class ClerkConnectCommand extends BaseCommand {
  static summary = "Connect Clerk as an identity source (explicit account model required)";

  static flags = {
    ...BaseCommand.globalFlags,
    "secret-key": Flags.string({
      description: "Clerk secret key (sk_…). Falls back to MONETIZEKIT_CLERK_SECRET_KEY.",
      required: false,
    }),
    "webhook-secret": Flags.string({
      description:
        "Svix webhook signing secret (whsec_…); settable later via clerk set-webhook-secret. Falls back to MONETIZEKIT_CLERK_WEBHOOK_SECRET.",
      required: false,
    }),
    "account-model": Flags.string({
      description: "How Clerk identities map to customers. Run `clerk inspect` for the proposed model.",
      options: ["user", "organization", "both"],
      required: true,
    }),
    "unsynced-behavior": Flags.string({
      description: "What happens for identities not yet synced (default: create_with_default_plan).",
      options: ["create_with_default_plan", "deny_until_synced"],
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ClerkConnectCommand);
    const secretKey = (flags["secret-key"] ?? process.env.MONETIZEKIT_CLERK_SECRET_KEY ?? "").trim();
    if (!secretKey) {
      this.error(
        "Provide a Clerk secret key via --secret-key or the MONETIZEKIT_CLERK_SECRET_KEY environment variable.",
      );
    }
    const webhookSigningSecret = (
      flags["webhook-secret"] ?? process.env.MONETIZEKIT_CLERK_WEBHOOK_SECRET ?? ""
    ).trim();

    const response = await this.api.post<Record<string, unknown>>("/api/v1/integrations/clerk", {
      action: "connect",
      secretKey,
      webhookSigningSecret: webhookSigningSecret || undefined,
      accountModel: flags["account-model"],
      unsyncedBehavior: flags["unsynced-behavior"],
    });
    this.output.result(response.data, "1.0.0");
  }
}
