import { Args } from "@oclif/core";

import { BaseCommand } from "../../../lib/base-command.js";

export default class AuthServiceTokenRevokeCommand extends BaseCommand {
  static summary = "Revoke a service token";

  static args = {
    id: Args.string({
      description: "Service token ID",
      required: true,
    }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const { args } = await this.parse(AuthServiceTokenRevokeCommand);
    await this.api.delete(`/api/v1/service-tokens/${args.id}`);
    this.output.result({ revoked: true, id: args.id }, "1.0.0");
  }
}
