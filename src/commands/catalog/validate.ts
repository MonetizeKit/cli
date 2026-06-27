import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { loadCatalogSnapshotFromDir, validateCatalogSnapshot } from "../../lib/catalog-files.js";

export default class CatalogValidateCommand extends BaseCommand {
  static summary = "Validate catalog-as-code files locally";

  static flags = {
    ...BaseCommand.globalFlags,
    dir: Flags.string({
      description: "Catalog directory to validate",
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(CatalogValidateCommand);
    const snapshot = await loadCatalogSnapshotFromDir(flags.dir);
    const errors = validateCatalogSnapshot(snapshot);

    if (errors.length > 0) {
      this.error(`Catalog validation failed:\n- ${errors.join("\n- ")}`, { exit: 7 });
    }

    this.output.result(
      {
        valid: true,
        directory: flags.dir,
      },
      "1.0.0",
    );
  }
}
