import { BaseCommand } from "../../lib/base-command.js";
import { checkForCliUpdate } from "../../lib/update.js";

export default class UpdateCheckCommand extends BaseCommand {
  static summary = "Check for CLI updates";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const currentVersion = this.config.version;
    const result = await checkForCliUpdate(currentVersion);
    this.output.result(result, "1.0.0");
  }
}
