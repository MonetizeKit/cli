import { BaseCommand } from "../../lib/base-command.js";
import { setTelemetryEnabled } from "../../lib/telemetry.js";

export default class TelemetryDisableCommand extends BaseCommand {
  static summary = "Disable CLI telemetry collection";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const config = this.configManager.load();
    const updated = setTelemetryEnabled(config, false);
    this.configManager.save(updated);

    this.output.result(
      {
        enabled: false,
      },
      "1.0.0",
    );
  }
}
