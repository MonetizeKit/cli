import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { listAllCatalog } from "../../lib/catalog.js";
import { writeCatalogSnapshotToDir } from "../../lib/catalog-files.js";

export default class CatalogExportCommand extends BaseCommand {
  static summary = "Export full catalog state to a directory";

  static flags = {
    ...BaseCommand.globalFlags,
    dir: Flags.string({
      description: "Target directory for exported catalog files",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(CatalogExportCommand);
    const snapshot = await listAllCatalog(this.api);
    const written = await writeCatalogSnapshotToDir(flags.dir, snapshot);

    this.output.result(
      {
        directory: flags.dir,
        files: written.map((entry) => entry.relativePath),
      },
      "1.0.0",
    );
  }
}
