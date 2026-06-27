import type { ApiClient } from "./api-client.js";
import type { CredentialStore } from "./credentials.js";
import type { Profile } from "./config.js";

export interface DoctorCheck {
  name: string;
  status: "pass" | "fail";
  message: string;
  remediation?: string;
}

export interface DoctorReport {
  summary: {
    pass: number;
    fail: number;
  };
  checks: DoctorCheck[];
}

export async function runDoctorChecks(input: {
  api: ApiClient;
  credentials: CredentialStore;
  tokenRef?: string;
  profile?: Profile;
}): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];

  const token = input.tokenRef ? await input.credentials.get(input.tokenRef) : null;
  checks.push(
    token
      ? {
          name: "auth",
          status: "pass",
          message: "Credential token is available for active profile.",
        }
      : {
          name: "auth",
          status: "fail",
          message: "Credential token is missing for active profile.",
          remediation: "Run `monetizekit auth login`.",
        },
  );

  checks.push(await runApiReachabilityCheck(input.api, "/api/v1/openapi.json", "network"));
  checks.push(await runApiReachabilityCheck(input.api, "/api/v1/workspace/current", "workspace"));
  checks.push(await runApiReachabilityCheck(input.api, "/api/v1/plans", "catalog"));

  const hasSdk = Boolean(process.env.MONETIZEKIT_SDK_PRESENT?.trim());
  checks.push(
    hasSdk
      ? {
          name: "sdk",
          status: "pass",
          message: "SDK marker MONETIZEKIT_SDK_PRESENT is set.",
        }
      : {
          name: "sdk",
          status: "fail",
          message: "SDK marker MONETIZEKIT_SDK_PRESENT is not set.",
          remediation:
            "Set MONETIZEKIT_SDK_PRESENT=1 or run `monetizekit init sdk install` if this project needs SDK checks.",
        },
  );

  const summary = {
    pass: checks.filter((check) => check.status === "pass").length,
    fail: checks.filter((check) => check.status === "fail").length,
  };

  return { summary, checks };
}

async function runApiReachabilityCheck(
  api: ApiClient,
  path: string,
  name: string,
): Promise<DoctorCheck> {
  try {
    const response = await api.get(path);
    return {
      name,
      status: response.status >= 200 && response.status < 300 ? "pass" : "fail",
      message: `${path} responded with HTTP ${response.status}.`,
      remediation:
        response.status >= 200 && response.status < 300
          ? undefined
          : "Verify API token scope, API URL, and workspace selection.",
    };
  } catch (error) {
    return {
      name,
      status: "fail",
      message: error instanceof Error ? error.message : `Failed to reach ${path}.`,
      remediation: "Verify API URL/network connectivity and credentials.",
    };
  }
}
