import { Args } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { resolveProfileName } from "../../lib/profile.js";

export default class WorkspaceUseCommand extends BaseCommand {
  static summary = "Set active workspace context in the selected profile";

  static args = {
    workspace: Args.string({
      description: "Workspace ID or slug",
      required: true,
    }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(WorkspaceUseCommand);
    const listResponse = await this.api.get<Array<{ id: string; slug: string }>>("/api/v1/workspaces");
    const target = listResponse.data.find(
      (workspace) => workspace.id === args.workspace || workspace.slug === args.workspace,
    );

    if (!target) {
      this.error("Requested workspace is outside your authenticated scope.", { exit: 4 });
      return;
    }

    const config = this.configManager.load();
    const profileName = resolveProfileName(config, flags.profile);
    const profile = config.profiles[profileName] ?? {};
    this.configManager.setProfile(profileName, {
      ...profile,
      workspaceId: target.id,
    });

    this.output.result({ workspaceId: target.id, profile: profileName }, "1.0.0");
  }
}
