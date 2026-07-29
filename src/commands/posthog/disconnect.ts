import { BaseCommand } from "../../lib/base-command.js";

/**
 * Disconnect the PostHog destination (soft — queued delivery rows stay for
 * audit; nothing further is sent).
 */
export default class PosthogDisconnectCommand extends BaseCommand {
  static summary = "Disconnect the PostHog destination (nothing further sent)";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const response = await this.api.post<Record<string, unknown>>("/api/v1/integrations/posthog", {
      action: "disconnect",
    });
    this.output.result(response.data, "1.0.0");
  }
}
