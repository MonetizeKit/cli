import { Command, Flags } from "@oclif/core";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { ApiClient } from "./api-client.js";
import { ConfigManager, resolveProfileWithEnvOverrides } from "./config.js";
import { createCredentialStore } from "./credentials.js";
import { ExitCode, mapErrorToExitCode, mapHttpStatusToExitCode } from "./exit-codes.js";
import { checkMutualExclusion, readInputJsonValue, validateAgainstSchema } from "./input-json.js";
import { OutputManager, type OutputFormat, type OutputOptions } from "./output.js";
import { ProgressIndicator } from "./progress.js";

type ApiLikeError = Error & {
  status?: number;
  requiredPermission?: string;
};

export interface StructuredCliError {
  code: string;
  message: string;
  remediation?: string;
  details?: Array<{ path: string; message: string }>;
}

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

export interface OutputFlagsInput {
  json?: boolean;
  output?: string;
  quiet?: boolean;
  noColor?: boolean;
}

/**
 * Requirement 1.2/1.3: Agent_Mode implies JSON output and disables
 * spinners/progress animations (the same suppression `ProgressIndicator`
 * already applies for `--quiet`/`--json`), unconditionally overriding any
 * requested non-JSON `--output` format.
 */
export function buildOutputOptions(flags: OutputFlagsInput, agentMode: boolean): OutputOptions {
  return {
    json: Boolean(flags.json) || agentMode,
    quiet: Boolean(flags.quiet),
    noColor: Boolean(flags.noColor),
    output: agentMode ? "json" : (flags.output as OutputFormat | undefined),
  };
}

/**
 * Requirement 1.2: `--mode agent` combined with a non-JSON `--output` is a
 * conflict, not a silent override.
 */
export function detectModeOutputConflict(agentMode: boolean, outputFlag: string | undefined): boolean {
  return agentMode && outputFlag !== undefined && outputFlag !== "json";
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
    mode: Flags.string({
      description:
        "Execution mode. 'agent' forces JSON output, disables spinners/prompts, and fails fast " +
        "(instead of prompting or hanging) on any input an agent must supply non-interactively.",
      options: ["human", "agent"],
      default: "human",
    }),
    "input-json": Flags.string({
      description:
        "Supply this command's entire input as one JSON document, instead of individual flags/args. " +
        "Pass '-' to read the document from stdin.",
    }),
    "input-json-schema": Flags.boolean({
      description:
        "Print this command's --input-json JSON Schema and exit without running the command.",
      default: false,
    }),
  };

  static flags = BaseCommand.globalFlags;

  /**
   * Requirement 2.5/2.6: the Zod schema commands in scope for `--input-json`
   * declare as their Command_Input_Schema, introspectable via
   * `<command> --input-json-schema`. Commands out of scope leave this unset.
   */
  static inputSchema?: z.ZodType<unknown>;

  protected api!: ApiClient;
  protected configManager!: ConfigManager;
  protected output!: OutputManager;
  protected progress!: ProgressIndicator;
  protected credentials = createCredentialStore();
  protected resolvedWorkspaceId = "";
  protected agentMode = false;

  async init(): Promise<void> {
    const parsed = await this.parse(this.constructor as typeof BaseCommand);
    const flags = parsed.flags as Record<string, unknown>;

    this.agentMode = flags.mode === "agent";

    this.output = new OutputManager(
      buildOutputOptions(
        {
          json: Boolean(flags.json),
          output: flags.output as string | undefined,
          quiet: Boolean(flags.quiet),
          noColor: Boolean(flags["no-color"]),
        },
        this.agentMode,
      ),
    );

    this.progress = new ProgressIndicator({
      json: this.output.jsonEnabled(),
      quiet: Boolean(flags.quiet),
    });

    if (detectModeOutputConflict(this.agentMode, flags.output as string | undefined)) {
      this.failStructured(
        ExitCode.InvalidArguments,
        `--mode agent requires JSON output but --output ${String(flags.output)} was also requested.`,
        "Remove --output, or pass --output json, when using --mode agent.",
      );
    }

    if (flags["input-json-schema"]) {
      this.printInputJsonSchemaAndExit();
    }

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
      this.failStructured(mapHttpStatusToExitCode(status), typedError.message, remediation || undefined);
    }

    const fallback = typedError instanceof Error ? typedError : new Error("Unknown command failure");
    this.failStructured(mapErrorToExitCode(fallback), fallback.message);
  }

  /**
   * Requirement 1.5: under Agent_Mode, every exit path this spec touches
   * emits a machine-actionable `{ code, message, remediation }` error object
   * instead of human prose. `--mode human` (default) keeps the pre-existing
   * `this.error()` behavior unchanged.
   */
  protected failStructured(
    exitCode: ExitCode,
    message: string,
    remediation?: string,
    details?: Array<{ path: string; message: string }>,
  ): never {
    if (this.agentMode) {
      const error: StructuredCliError = { code: ExitCode[exitCode], message };
      if (remediation) {
        error.remediation = remediation;
      }
      if (details && details.length > 0) {
        error.details = details;
      }

      this.output.result({ error }, "1.0.0");
      this.exit(exitCode);
    }

    this.error(remediation ? `${message}\n${remediation}` : message, { exit: exitCode });
  }

  /**
   * Requirement 2.1-2.5: resolves a command's logical input either from
   * `--input-json` (inline or `-` for stdin) or from the equivalent
   * flags/args, validating either path against the same Zod schema so
   * behavior — and Command_Input_Schema — cannot drift between the two.
   */
  protected async resolveInput<T>(
    schema: z.ZodType<T>,
    options: { inputJson: string | undefined; flagsCandidate: Record<string, unknown> | undefined },
  ): Promise<T> {
    const conflict = checkMutualExclusion(options.inputJson, options.flagsCandidate);
    if (conflict) {
      this.failStructured(conflict.exitCode, conflict.message, conflict.remediation);
    }

    let document: unknown;
    if (options.inputJson !== undefined) {
      const raw = await readInputJsonValue(options.inputJson);
      try {
        document = JSON.parse(raw);
      } catch (error) {
        this.failStructured(
          ExitCode.ValidationFailed,
          `--input-json did not contain valid JSON: ${(error as Error).message}`,
        );
      }
    } else {
      document = options.flagsCandidate ?? {};
    }

    const result = validateAgainstSchema(schema, document);
    if (!result.ok) {
      this.failStructured(result.exitCode, result.message, result.remediation, result.fieldErrors);
    }

    return result.data;
  }

  private printInputJsonSchemaAndExit(): never {
    const ctor = this.constructor as typeof BaseCommand;
    if (!ctor.inputSchema) {
      this.failStructured(
        ExitCode.InvalidArguments,
        `${this.id ?? "this command"} does not define a --input-json schema.`,
        "Remove --input-json-schema; this command has no structured input to introspect.",
      );
    }

    this.output.result(zodToJsonSchema(ctor.inputSchema, this.id ?? "Input"), "1.0.0");
    this.exit(ExitCode.Success);
  }
}
