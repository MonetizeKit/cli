import { BaseCommand } from "../../../lib/base-command.js";
import { detectProjectType, installSdkForProject } from "../../../lib/init.js";

export default class InitSdkInstallCommand extends BaseCommand {
  static summary = "Install the recommended MonetizeKit SDK package";

  static flags = {
    ...BaseCommand.globalFlags,
  };

  async run(): Promise<void> {
    const cwd = process.cwd();
    const projectType = await detectProjectType(cwd);
    const result = await installSdkForProject(cwd, projectType);
    this.output.result(result, "1.0.0");

    if (!result.installed && result.supported) {
      this.exit(1);
    }
  }
}
