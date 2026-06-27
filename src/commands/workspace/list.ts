import { BaseCommand } from "../../lib/base-command.js";

export default class WorkspaceListCommand extends BaseCommand {
  static summary = "List workspaces available to the current token scope";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const response = await this.api.get<
      Array<{
        id: string;
        name: string;
        slug: string;
      }>
    >("/api/v1/workspaces");

    this.output.result(response.data, "1.0.0");
  }
}
