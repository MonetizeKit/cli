import { BaseCommand } from "../../lib/base-command.js";

/**
 * Disconnect Stripe for the current workspace (soft — the connection is marked
 * disconnected and retained for audit). Recorded in the audit log (surface: cli).
 */
export default class StripeDisconnectCommand extends BaseCommand {
  static summary = "Disconnect Stripe for the current workspace";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const response = await this.api.post<Record<string, unknown>>("/api/v1/integrations/stripe", {
      action: "disconnect",
    });
    this.output.result(response.data, "1.0.0");
  }
}
