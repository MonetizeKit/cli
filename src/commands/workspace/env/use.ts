import { Args } from "@oclif/core";

import { BaseCommand } from "../../../lib/base-command.js";
import { resolveProfileName } from "../../../lib/profile.js";

export default class WorkspaceEnvUseCommand extends BaseCommand {
  static summary = "Set active environment in selected profile";

  static args = {
    env: Args.string({
      description: "Environment key",
      required: true,
    }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(WorkspaceEnvUseCommand);
    const config = this.configManager.load();
    const profileName = resolveProfileName(config, flags.profile);
    const profile = config.profiles[profileName] ?? {};

    this.configManager.setProfile(profileName, {
      ...profile,
      environment: args.env,
    });

    this.output.result({ environment: args.env, profile: profileName }, "1.0.0");
  }
}
