import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";

/**
 * Validate a Clerk secret key and report the instance shape + proposed account
 * model — nothing is persisted. Run this before `clerk connect` to get the
 * account model the server would propose (the connect step requires an explicit
 * choice; nothing is applied silently).
 */
export default class ClerkInspectCommand extends BaseCommand {
  static summary = "Inspect a Clerk secret key (returns the proposed account model; persists nothing)";

  static flags = {
    ...BaseCommand.globalFlags,
    "secret-key": Flags.string({
      description: "Clerk secret key (sk_…). Falls back to MONETIZEKIT_CLERK_SECRET_KEY.",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ClerkInspectCommand);
    const secretKey = (flags["secret-key"] ?? process.env.MONETIZEKIT_CLERK_SECRET_KEY ?? "").trim();
    if (!secretKey) {
      this.error(
        "Provide a Clerk secret key via --secret-key or the MONETIZEKIT_CLERK_SECRET_KEY environment variable.",
      );
    }

    const response = await this.api.post<Record<string, unknown>>("/api/v1/integrations/clerk", {
      action: "inspect",
      secretKey,
    });
    this.output.result(response.data, "1.0.0");
  }
}
