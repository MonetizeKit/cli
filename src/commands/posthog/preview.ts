import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";

/**
 * Preview what the PostHog destination would send — the projected event volume
 * from the workspace's own denial history and the exact event payload — before
 * anything is emitted. Nothing is sent and nothing is persisted.
 */
export default class PosthogPreviewCommand extends BaseCommand {
  static summary = "Preview the projected volume + exact event payload (nothing sent)";

  static flags = {
    ...BaseCommand.globalFlags,
    "account-mapping": Flags.string({
      description: "How customers map to PostHog (default: group).",
      options: ["group", "person"],
      required: false,
    }),
    "identifier-mode": Flags.string({
      description: "How customer identifiers are sent (default: full).",
      options: ["full", "hashed", "omitted"],
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PosthogPreviewCommand);
    const response = await this.api.post<Record<string, unknown>>("/api/v1/integrations/posthog", {
      action: "preview",
      accountMapping: flags["account-mapping"],
      identifierMode: flags["identifier-mode"],
    });
    this.output.result(response.data, "1.0.0");
  }
}
