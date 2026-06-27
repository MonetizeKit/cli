import type { ApiClient } from "./api-client.js";
import { computeWebhookSignature, verifyWebhookSignature } from "./webhook.js";

export type CiCheckStatus = "pass" | "fail" | "skipped";

export interface CiCheckResult {
  name: string;
  status: CiCheckStatus;
  message: string;
  durationMs: number;
  details?: Record<string, unknown>;
}

export interface CiRunSummary {
  total: number;
  pass: number;
  fail: number;
  skipped: number;
}

export interface CiRunResult {
  kind: "smoke" | "contract-test";
  generatedAt: string;
  summary: CiRunSummary;
  checks: CiCheckResult[];
}

export interface CiContractOptions {
  customerId?: string;
  featureKey?: string;
}

export async function runCiSmokeChecks(api: ApiClient): Promise<CiRunResult> {
  const checks: CiCheckResult[] = [];

  checks.push(
    await runCheck("auth-workspace", async () => {
      const response = await api.get<Record<string, unknown>>("/api/v1/workspace/current");
      const workspaceId = response.data?.id;
      return {
        status: "pass",
        message:
          typeof workspaceId === "string" && workspaceId.length > 0
            ? `Workspace resolved: ${workspaceId}`
            : "Workspace current endpoint responded.",
      };
    }),
  );

  checks.push(
    await runCheck("api-reachability", async () => {
      const response = await api.get<Record<string, unknown>>("/api/v1/openapi.json");
      const hasOpenApi = typeof response.data?.openapi === "string";
      return {
        status: hasOpenApi ? "pass" : "fail",
        message: hasOpenApi
          ? `OpenAPI version detected: ${String(response.data.openapi)}`
          : "OpenAPI document missing `openapi` field.",
      };
    }),
  );

  checks.push(
    await runCheck("catalog-schema", async () => {
      const response = await api.get<unknown>("/api/v1/plans");
      const payload = response.data as { data?: unknown } | unknown[];
      const plans = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as { data?: unknown })?.data)
          ? ((payload as { data: unknown[] }).data ?? [])
          : [];

      return {
        status: "pass",
        message: `Catalog plans endpoint responded with ${plans.length} item(s).`,
      };
    }),
  );

  return {
    kind: "smoke",
    generatedAt: new Date().toISOString(),
    summary: summarizeChecks(checks),
    checks,
  };
}

export async function runCiContractChecks(
  api: ApiClient,
  options: CiContractOptions,
): Promise<CiRunResult> {
  const checks: CiCheckResult[] = [];

  checks.push(
    await runCheck("entitlement-evaluation-contract", async () => {
      if (!options.customerId || !options.featureKey) {
        return {
          status: "skipped",
          message:
            "Set --customer and --feature (or MONETIZEKIT_CONTRACT_CUSTOMER / MONETIZEKIT_CONTRACT_FEATURE) to run entitlement contract check.",
        };
      }

      const response = await api.get<{
        customerId?: string;
        featureKey?: string;
        allowed?: unknown;
      }>(
        `/api/v1/entitlements/${encodeURIComponent(options.customerId)}/${encodeURIComponent(options.featureKey)}`,
      );

      const looksValid =
        response.data?.customerId === options.customerId &&
        response.data?.featureKey === options.featureKey &&
        typeof response.data?.allowed === "boolean";

      return looksValid
        ? {
            status: "pass",
            message: "Entitlement contract fields matched expected shape.",
          }
        : {
            status: "fail",
            message: "Entitlement contract response did not match expected fields.",
            details: {
              expectedCustomerId: options.customerId,
              expectedFeatureKey: options.featureKey,
              received: response.data,
            },
          };
    }),
  );

  checks.push(
    await runCheck("webhook-signature-contract", async () => {
      const payload = JSON.stringify({
        event: "ci.contract-test",
        ts: "2026-01-01T00:00:00.000Z",
      });
      const secret = "contract-test-secret";
      const signature = computeWebhookSignature(payload, secret);
      const valid = verifyWebhookSignature(payload, signature, secret);
      const invalidWithWrongSecret = verifyWebhookSignature(payload, signature, `${secret}-other`);

      return valid && !invalidWithWrongSecret
        ? {
            status: "pass",
            message: "Webhook signature verification contract passed.",
          }
        : {
            status: "fail",
            message: "Webhook signature verification contract failed.",
            details: { valid, invalidWithWrongSecret },
          };
    }),
  );

  return {
    kind: "contract-test",
    generatedAt: new Date().toISOString(),
    summary: summarizeChecks(checks),
    checks,
  };
}

async function runCheck(
  name: string,
  execute: () => Promise<{
    status: CiCheckStatus;
    message: string;
    details?: Record<string, unknown>;
  }>,
): Promise<CiCheckResult> {
  const startedAt = Date.now();
  try {
    const result = await execute();
    return {
      name,
      status: result.status,
      message: result.message,
      durationMs: Date.now() - startedAt,
      details: result.details,
    };
  } catch (error) {
    const typed = error as Error & { status?: number };
    return {
      name,
      status: "fail",
      message: typed.message || "Check failed.",
      durationMs: Date.now() - startedAt,
      details: typed.status ? { status: typed.status } : undefined,
    };
  }
}

function summarizeChecks(checks: CiCheckResult[]): CiRunSummary {
  return {
    total: checks.length,
    pass: checks.filter((check) => check.status === "pass").length,
    fail: checks.filter((check) => check.status === "fail").length,
    skipped: checks.filter((check) => check.status === "skipped").length,
  };
}
