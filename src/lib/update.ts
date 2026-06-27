import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  source: "npm" | "fallback";
}

export async function checkForCliUpdate(currentVersion: string): Promise<UpdateCheckResult> {
  try {
    const { stdout } = await execFileAsync("npm", ["view", "@monetizekit/cli", "version"], {
      timeout: 15_000,
    });
    const latestVersion = stdout.trim();
    return {
      currentVersion,
      latestVersion,
      updateAvailable: latestVersion.length > 0 && latestVersion !== currentVersion,
      source: "npm",
    };
  } catch {
    return {
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      source: "fallback",
    };
  }
}

export function getManualUpdateInstructions(): string[] {
  return [
    "npm global install: npm install -g @monetizekit/cli",
    "Homebrew install: brew update && brew upgrade monetizekit",
  ];
}
