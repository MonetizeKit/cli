import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { isRecord } from "../../lib/io.js";

interface CustomerLike {
  id?: string;
  name?: string;
  email?: string;
  [key: string]: unknown;
}

function normalizeCustomerList(payload: unknown): CustomerLike[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (isRecord(payload) && Array.isArray(payload.data)) {
    return payload.data.filter(isRecord);
  }

  return [];
}

function pickPagination(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) {
    return {};
  }

  const keys = ["total", "page", "pageSize", "totalPages", "hasNext", "hasPrev"];
  const pagination: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in payload) {
      pagination[key] = payload[key];
    }
  }

  return pagination;
}

export default class CustomersSearchCommand extends BaseCommand {
  static summary = "Search customers by name or email";

  static flags = {
    ...BaseCommand.globalFlags,
    query: Flags.string({
      description: "Search text for name/email",
      required: true,
    }),
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
    const { flags } = await this.parse(CustomersSearchCommand);
    const query = flags.query.trim().toLowerCase();
    const response = await this.api.get<unknown>("/api/v1/customers", {
      page: String(flags.page),
      pageSize: String(flags["page-size"]),
      search: flags.query,
    });

    const rows = normalizeCustomerList(response.data);
    const results = rows.filter((row) => {
      const name = typeof row.name === "string" ? row.name.toLowerCase() : "";
      const email = typeof row.email === "string" ? row.email.toLowerCase() : "";
      return name.includes(query) || email.includes(query);
    });

    this.output.result(
      {
        query: flags.query,
        count: results.length,
        results,
        pagination: pickPagination(response.data),
      },
      "1.0.0",
    );
  }
}
