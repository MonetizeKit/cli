import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../../../lib/base-command.js";

export default class AuthServiceTokenCreateCommand extends BaseCommand {
  static summary = "Create a scoped service token";

  static args = {
    name: Args.string({
      description: "Service token name",
      required: true,
    }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
    scopes: Flags.string({
      description: "Comma-separated scope list",
      required: true,
    }),
    ttl: Flags.string({
      description: "Token TTL (for example 30d, 12h)",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(AuthServiceTokenCreateCommand);
    const scopes = String(flags.scopes)
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean);

    const response = await this.api.post<{
      id: string;
      name: string;
      scopes: string[];
      expiresAt: string | null;
      token: string;
    }>("/api/v1/service-tokens", {
      name: args.name,
      scopes,
      ttl: flags.ttl,
    });

    this.output.warn(
      "Store this token now. It will not be shown again after creation.",
    );
    this.output.result(response.data, "1.0.0");
  }
}
