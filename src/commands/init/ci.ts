import { BaseCommand } from "../../lib/base-command.js";
import { scaffoldCiTemplates } from "../../lib/init.js";

export default class InitCiCommand extends BaseCommand {
  static summary = "Generate MonetizeKit CI pipeline templates";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const files = await scaffoldCiTemplates(process.cwd());
    this.output.result(
      {
        files,
      },
      "1.0.0",
    );
  }
}
