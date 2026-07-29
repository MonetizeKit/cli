import { BaseCommand } from "../../lib/base-command.js";

/**
 * Run (or resume) the initial Clerk directory import. Paginated, resumable,
 * and idempotent on the server — safe to re-run; progress is reported on the
 * connection (see `clerk status`).
 */
export default class ClerkImportCommand extends BaseCommand {
  static summary = "Run or resume the Clerk directory import (idempotent)";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const response = await this.api.post<Record<string, unknown>>("/api/v1/integrations/clerk", {
      action: "import_directory",
    });
    this.output.result(response.data, "1.0.0");
  }
}
