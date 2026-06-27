import { password } from "@inquirer/prompts";
import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { buildApiKeysUrl, openBrowser, resolveWebAppUrl } from "../../lib/browser.js";
import { resolveProfileName, resolveTokenRef } from "../../lib/profile.js";

const API_KEY_PREFIX = "mk_";

export default class AuthLoginCommand extends BaseCommand {
  static summary = "Sign in via the browser and store a MonetizeKit API key";

  static description =
    "Opens the MonetizeKit web app so you can sign in and create a scoped " +
    "`mk_*` API key, then stores the key in the CLI credential store.";

  static flags = {
    ...BaseCommand.globalFlags,
    url: Flags.string({
      description: "MonetizeKit web app base URL to open for sign-in",
    }),
    key: Flags.string({
      description: "Provide the mk_* API key non-interactively (skips the prompt)",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AuthLoginCommand);

    const baseUrl = resolveWebAppUrl(flags.url);
    const apiKeysUrl = buildApiKeysUrl(baseUrl);

    this.output.info(
      `Opening ${apiKeysUrl} in your browser.\n` +
        "Sign in, open the API Keys tab, create a key, then copy it here.",
    );
    await openBrowser(apiKeysUrl);

    const apiKey = (flags.key ?? (await this.promptForKey())).trim();

    if (!apiKey.startsWith(API_KEY_PREFIX)) {
      this.error(`Expected a MonetizeKit API key starting with "${API_KEY_PREFIX}".`, {
        exit: 2,
      });
      return;
    }

    const config = this.configManager.load();
    const profileName = resolveProfileName(config, flags.profile);
    const currentProfile = config.profiles[profileName] ?? {};
    const tokenRef = resolveTokenRef(profileName, currentProfile);

    await this.credentials.set(tokenRef, apiKey);
    this.configManager.setProfile(profileName, {
      ...currentProfile,
      tokenRef,
    });

    this.output.result(
      {
        authenticated: true,
        profile: profileName,
        keyPrefix: apiKey.slice(0, 11),
      },
      "1.0.0",
    );
  }

  private async promptForKey(): Promise<string> {
    return password({
      message: "Paste your MonetizeKit API key (mk_...):",
      mask: true,
    });
  }
}
