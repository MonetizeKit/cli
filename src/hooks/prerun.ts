import type { Hook } from "@oclif/core";

const WORKSPACE_FLAG_PATTERN = /^--workspace(=|$)/;

function hasWorkspaceArgument(argv: string[]): boolean {
  return argv.some((arg) => WORKSPACE_FLAG_PATTERN.test(arg));
}

const hook: Hook.Prerun = async function prerunHook() {
  const workspaceFromArgs = hasWorkspaceArgument(process.argv);
  const workspaceFromEnv = Boolean(process.env.MONETIZEKIT_WORKSPACE);
  const isInteractive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

  if (!workspaceFromArgs && !workspaceFromEnv && !isInteractive) {
    const error = new Error(
      "Workspace is required in non-interactive mode. Use --workspace or MONETIZEKIT_WORKSPACE.",
    );
    error.name = "InvalidArgumentsError";
    throw error;
  }
};

export default hook;
