import { BaseCommand } from "../../lib/base-command.js";
import { runDoctorChecks } from "../../lib/doctor.js";
import { resolveProfileName, resolveTokenRef } from "../../lib/profile.js";

export default class DoctorFixCommand extends BaseCommand {
  static summary = "Apply automatic remediations where possible";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DoctorFixCommand);
    const config = this.configManager.load();
    const profileName = resolveProfileName(config, flags.profile);
    const profile = config.profiles[profileName] ?? {};
    const tokenRef = resolveTokenRef(profileName, profile);

    const report = await runDoctorChecks({
      api: this.api,
      credentials: this.credentials,
      tokenRef,
      profile,
    });

    const fixActions = report.checks
      .filter((check) => check.status === "fail")
      .map((check) => ({
        check: check.name,
        applied: false,
        message:
          check.name === "auth"
            ? "Manual action required: run `monetizekit auth login`."
            : check.remediation ?? "No automated fix available.",
      }));

    this.output.result(
      {
        fixesApplied: 0,
        actions: fixActions,
      },
      "1.0.0",
    );
  }
}
