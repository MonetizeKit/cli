import { BaseCommand } from "../../lib/base-command.js";
import { runDoctorChecks } from "../../lib/doctor.js";
import { resolveProfileName, resolveTokenRef } from "../../lib/profile.js";

export default class DoctorReportCommand extends BaseCommand {
  static summary = "Output full diagnostic report";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DoctorReportCommand);
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
  }
}
