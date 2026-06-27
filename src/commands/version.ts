import { BaseCommand } from "../lib/base-command.js";

export default class VersionCommand extends BaseCommand {
  static summary = "Show CLI version information";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const payload = {
      version: this.config.version,
      commit: process.env.MONETIZEKIT_BUILD_COMMIT ?? "unknown",
      buildDate: process.env.MONETIZEKIT_BUILD_DATE ?? "unknown",
      platform: process.platform,
      schemaVersion: "1.0.0",
    };

    this.output.result(payload, "1.0.0");
  }
}
