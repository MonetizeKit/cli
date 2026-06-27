import { readFile } from "node:fs/promises";

import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { replayUsageEvents, type UsageReplayEvent } from "../../lib/usage-replay.js";

function parseNdjson(source: string): UsageReplayEvent[] {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((line) => JSON.parse(line) as UsageReplayEvent);
}

export default class UsageReplayCommand extends BaseCommand {
  static summary = "Replay usage events from NDJSON file";

  static flags = {
    ...BaseCommand.globalFlags,
    file: Flags.string({
      description: "Path to NDJSON replay file",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(UsageReplayCommand);
    const source = await readFile(flags.file, "utf8");
    const events = parseNdjson(source);

    const result = await replayUsageEvents(events, async (event) => {
      await this.api.post("/api/v1/usage/events", event, event.idempotencyKey);
    });

    const payload = {
      file: flags.file,
      successCount: result.successCount,
      failureCount: result.failureCount,
      failures: result.failures,
    };

    if (result.failureCount > 0 && result.successCount > 0) {
      this.output.result(payload, "1.0.0");
      this.exit(10);
      return;
    }

    if (result.failureCount > 0) {
      this.error("Usage replay failed.", { exit: 7 });
      return;
    }

    this.output.result(payload, "1.0.0");
  }
}
