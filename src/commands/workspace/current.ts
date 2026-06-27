import { BaseCommand } from "../../lib/base-command.js";

export default class WorkspaceCurrentCommand extends BaseCommand {
  static summary = "Show currently active workspace context";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const response = await this.api.get<{
      id: string;
      name: string;
      slug: string;
    }>("/api/v1/workspace/current");

    this.output.result(response.data, "1.0.0");
  }
}
