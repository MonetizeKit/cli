import { BaseCommand } from "../../lib/base-command.js";
import { buildTelemetrySample } from "../../lib/telemetry.js";

export default class TelemetryShowSampleCommand extends BaseCommand {
  static summary = "Show an example telemetry payload";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    this.output.result(buildTelemetrySample(), "1.0.0");
  }
}
