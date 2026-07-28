import { zodToJsonSchema } from "zod-to-json-schema";

import { BaseCommand } from "../../lib/base-command.js";
import { CliConfigSchema } from "../../lib/config.js";

export default class ConfigSchemaCommand extends BaseCommand {
  static summary = "Print the CLI config file's JSON Schema";

  static description =
    "Prints the JSON Schema for the CLI's own config file (`activeProfile`, `profiles`, " +
    "`telemetry`), generated from the same Zod schema `ConfigManager` validates against, " +
    "so it can never describe a config shape the CLI does not actually accept. Useful for " +
    "an agent generating or validating a config file without reading source code. This is " +
    "a pure read with no destructive/interactive path, so it behaves identically under " +
    "`--mode agent`, `--mode human`, `--json`, and the default output format.";

  static examples = ["<%= config.bin %> config schema", "<%= config.bin %> config schema --mode agent"];

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    this.output.result(zodToJsonSchema(CliConfigSchema, "CliConfig"), "1.0.0");
  }
}
