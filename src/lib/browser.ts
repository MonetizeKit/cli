import { spawn } from "node:child_process";

function trim(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

const DEFAULT_APP_URL = "https://app.monetizekit.com";

/**
 * Resolve the MonetizeKit web app base URL used for browser sign-in.
 *
 * Precedence: explicit `--url` flag, then `MONETIZEKIT_API_URL`,
 * then `NEXT_PUBLIC_APP_URL`, then the public default.
 */
export function resolveWebAppUrl(
  flagUrl?: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const resolved =
    trim(flagUrl) ??
    trim(env.MONETIZEKIT_API_URL) ??
    trim(env.NEXT_PUBLIC_APP_URL) ??
    DEFAULT_APP_URL;

  return resolved.replace(/\/+$/, "");
}

/** Build the deep link to the workspace API keys management page. */
export function buildApiKeysUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/settings?tab=api-keys`;
}

/**
 * Best-effort open of a URL in the user's default browser. Never throws —
 * callers always print the URL so a headless environment can continue.
 */
export async function openBrowser(url: string): Promise<boolean> {
  const platform = process.platform;
  let command: string;
  let args: string[];

  switch (platform) {
    case "darwin":
      command = "open";
      args = [url];
      break;
    case "win32":
      command = "cmd";
      args = ["/c", "start", "", url];
      break;
    default:
      command = "xdg-open";
      args = [url];
      break;
  }

  return new Promise((resolve) => {
    try {
      const child = spawn(command, args, {
        stdio: "ignore",
        detached: true,
      });
      child.on("error", () => resolve(false));
      child.unref();
      resolve(true);
    } catch {
      resolve(false);
    }
  });
}
