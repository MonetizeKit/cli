import { Command, Flags } from "@oclif/core";

import { ApiClient } from "./api-client.js";
import { ConfigManager, resolveProfileWithEnvOverrides } from "./config.js";
import { createCredentialStore } from "./credentials.js";
import { mapErrorToExitCode, mapHttpStatusToExitCode } from "./exit-codes.js";
import { OutputManager } from "./output.js";
import { ProgressIndicator } from "./progress.js";

type ApiLikeError = Error & {
  status?: number;
  requiredPermission?: string;
};

export function formatRemediationMessage(status: number, requiredPermission?: string): string {
  if (status === 401) {
    return "Authentication required. Run `monetizekit auth login` or `monetizekit auth status`.";
  }

  if (status === 403) {
    const permissionSegment = requiredPermission
      ? `Required permission: ${requiredPermission}. `
      : "";
    return `${permissionSegment}Request access from your workspace administrator.`;
  }

  return "";
}

export abstract class BaseCommand extends Command {
  static globalFlags = {
    json: Flags.boolean({ description: "Output as JSON", default: false }),
    output: Flags.string({
      description: "Output format",
      options: ["json", "yaml", "table"],
    }),
    quiet: Flags.boolean({
      char: "q",
      description: "Suppress non-essential output",
      default: false,
    }),
    "no-color": Flags.boolean({ description: "Disable ANSI color output", default: false }),
    profile: Flags.string({ description: "Named config profile" }),
    workspace: Flags.string({ char: "w", description: "Workspace ID override" }),
    env: Flags.string({ description: "Environment override" }),
    "api-url": Flags.string({ description: "API base URL override" }),
    timeout: Flags.integer({ description: "Request timeout in seconds", default: 30 }),
    retries: Flags.integer({ description: "Max retry attempts", default: 3 }),
    trace: Flags.boolean({ description: "Include trace IDs in output", default: false }),
    debug: Flags.boolean({ description: "Enable debug logging", default: false }),
  };

  static flags = BaseCommand.globalFlags;

  protected api!: ApiClient;
  protected configManager!: ConfigManager;
  protected output!: OutputManager;
  protected progress!: ProgressIndicator;
  protected credentials = createCredentialStore();
  protected resolvedWorkspaceId = "";

  async init(): Promise<void> {
    const parsed = await this.parse(this.constructor as typeof BaseCommand);
    const flags = parsed.flags as Record<string, unknown>;

    this.configManager = new ConfigManager();

    const profileName = (flags.profile as string | undefined) ?? undefined;
    const profile = this.configManager.getProfile(profileName);
    const resolved = resolveProfileWithEnvOverrides({
      ...profile,
      workspaceId: (flags.workspace as string | undefined) ?? profile.workspaceId,
      environment: (flags.env as string | undefined) ?? profile.environment,
      apiUrl: (flags["api-url"] as string | undefined) ?? profile.apiUrl,
    });

    this.resolvedWorkspaceId = resolved.workspaceId;

    const token =
      resolved.token ||
      (profile.tokenRef ? ((await this.credentials.get(profile.tokenRef)) ?? "") : "");

    this.output = new OutputManager({
      json: Boolean(flags.json),
      quiet: Boolean(flags.quiet),
      noColor: Boolean(flags["no-color"]),
      output: (flags.output as "json" | "yaml" | "table" | undefined) ?? undefined,
    });

    this.progress = new ProgressIndicator({
      json: Boolean(flags.json),
      quiet: Boolean(flags.quiet),
    });

    this.api = new ApiClient({
      baseUrl: resolved.apiUrl,
      token,
      timeout: Number(flags.timeout),
      retries: Number(flags.retries),
      debug: Boolean(flags.debug),
      trace: Boolean(flags.trace),
      userAgent: "monetizekit-cli/dev",
    });
  }

  protected handleError(error: unknown): never {
    const typedError = error as ApiLikeError;
    const status = typedError.status;

    if (typeof status === "number") {
      const remediation = formatRemediationMessage(status, typedError.requiredPermission);
      const message = remediation ? `${typedError.message}\n${remediation}` : typedError.message;
      this.error(message, { exit: mapHttpStatusToExitCode(status) });
    }

    const fallback = typedError instanceof Error ? typedError : new Error("Unknown command failure");
    this.error(fallback.message, { exit: mapErrorToExitCode(fallback) });
  }
}
