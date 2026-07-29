import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";

/**
 * Connect PostHog as the workspace's analytics destination. The key is
 * validated without emitting any events; idempotent — the server upserts the
 * (encrypted) key. Requires the `integrations:manage` scope (or the legacy
 * `settings:webhooks:manage`) on your API key. Run `posthog preview` first to
 * see exactly what will be sent.
 */
export default class PosthogConnectCommand extends BaseCommand {
  static summary = "Connect PostHog as the analytics destination (validates without emitting)";

  static flags = {
    ...BaseCommand.globalFlags,
    key: Flags.string({
      description: "PostHog project API key (phc_…). Falls back to MONETIZEKIT_POSTHOG_KEY.",
      required: false,
    }),
    host: Flags.string({
      description: "PostHog host, e.g. https://us.posthog.com. Falls back to MONETIZEKIT_POSTHOG_HOST.",
      required: false,
    }),
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
    "monthly-cap": Flags.integer({
      description: "Monthly event cap (events beyond the cap are queued, not sent).",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PosthogConnectCommand);
    const apiKey = (flags.key ?? process.env.MONETIZEKIT_POSTHOG_KEY ?? "").trim();
    if (!apiKey) {
      this.error("Provide a PostHog key via --key or the MONETIZEKIT_POSTHOG_KEY environment variable.");
    }
    const host = (flags.host ?? process.env.MONETIZEKIT_POSTHOG_HOST ?? "").trim();
    if (!host) {
      this.error("Provide the PostHog host via --host or the MONETIZEKIT_POSTHOG_HOST environment variable.");
    }

    const response = await this.api.post<Record<string, unknown>>("/api/v1/integrations/posthog", {
      action: "connect",
      apiKey,
      host,
      accountMapping: flags["account-mapping"],
      identifierMode: flags["identifier-mode"],
      monthlyCap: flags["monthly-cap"],
    });
    this.output.result(response.data, "1.0.0");
  }
}
