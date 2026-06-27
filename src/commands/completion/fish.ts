import { BaseCommand } from "../../lib/base-command.js";

export default class CompletionFishCommand extends BaseCommand {
  static summary = "Generate fish completion instructions";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    this.output.result(
      {
        shell: "fish",
        command: "monetizekit autocomplete fish",
      },
      "1.0.0",
    );
  }
}
