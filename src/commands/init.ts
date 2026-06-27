import { Flags } from "@oclif/core";
import { join } from "node:path";

import { BaseCommand } from "../lib/base-command.js";
import { writeTextFile } from "../lib/io.js";
import { detectProjectType, scaffoldMonetizekitProject } from "../lib/init.js";
import { DEFAULT_MCP_URL, mergeCursorMcpJson, renderCursorEnvExample } from "../lib/mcp-config.js";

export default class InitCommand extends BaseCommand {
  static summary = "Scaffold MonetizeKit project files for local integration";

  static flags = {
    ...BaseCommand.globalFlags,
    stripe: Flags.boolean({
      description: "Include Stripe webhook scaffold files",
      default: false,
    }),
    cursor: Flags.boolean({
      description: "Generate Cursor MCP scaffold (.cursor/mcp.json + env example)",
      default: false,
    }),
    "mcp-url": Flags.string({
      description: "Override MonetizeKit MCP URL for Cursor scaffold",
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(InitCommand);
    const cwd = process.cwd();
    const projectType = await detectProjectType(cwd);
    const scaffold = await scaffoldMonetizekitProject({
      projectRoot: cwd,
      projectType,
      stripe: flags.stripe,
    });

    const files = [...scaffold.files];
    let cursorConfigUpdated = false;

    if (flags.cursor) {
      const mcpUrl = flags["mcp-url"] ?? process.env.MONETIZEKIT_MCP_URL ?? DEFAULT_MCP_URL;
      await mergeCursorMcpJson(join(cwd, ".cursor", "mcp.json"), mcpUrl);
      await writeTextFile(join(cwd, ".cursor", "monetizekit.env.example"), renderCursorEnvExample());
      files.push(".cursor/mcp.json", ".cursor/monetizekit.env.example");
      cursorConfigUpdated = true;
      this.output.info("Cursor MCP scaffold complete. Set env vars and restart Cursor.");
    }

    this.output.result(
      {
        projectType,
        files,
        cursor: cursorConfigUpdated,
      },
      "1.0.0",
    );
  }
}
