import { describe, expect, it } from "vitest";

import ClerkStatusCommand from "../../src/commands/clerk/status.js";
import ClerkInspectCommand from "../../src/commands/clerk/inspect.js";
import ClerkConnectCommand from "../../src/commands/clerk/connect.js";
import ClerkSetWebhookSecretCommand from "../../src/commands/clerk/set-webhook-secret.js";
import ClerkImportCommand from "../../src/commands/clerk/import.js";
import ClerkDisconnectCommand from "../../src/commands/clerk/disconnect.js";
import PosthogStatusCommand from "../../src/commands/posthog/status.js";
import PosthogPreviewCommand from "../../src/commands/posthog/preview.js";
import PosthogConnectCommand from "../../src/commands/posthog/connect.js";
import PosthogDrainCommand from "../../src/commands/posthog/drain.js";
import PosthogDisconnectCommand from "../../src/commands/posthog/disconnect.js";
import IntegrationsListCommand from "../../src/commands/integrations/list.js";
import { BaseCommand } from "../../src/lib/base-command.js";

/**
 * Tri-surface integration parity (FRD-PO-006): the clerk / posthog /
 * integrations command groups must exist, extend BaseCommand (auth, output,
 * global flags), and declare the inputs the REST contract requires.
 */
const ALL_COMMANDS = [
  ClerkStatusCommand,
  ClerkInspectCommand,
  ClerkConnectCommand,
  ClerkSetWebhookSecretCommand,
  ClerkImportCommand,
  ClerkDisconnectCommand,
  PosthogStatusCommand,
  PosthogPreviewCommand,
  PosthogConnectCommand,
  PosthogDrainCommand,
  PosthogDisconnectCommand,
  IntegrationsListCommand,
] as const;

describe("integration command groups", () => {
  it("every command extends BaseCommand and has a summary + global flags", () => {
    for (const command of ALL_COMMANDS) {
      expect(Object.prototype.isPrototypeOf.call(BaseCommand, command)).toBe(true);
      expect(typeof command.summary).toBe("string");
      expect(command.summary.length).toBeGreaterThan(0);
      // Global flags (json/output/profile/…) must be spread into every command.
      expect(command.flags).toHaveProperty("json");
      expect(command.flags).toHaveProperty("profile");
    }
  });

  it("clerk connect requires an explicit account model with the contract's enum", () => {
    const flag = ClerkConnectCommand.flags["account-model"] as {
      required?: boolean;
      options?: string[];
    };
    expect(flag.required).toBe(true);
    expect(flag.options).toEqual(["user", "organization", "both"]);
    const behavior = ClerkConnectCommand.flags["unsynced-behavior"] as { options?: string[] };
    expect(behavior.options).toEqual(["create_with_default_plan", "deny_until_synced"]);
  });

  it("posthog connect + preview declare the contract's mapping and identifier enums", () => {
    for (const command of [PosthogConnectCommand, PosthogPreviewCommand]) {
      const mapping = command.flags["account-mapping"] as { options?: string[] };
      expect(mapping.options).toEqual(["group", "person"]);
      const identifier = command.flags["identifier-mode"] as { options?: string[] };
      expect(identifier.options).toEqual(["full", "hashed", "omitted"]);
    }
  });

  it("secret-bearing flags fall back to documented environment variables", () => {
    const cases: Array<{ flags: Record<string, { description?: string }>; flag: string; env: string }> = [
      { flags: ClerkInspectCommand.flags, flag: "secret-key", env: "MONETIZEKIT_CLERK_SECRET_KEY" },
      { flags: ClerkConnectCommand.flags, flag: "secret-key", env: "MONETIZEKIT_CLERK_SECRET_KEY" },
      { flags: ClerkSetWebhookSecretCommand.flags, flag: "secret", env: "MONETIZEKIT_CLERK_WEBHOOK_SECRET" },
      { flags: PosthogConnectCommand.flags, flag: "key", env: "MONETIZEKIT_POSTHOG_KEY" },
      { flags: PosthogConnectCommand.flags, flag: "host", env: "MONETIZEKIT_POSTHOG_HOST" },
    ];
    for (const { flags, flag, env } of cases) {
      expect(flags[flag]?.description).toContain(env);
    }
  });
});
