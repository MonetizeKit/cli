import { Args, Flags } from "@oclif/core";
import { z } from "zod";

import { BaseCommand } from "../../lib/base-command.js";

export const EntitlementsSimulateInputSchema = z.object({
  customer: z.string().min(1),
  feature: z.string().min(1),
  context: z.string().min(1).optional(),
});

export default class EntitlementsSimulateCommand extends BaseCommand {
  static summary = "Simulate effective entitlement decision";

  static description =
    "Accepts customer/feature/context either as positional args/flags or as a single " +
    "--input-json document (inline or `-` for stdin), never both.";

  static inputSchema = EntitlementsSimulateInputSchema;

  static args = {
    customer: Args.string({ description: "Customer ID", required: false }),
    feature: Args.string({ description: "Feature key", required: false }),
  };

  static flags = {
    ...BaseCommand.globalFlags,
    context: Flags.string({
      description: "Optional JSON context payload",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(EntitlementsSimulateCommand);
    const input = await this.resolveInput(EntitlementsSimulateInputSchema, {
      inputJson: flags["input-json"],
      flagsCandidate: { customer: args.customer, feature: args.feature, context: flags.context },
    });

    const query = input.context ? `?context=${encodeURIComponent(input.context)}` : "";
    const response = await this.api.get(
      `/api/v1/entitlements/${encodeURIComponent(input.customer)}/${encodeURIComponent(input.feature)}${query}`,
    );
    this.output.result(response.data, "1.0.0");
  }
}
