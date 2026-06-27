import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { listAllCatalog } from "../../lib/catalog.js";
import { loadCatalogSnapshotFromDir } from "../../lib/catalog-files.js";
import { computeCatalogDiff } from "../../lib/diff.js";

export default class CatalogDiffCommand extends BaseCommand {
  static summary = "Diff local catalog-as-code against remote server state";

  static flags = {
    ...BaseCommand.globalFlags,
    dir: Flags.string({
      description: "Catalog directory to diff against server",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(CatalogDiffCommand);
    const local = await loadCatalogSnapshotFromDir(flags.dir);
    const remote = await listAllCatalog(this.api);
    const diff = computeCatalogDiff(local, remote);

    this.output.result(
      {
        directory: flags.dir,
        diff,
      },
      "1.0.0",
    );
  }
}
