import { BaseCommand } from "../../lib/base-command.js";
import { runDoctorChecks } from "../../lib/doctor.js";
import { resolveProfileName, resolveTokenRef } from "../../lib/profile.js";

export default class DoctorRunCommand extends BaseCommand {
  static summary = "Run diagnostic checks and display remediation guidance";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DoctorRunCommand);
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

    this.output.result(report, "1.0.0");
    if (report.summary.fail > 0) {
      this.exit(1);
    }
  }
}
