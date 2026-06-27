import { BaseCommand } from "../../lib/base-command.js";
import { resolveProfileName, resolveTokenRef } from "../../lib/profile.js";

export default class AuthLogoutCommand extends BaseCommand {
  static summary = "Log out and clear stored credentials";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AuthLogoutCommand);
    const config = this.configManager.load();
    const profileName = resolveProfileName(config, flags.profile);
    const profile = config.profiles[profileName] ?? {};
    const tokenRef = resolveTokenRef(profileName, profile);

    await this.credentials.delete(tokenRef);
    this.output.result({ loggedOut: true, profile: profileName }, "1.0.0");
  }
}
