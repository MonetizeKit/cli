import { confirm } from "@inquirer/prompts";

export interface DestructiveGuardOptions {
  yes: boolean;
  dryRun: boolean;
  interactive?: boolean;
  promptMessage?: string;
  prompt?: (message: string) => Promise<boolean>;
  onDryRun?: () => void;
}

export interface DestructiveGuardResult {
  proceed: boolean;
  exitCode: number;
  reason: "dry_run" | "confirmed" | "missing_yes_flag" | "cancelled";
  message?: string;
}

export async function checkDestructiveGuard(
  options: DestructiveGuardOptions,
): Promise<DestructiveGuardResult> {
  const isInteractive =
    options.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const promptMessage =
    options.promptMessage ?? "This operation is destructive. Continue?";
  const prompt = options.prompt ?? ((message: string) => confirm({ message }));

  if (options.dryRun) {
    options.onDryRun?.();
    return {
      proceed: false,
      exitCode: 0,
      reason: "dry_run",
    };
  }

  if (options.yes) {
    return {
      proceed: true,
      exitCode: 0,
      reason: "confirmed",
    };
  }

  if (!isInteractive) {
    return {
      proceed: false,
      exitCode: 2,
      reason: "missing_yes_flag",
      message: "Destructive operation requires --yes in non-interactive mode.",
    };
  }

  const accepted = await prompt(promptMessage);
  if (accepted) {
    return {
      proceed: true,
      exitCode: 0,
      reason: "confirmed",
    };
  }

  return {
    proceed: false,
    exitCode: 2,
    reason: "cancelled",
    message: "Operation cancelled by user.",
  };
}
