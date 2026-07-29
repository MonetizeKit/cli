import { BaseCommand } from "../../lib/base-command.js";

/**
 * Show the workspace's Clerk identity-source connection status, webhook
 * endpoint URL, and subscribed event types (read-only).
 */
export default class ClerkStatusCommand extends BaseCommand {
  static summary = "Show the workspace's Clerk connection status";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const response = await this.api.get<Record<string, unknown>>("/api/v1/integrations/clerk");
    this.output.result(response.data, "1.0.0");
  }
}
