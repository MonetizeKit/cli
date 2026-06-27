import { BaseCommand } from "../../../lib/base-command.js";

export default class WorkspaceEnvListCommand extends BaseCommand {
  static summary = "List environments available in active workspace scope";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const response = await this.api.get<
      Array<{
        id: string;
        key: string;
        label: string;
        color: string;
      }>
    >("/api/v1/workspace/environments");

    this.output.result(response.data, "1.0.0");
  }
}
