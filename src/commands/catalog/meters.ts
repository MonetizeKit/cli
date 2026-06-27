import { Args, Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { runCatalogCrudCommand, type CatalogCrudAction } from "../../lib/catalog-crud.js";

export default class CatalogMetersCommand extends BaseCommand {
  static summary = "Manage meter catalog objects";

  static args = {
    action: Args.string({
      description: "CRUD action",
      options: ["list", "get", "create", "update", "delete"],
      required: true,
    }),
    id: Args.string({
      description: "Catalog object id (required for get/delete, optional for update)",
      required: false,
    }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
    from: Flags.string({
      description: "YAML/JSON input file for create/update",
      required: false,
    }),
    out: Flags.string({
      description: "Write command output to file",
      required: false,
    }),
    "dry-run": Flags.boolean({
      description: "Preview intended changes without applying mutations",
      default: false,
    }),
    yes: Flags.boolean({
      char: "y",
      description: "Skip destructive confirmation prompts",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(CatalogMetersCommand);

    await runCatalogCrudCommand(
      "meters",
      {
        action: args.action as CatalogCrudAction,
        id: args.id,
      },
      {
        from: flags.from,
        out: flags.out,
        dryRun: flags["dry-run"],
        yes: flags.yes,
      },
      {
        api: this.api,
        output: this.output,
        fail: (message, exitCode) => this.error(message, { exit: exitCode }),
      },
    );
  }
}
