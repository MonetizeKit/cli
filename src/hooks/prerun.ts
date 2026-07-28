import type { Hook } from "@oclif/core";

const WORKSPACE_FLAG_PATTERN = /^--workspace(=|$)/;

export function hasWorkspaceArgument(argv: string[]): boolean {
  return argv.some((arg) => WORKSPACE_FLAG_PATTERN.test(arg));
}

/**
 * Requirement 1.4/1.6 (TTY_Fallback): Agent_Mode generalizes this existing
 * "refuse to prompt when not a TTY" pattern, so `--mode agent` must also
 * trip this check even if `process.stdin`/`stdout` happen to report a TTY.
 */
export function hasAgentModeArgument(argv: string[]): boolean {
  return argv.some((arg, index) => arg === "--mode=agent" || (arg === "--mode" && argv[index + 1] === "agent"));
}

const hook: Hook.Prerun = async function prerunHook() {
  const workspaceFromArgs = hasWorkspaceArgument(process.argv);
  const workspaceFromEnv = Boolean(process.env.MONETIZEKIT_WORKSPACE);
  const agentMode = hasAgentModeArgument(process.argv);
  const isInteractive = !agentMode && Boolean(process.stdin.isTTY && process.stdout.isTTY);

  if (!workspaceFromArgs && !workspaceFromEnv && !isInteractive) {
    const error = new Error(
      "Workspace is required in non-interactive mode. Use --workspace or MONETIZEKIT_WORKSPACE.",
    );
    error.name = "InvalidArgumentsError";
    throw error;
  }
};

export default hook;
