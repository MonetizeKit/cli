import type { ApiClient } from "./api-client.js";
import {
  createDryRunPreview,
  extractEtag,
  loadCatalogObjectFromFile,
  normalizeListPayload,
  normalizeObjectPayload,
  resolveCatalogCollectionPath,
  resolveCatalogItemPath,
  resolveCatalogObjectId,
  type CatalogResourceType,
  writeCatalogOutputFile,
} from "./catalog.js";
import { checkDestructiveGuard } from "./destructive-guard.js";
import { ExitCode } from "./exit-codes.js";
import type { OutputManager } from "./output.js";

export type CatalogCrudAction = "list" | "get" | "create" | "update" | "delete";

export interface CatalogCrudArgs {
  action: CatalogCrudAction;
  id?: string;
}

export interface CatalogCrudFlags {
  from?: string;
  out?: string;
  dryRun: boolean;
  yes: boolean;
}

export interface CatalogCrudRuntime {
  api: ApiClient;
  output: OutputManager;
  agentMode: boolean;
  fail: (message: string, exitCode: ExitCode, remediation?: string) => never;
}

export async function runCatalogCrudCommand(
  type: CatalogResourceType,
  args: CatalogCrudArgs,
  flags: CatalogCrudFlags,
  runtime: CatalogCrudRuntime,
): Promise<void> {
  if (args.action === "list") {
    const response = await runtime.api.get<unknown>(resolveCatalogCollectionPath(type));
    const data = normalizeListPayload(response.data);
    await emitResult(data, flags.out, runtime.output);
    return;
  }

  if (args.action === "get") {
    const id = requireId(args.id, runtime);
    const response = await runtime.api.get<unknown>(resolveCatalogItemPath(type, id));
    const data = normalizeObjectPayload(response.data);
    await emitResult(data, flags.out, runtime.output);
    return;
  }

  if (args.action === "create") {
    const fromPath = requireFrom(flags.from, runtime);
    const body = await loadCatalogObjectFromFile(fromPath);
    if (flags.dryRun) {
      runtime.output.result(
        createDryRunPreview({
          action: "create",
          type,
          id: resolveCatalogObjectId(body),
          after: body,
        }),
        "1.0.0",
      );
      return;
    }

    const response = await runtime.api.post<unknown>(resolveCatalogCollectionPath(type), body);
    const data = normalizeObjectPayload(response.data);
    await emitResult(data, flags.out, runtime.output);
    return;
  }

  if (args.action === "update") {
    const fromPath = requireFrom(flags.from, runtime);
    const body = await loadCatalogObjectFromFile(fromPath);
    const id = resolveCatalogObjectId(body) ?? args.id;
    if (!id) {
      runtime.fail(
        "`update` requires an object id in --from file or as positional id.",
        ExitCode.InvalidArguments,
      );
    }

    const currentResponse = await runtime.api.get<unknown>(resolveCatalogItemPath(type, id));
    const current = normalizeObjectPayload(currentResponse.data);
    if (flags.dryRun) {
      runtime.output.result(
        createDryRunPreview({
          action: "update",
          type,
          id,
          before: current,
          after: body,
        }),
        "1.0.0",
      );
      return;
    }

    const response = await runtime.api.patch<unknown>(
      resolveCatalogItemPath(type, id),
      body,
      extractEtag(currentResponse.headers),
    );
    const data = normalizeObjectPayload(response.data);
    await emitResult(data, flags.out, runtime.output);
    return;
  }

  if (args.action === "delete") {
    const id = requireId(args.id, runtime);

    // Requirement 1.4: deleting a known id is unconditionally destructive, so
    // the confirmation gate must fire before any network call — not after a
    // fetch that Agent_Mode would otherwise have to wait on before failing.
    if (!flags.dryRun) {
      const guard = await checkDestructiveGuard({
        yes: flags.yes,
        dryRun: false,
        agentMode: runtime.agentMode,
        promptMessage: `Delete ${type.slice(0, -1)} "${id}"?`,
      });

      if (!guard.proceed) {
        runtime.fail(guard.message ?? "Delete cancelled.", guard.exitCode, guard.remediation);
      }
    }

    const currentResponse = await runtime.api.get<unknown>(resolveCatalogItemPath(type, id));
    const current = normalizeObjectPayload(currentResponse.data);

    if (flags.dryRun) {
      runtime.output.result(
        createDryRunPreview({
          action: "delete",
          type,
          id,
          before: current,
        }),
        "1.0.0",
      );
      return;
    }

    await runtime.api.delete(resolveCatalogItemPath(type, id), extractEtag(currentResponse.headers));
    await emitResult({ deleted: true, type, id }, flags.out, runtime.output);
  }
}

function requireId(
  id: string | undefined,
  runtime: CatalogCrudRuntime,
): string {
  if (id && id.trim().length > 0) {
    return id;
  }

  runtime.fail("This action requires a catalog object id.", ExitCode.InvalidArguments);
}

function requireFrom(
  from: string | undefined,
  runtime: CatalogCrudRuntime,
): string {
  if (from && from.trim().length > 0) {
    return from;
  }

  runtime.fail("This action requires --from <file>.", ExitCode.InvalidArguments);
}

async function emitResult(data: unknown, out: string | undefined, output: OutputManager): Promise<void> {
  if (out) {
    await writeCatalogOutputFile(out, data);
    output.info(`Wrote output to ${out}`);
    return;
  }

  output.result(data, "1.0.0");
}
