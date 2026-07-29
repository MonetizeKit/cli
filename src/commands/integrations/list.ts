import { BaseCommand } from "../../lib/base-command.js";

/**
 * List the workspace's integration catalog cards with connection statuses
 * (read-only; requires the `integrations:view` scope).
 */
export default class IntegrationsListCommand extends BaseCommand {
  static summary = "List the workspace's integrations and their statuses";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const response = await this.api.get<Record<string, unknown>>("/api/v1/integrations");
    this.output.result(response.data, "1.0.0");
  }
}
