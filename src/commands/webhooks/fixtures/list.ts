import { BaseCommand } from "../../../lib/base-command.js";
import { WEBHOOK_FIXTURES } from "../../../lib/webhook.js";

export default class WebhooksFixturesListCommand extends BaseCommand {
  static summary = "List available webhook fixture types";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    this.output.result(
      WEBHOOK_FIXTURES.map((fixture) => fixture.type),
      "1.0.0",
    );
  }
}
