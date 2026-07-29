import { BaseCommand } from "../../lib/base-command.js";

/**
 * Disconnect Clerk for the current workspace (soft — the connection is marked
 * disconnected and retained for audit; synced customers are untouched).
 */
export default class ClerkDisconnectCommand extends BaseCommand {
  static summary = "Disconnect Clerk for the current workspace (customers untouched)";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const response = await this.api.post<Record<string, unknown>>("/api/v1/integrations/clerk", {
      action: "disconnect",
    });
    this.output.result(response.data, "1.0.0");
  }
}
