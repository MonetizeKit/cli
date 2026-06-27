import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { migrateCustomSource } from "../../lib/migrate.js";

export default class MigrateCustomCommand extends BaseCommand {
  static summary = "Transform custom source data into MonetizeKit catalog-shaped output";

  static flags = {
    ...BaseCommand.globalFlags,
    source: Flags.string({
      description: "Path to source data file (JSON/YAML)",
      required: true,
    }),
    mapping: Flags.string({
      description: "Path to mapping definition file (JSON/YAML)",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MigrateCustomCommand);
    const result = await migrateCustomSource(flags.source, flags.mapping);
    this.output.result(result, "1.0.0");
  }
}
