import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { applyConfigPatch } from "../../lib/config-patch.js";
import { CliConfigSchema } from "../../lib/config.js";
import { ExitCode } from "../../lib/exit-codes.js";
import { readInputJsonValue } from "../../lib/input-json.js";

export default class ConfigPatchCommand extends BaseCommand {
  static summary = "Apply a JSON Merge Patch (RFC 7396) to the CLI config file";

  static description =
    "Applies --input-json as a JSON Merge Patch (RFC 7396) against the current config file, " +
    "validates the merged result against the config's JSON Schema (see `config schema`), and " +
    "writes it back atomically (temp file + rename), so a crash or concurrent write can never " +
    "corrupt the config file. Set a field to `null` in the patch to remove it, per the merge " +
    "patch spec. This command has no interactive fallback: --input-json is always required, in " +
    "both --mode human and --mode agent.";

  static examples = [
    String.raw`<%= config.bin %> config patch --input-json '{"telemetry":{"enabled":false}}'`,
    String.raw`echo '{"activeProfile":"staging"}' | <%= config.bin %> config patch --input-json -`,
    String.raw`<%= config.bin %> config patch --input-json '{"profiles":{"default":{"workspaceId":"ws_123"}}}' --dry-run`,
  ];

  static inputSchema = CliConfigSchema.partial();

  static flags = {
    ...BaseCommand.globalFlags,
    "dry-run": Flags.boolean({
      description: "Print the patched config without writing it",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ConfigPatchCommand);

    if (!flags["input-json"]) {
      this.failStructured(
        ExitCode.InvalidArguments,
        "config patch requires --input-json.",
        "Pass --input-json '<merge-patch document>' or --input-json - to read it from stdin.",
      );
    }

    const raw = await readInputJsonValue(flags["input-json"]);
    let patch: unknown;
    try {
      patch = JSON.parse(raw);
    } catch (error) {
      this.failStructured(
        ExitCode.ValidationFailed,
        `--input-json did not contain valid JSON: ${(error as Error).message}`,
      );
    }

    const current = this.configManager.load();
    const result = applyConfigPatch(current, patch);
    if (!result.ok) {
      this.failStructured(
        ExitCode.ValidationFailed,
        "Patched config failed schema validation. The existing config file was left unmodified.",
        "Run `monetizekit config schema` to inspect the expected shape, then retry.",
        result.fieldErrors,
      );
    }

    if (flags["dry-run"]) {
      this.output.result(result.config, "1.0.0");
      return;
    }

    this.configManager.writeAtomic(result.config);
    this.output.result(result.config, "1.0.0");
  }
}
