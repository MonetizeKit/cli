import { Flags } from "@oclif/core";

import { BaseCommand } from "../../lib/base-command.js";
import { runCiContractChecks } from "../../lib/ci.js";
import { writeJUnitReport } from "../../lib/ci-report.js";

export default class CiContractTestCommand extends BaseCommand {
  static summary = "Run CI contract tests for entitlement and webhook behavior";

  static flags = {
    ...BaseCommand.globalFlags,
    customer: Flags.string({
      description:
        "Customer ID for entitlement contract check (defaults to MONETIZEKIT_CONTRACT_CUSTOMER)",
      required: false,
    }),
    feature: Flags.string({
      description:
        "Feature key for entitlement contract check (defaults to MONETIZEKIT_CONTRACT_FEATURE)",
      required: false,
    }),
    "junit-out": Flags.string({
      description: "Write JUnit XML report to this path",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(CiContractTestCommand);
    const result = await runCiContractChecks(this.api, {
      customerId: flags.customer ?? process.env.MONETIZEKIT_CONTRACT_CUSTOMER,
      featureKey: flags.feature ?? process.env.MONETIZEKIT_CONTRACT_FEATURE,
    });

    if (flags["junit-out"]) {
      await writeJUnitReport(flags["junit-out"], result);
    }

    this.output.result(
      {
        ...result,
        junit: flags["junit-out"] ?? null,
      },
      "1.0.0",
    );

    if (result.summary.fail > 0) {
      this.exit(1);
      return;
    }

    if (result.summary.skipped > 0) {
      this.exit(10);
    }
  }
}
