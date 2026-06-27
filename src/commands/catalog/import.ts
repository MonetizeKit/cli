import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import {
  resolveCatalogCollectionPath,
  resolveCatalogItemPath,
  type CatalogResourceType,
} from "../../lib/catalog.js";
import { loadCatalogSnapshotFromDir, validateCatalogSnapshot } from "../../lib/catalog-files.js";
import { checkDestructiveGuard } from "../../lib/destructive-guard.js";
import { computeCatalogDiff, type CatalogChange } from "../../lib/diff.js";

export default class CatalogImportCommand extends BaseCommand {
  static summary = "Import catalog-as-code files into the active workspace";

  static flags = {
    ...BaseCommand.globalFlags,
    dir: Flags.string({
      description: "Catalog directory to import",
      required: true,
    }),
    "dry-run": Flags.boolean({
      description: "Preview planned import changes without mutation",
      default: false,
    }),
    yes: Flags.boolean({
      char: "y",
      description: "Skip destructive confirmation prompts",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(CatalogImportCommand);
    const local = await loadCatalogSnapshotFromDir(flags.dir);
    const validationErrors = validateCatalogSnapshot(local);
    if (validationErrors.length > 0) {
      this.error(`Catalog validation failed:\n- ${validationErrors.join("\n- ")}`, { exit: 7 });
    }

    const remote = await this.fetchRemoteSnapshot();
    const diff = computeCatalogDiff(local, remote);
    const hasDestructiveChanges = diff.updates.length > 0 || diff.deletes.length > 0;

    if (flags["dry-run"]) {
      this.output.result(
        {
          dryRun: true,
          directory: flags.dir,
          diff,
        },
        "1.0.0",
      );
      return;
    }

    if (hasDestructiveChanges) {
      const guard = await checkDestructiveGuard({
        yes: flags.yes,
        dryRun: false,
        promptMessage:
          "Import will apply updates/deletes to remote catalog objects. Continue?",
      });

      if (!guard.proceed) {
        this.error(guard.message ?? "Import cancelled.", { exit: guard.exitCode });
        return;
      }
    }

    for (const createChange of diff.creates) {
      const type = toResourceType(createChange.type);
      await this.api.post(resolveCatalogCollectionPath(type), createChange.after ?? {});
    }

    for (const updateChange of diff.updates) {
      const type = toResourceType(updateChange.type);
      const id = updateChange.id;
      const latest = await this.api.get<unknown>(resolveCatalogItemPath(type, id));
      await this.api.patch(
        resolveCatalogItemPath(type, id),
        updateChange.after ?? {},
        latest.headers.etag,
      );
    }

    for (const deleteChange of diff.deletes) {
      const type = toResourceType(deleteChange.type);
      const latest = await this.api.get<unknown>(resolveCatalogItemPath(type, deleteChange.id));
      await this.api.delete(resolveCatalogItemPath(type, deleteChange.id), latest.headers.etag);
    }

    this.output.result(
      {
        directory: flags.dir,
        applied: {
          creates: diff.creates.length,
          updates: diff.updates.length,
          deletes: diff.deletes.length,
        },
        unchanged: diff.unchanged,
      },
      "1.0.0",
    );
  }

  private async fetchRemoteSnapshot() {
    return {
      plans: await this.listByType("plans"),
      features: await this.listByType("features"),
      addons: await this.listByType("addons"),
      products: await this.listByType("products"),
      meters: await this.listByType("meters"),
    };
  }

  private async listByType(type: CatalogResourceType) {
    const response = await this.api.get<unknown>(resolveCatalogCollectionPath(type));
    if (Array.isArray(response.data)) {
      return response.data.filter(
        (value): value is Record<string, unknown> =>
          typeof value === "object" && value !== null && !Array.isArray(value),
      );
    }

    if (
      typeof response.data === "object" &&
      response.data !== null &&
      "data" in response.data &&
      Array.isArray((response.data as { data?: unknown }).data)
    ) {
      return ((response.data as { data: unknown[] }).data ?? []).filter(
        (value): value is Record<string, unknown> =>
          typeof value === "object" && value !== null && !Array.isArray(value),
      );
    }

    return [];
  }
}

function toResourceType(changeType: CatalogChange["type"]): CatalogResourceType {
  switch (changeType) {
    case "plan":
      return "plans";
    case "feature":
      return "features";
    case "addon":
      return "addons";
    case "product":
      return "products";
    case "meter":
      return "meters";
  }
}
