import { BaseCommand } from "../../lib/base-command.js";

export default class CompletionPowershellCommand extends BaseCommand {
  static summary = "Generate PowerShell completion instructions";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    this.output.result(
      {
        shell: "powershell",
        command: "monetizekit autocomplete powershell",
      },
      "1.0.0",
    );
  }
}
