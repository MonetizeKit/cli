import { BaseCommand } from "../../lib/base-command.js";
import { runCiSmokeChecks } from "../../lib/ci.js";

export default class CiSmokeCommand extends BaseCommand {
  static summary = "Run CI smoke checks for auth, workspace, and catalog reachability";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const result = await runCiSmokeChecks(this.api);
    this.output.result(result, "1.0.0");

    if (result.summary.fail > 0) {
      this.exit(1);
    }
  }
}
