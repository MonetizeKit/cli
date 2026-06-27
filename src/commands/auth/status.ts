import { BaseCommand } from "../../lib/base-command.js";
import { resolveProfileName, resolveTokenRef } from "../../lib/profile.js";

export default class AuthStatusCommand extends BaseCommand {
  static summary = "Show authentication status";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AuthStatusCommand);
    const config = this.configManager.load();
    const profileName = resolveProfileName(config, flags.profile);
    const profile = config.profiles[profileName] ?? {};
    const tokenRef = resolveTokenRef(profileName, profile);
    const token = await this.credentials.get(tokenRef);

    this.output.result(
      {
        authenticated: Boolean(token),
        profile: profileName,
        workspaceId: profile.workspaceId ?? null,
        environment: profile.environment ?? null,
      },
      "1.0.0",
    );
  }
}
