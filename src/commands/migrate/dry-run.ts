import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { migrateDryRunSource } from "../../lib/migrate.js";

export default class MigrateDryRunCommand extends BaseCommand {
  static summary = "Preview migration output without creating resources";

  static flags = {
    ...BaseCommand.globalFlags,
    source: Flags.string({
      description: "Path to migration source file (JSON/YAML)",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MigrateDryRunCommand);
    const result = await migrateDryRunSource(flags.source);
    this.output.result(result, "1.0.0");
  }
}
