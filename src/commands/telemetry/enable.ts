import { BaseCommand } from "../../lib/base-command.js";
import { setTelemetryEnabled } from "../../lib/telemetry.js";

export default class TelemetryEnableCommand extends BaseCommand {
  static summary = "Enable CLI telemetry collection";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const config = this.configManager.load();
    const updated = setTelemetryEnabled(config, true);
    this.configManager.save(updated);

    this.output.result(
      {
        enabled: true,
      },
      "1.0.0",
    );
  }
}
