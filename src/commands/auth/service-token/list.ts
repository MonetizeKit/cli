import { BaseCommand } from "../../../lib/base-command.js";

export default class AuthServiceTokenListCommand extends BaseCommand {
  static summary = "List active service tokens";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const response = await this.api.get<
      Array<{
        id: string;
        name: string;
        scopes: string[];
        expiresAt: string | null;
        createdAt: string;
      }>
    >("/api/v1/service-tokens");

    this.output.result(response.data, "1.0.0");
  }
}
