import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { migrateLaunchDarklySource } from "../../lib/migrate.js";

export default class MigrateLaunchdarklyCommand extends BaseCommand {
  static summary = "Transform LaunchDarkly exports into MonetizeKit catalog-shaped output";

  static flags = {
    ...BaseCommand.globalFlags,
    source: Flags.string({
      description: "Path to LaunchDarkly export (JSON/YAML)",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MigrateLaunchdarklyCommand);
    const result = await migrateLaunchDarklySource(flags.source);
    this.output.result(result, "1.0.0");
  }
}
