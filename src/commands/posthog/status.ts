import { BaseCommand } from "../../lib/base-command.js";

/**
 * Show the workspace's PostHog analytics-destination status, including
 * pending/failed delivery queue counts (read-only).
 */
export default class PosthogStatusCommand extends BaseCommand {
  static summary = "Show the workspace's PostHog destination status";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const response = await this.api.get<Record<string, unknown>>("/api/v1/integrations/posthog");
    this.output.result(response.data, "1.0.0");
  }
}
