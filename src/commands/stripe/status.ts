import { BaseCommand } from "../../lib/base-command.js";

/**
 * Show the workspace's Stripe connection + webhook status (read-only).
 */
export default class StripeStatusCommand extends BaseCommand {
  static summary = "Show the workspace's Stripe connection + webhook status";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const response = await this.api.get<Record<string, unknown>>("/api/v1/integrations/stripe");
    this.output.result(response.data, "1.0.0");
  }
}
