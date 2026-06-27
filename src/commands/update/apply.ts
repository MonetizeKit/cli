import { BaseCommand } from "../../lib/base-command.js";
import { checkForCliUpdate, getManualUpdateInstructions } from "../../lib/update.js";

export default class UpdateApplyCommand extends BaseCommand {
  static summary = "Apply CLI update if available";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const currentVersion = this.config.version;
    const check = await checkForCliUpdate(currentVersion);

    if (!check.latestVersion) {
      this.output.result(
        {
          updated: false,
          reason: "update_source_unavailable",
          instructions: getManualUpdateInstructions(),
        },
        "1.0.0",
      );
      return;
    }

    if (!check.updateAvailable) {
      this.output.result(
        {
          updated: false,
          reason: "already_up_to_date",
          version: currentVersion,
        },
        "1.0.0",
      );
      return;
    }

    this.output.result(
      {
        updated: false,
        reason: "manual_apply_required",
        currentVersion,
        latestVersion: check.latestVersion,
        instructions: getManualUpdateInstructions(),
      },
      "1.0.0",
    );
  }
}
