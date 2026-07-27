import { applyMiddlewareScaffold } from "./deep-scaffold-middleware.js";
import { applyProviderWrap } from "./deep-scaffold-provider-wrap.js";
import { applyWebhookRouteScaffold } from "./deep-scaffold-webhook-route.js";
import type { ProjectType } from "./init.js";

export type DeepScaffoldStepStatus = "applied" | "already-present" | "skipped";

export type DeepScaffoldStepName = "providerWrap" | "middleware" | "webhookRoute" | "protectedExample";

export interface DeepScaffoldStepResult {
  step: DeepScaffoldStepName;
  status: DeepScaffoldStepStatus;
  path?: string;
  /** Required when `status === "skipped"`. */
  reason?: string;
  /** Unified diff of the change, populated only under `--dry-run` (Requirement 2.4). */
  diff?: string;
}

export interface DeepScaffoldOptions {
  projectRoot: string;
  projectType: ProjectType;
  dryRun: boolean;
}

export interface DeepScaffoldResult {
  supported: boolean;
  steps: DeepScaffoldStepResult[];
}

export type SupportedDeepScaffoldProjectType = "nextjs" | "node";

export function isSupportedDeepScaffoldProjectType(
  projectType: ProjectType,
): projectType is SupportedDeepScaffoldProjectType {
  return projectType === "nextjs" || projectType === "node";
}

export async function deepScaffoldProject(options: DeepScaffoldOptions): Promise<DeepScaffoldResult> {
  if (!isSupportedDeepScaffoldProjectType(options.projectType)) {
    return { supported: false, steps: [] };
  }

  const steps: DeepScaffoldStepResult[] = [];
  steps.push(await applyProviderWrap(options));
  steps.push(await applyMiddlewareScaffold(options));
  steps.push(await applyWebhookRouteScaffold(options));
  return { supported: true, steps };
}
