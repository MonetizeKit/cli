import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";

export default class CustomersListCommand extends BaseCommand {
  static summary = "List customers in the active workspace";

  static flags = {
    ...BaseCommand.globalFlags,
    page: Flags.integer({
      description: "Page number",
      default: 1,
    }),
    "page-size": Flags.integer({
      description: "Page size",
      default: 50,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(CustomersListCommand);
    const response = await this.api.get<{
      data?: unknown[];
      total?: number;
      page?: number;
      pageSize?: number;
      totalPages?: number;
      hasNext?: boolean;
      hasPrev?: boolean;
    }>("/api/v1/customers", {
      page: String(flags.page),
      pageSize: String(flags["page-size"]),
    });

    this.output.result(response.data, "1.0.0");
  }
}
