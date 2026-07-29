import { BaseCommand } from "../../lib/base-command.js";

/**
 * Manually drain pending analytics deliveries to PostHog (the hourly cron is
 * the durable fallback). Idempotent — already-delivered rows are skipped.
 */
export default class PosthogDrainCommand extends BaseCommand {
  static summary = "Drain pending analytics deliveries to PostHog";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const response = await this.api.post<Record<string, unknown>>("/api/v1/integrations/posthog", {
      action: "drain",
    });
    this.output.result(response.data, "1.0.0");
  }
}
