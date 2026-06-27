import { BaseCommand } from "../../lib/base-command.js";

export default class CompletionZshCommand extends BaseCommand {
  static summary = "Generate zsh completion instructions";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    this.output.result(
      {
        shell: "zsh",
        command: "monetizekit autocomplete zsh",
      },
      "1.0.0",
    );
  }
}
