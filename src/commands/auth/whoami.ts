import { BaseCommand } from "../../lib/base-command.js";
import { resolveProfileWithEnvOverrides } from "../../lib/config.js";
import { resolveProfileName, resolveTokenRef } from "../../lib/profile.js";

interface WorkspaceIdentity {
  id: string;
  name: string;
  slug: string;
}

export default class AuthWhoamiCommand extends BaseCommand {
  static summary = "Show the workspace identity for the stored API key";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AuthWhoamiCommand);
    const config = this.configManager.load();
    const profileName = resolveProfileName(config, flags.profile);
    const profile = config.profiles[profileName] ?? {};
    const tokenRef = resolveTokenRef(profileName, profile);

    const apiKey =
      process.env.MONETIZEKIT_TOKEN ?? (await this.credentials.get(tokenRef));

    if (!apiKey) {
      this.error("Not authenticated. Run `monetizekit auth login`.", { exit: 3 });
      return;
    }

    const { apiUrl } = resolveProfileWithEnvOverrides(profile);
    const endpoint = new URL("/api/v1/workspace/current", apiUrl);

    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${apiKey}` },
    }).catch(() => null);

    if (!response?.ok) {
      this.error(
        `Failed to resolve identity (HTTP ${response?.status ?? "network error"}). ` +
          "The stored API key may be invalid or revoked.",
        { exit: response?.status === 401 ? 3 : 1 },
      );
      return;
    }

    const workspace = (await response.json()) as WorkspaceIdentity;

    this.output.result(
      {
        profile: profileName,
        keyPrefix: apiKey.slice(0, 11),
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
        },
      },
      "1.0.0",
    );
  }
}
