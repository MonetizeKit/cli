import { Args } from "@oclif/core";

import { BaseCommand } from "../../../lib/base-command.js";
import { getWebhookFixture } from "../../../lib/webhook.js";

export default class WebhooksFixturesGetCommand extends BaseCommand {
  static summary = "Get a webhook fixture payload by type";

  static args = {
    type: Args.string({ description: "Fixture type", required: true }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const { args } = await this.parse(WebhooksFixturesGetCommand);
    const fixture = getWebhookFixture(args.type);
    if (!fixture) {
      this.error(`Unknown fixture type: ${args.type}`, { exit: 5 });
      return;
    }

    this.output.result(fixture.payload, "1.0.0");
  }
}
