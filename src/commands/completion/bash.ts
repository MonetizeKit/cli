import { BaseCommand } from "../../lib/base-command.js";

export default class CompletionBashCommand extends BaseCommand {
  static summary = "Generate bash completion instructions";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    this.output.result(
      {
        shell: "bash",
        command: "monetizekit autocomplete bash",
      },
      "1.0.0",
    );
  }
}
