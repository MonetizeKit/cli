import { BaseCommand } from "../../lib/base-command.js";
import { isTelemetryEnabled } from "../../lib/telemetry.js";

export default class TelemetryStatusCommand extends BaseCommand {
  static summary = "Show current CLI telemetry setting";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const config = this.configManager.load();
    this.output.result(
      {
        enabled: isTelemetryEnabled(config),
      },
      "1.0.0",
    );
  }
}
