import { Flags } from "@oclif/core";
import { join } from "node:path";

import { BaseCommand } from "../lib/base-command.js";
import { deepScaffoldProject } from "../lib/deep-scaffold.js";
import type { DeepScaffoldFileDiff } from "../lib/deep-scaffold-diff.js";
import { writeTextFile } from "../lib/io.js";
import { detectProjectType, scaffoldMonetizekitProject, type ProjectType } from "../lib/init.js";
import { DEFAULT_MCP_URL, mergeCursorMcpJson, renderCursorEnvExample } from "../lib/mcp-config.js";

export default class InitCommand extends BaseCommand {
  static summary =
    "Scaffold MonetizeKit project files for local integration, including deep scaffolding (provider wrap, middleware, webhook route, protected example) for Next.js and Node projects";

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
    "dry-run": Flags.boolean({
      description:
        "Preview every file Shallow_Scaffold and Deep_Scaffold would create/edit as unified diffs, without writing anything",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(InitCommand);
    const dryRun = flags["dry-run"];
    const cwd = process.cwd();
    const projectType = await detectProjectType(cwd);
    const scaffold = await scaffoldMonetizekitProject({
      projectRoot: cwd,
      projectType,
      stripe: flags.stripe,
      dryRun,
    });
    const deepScaffold = await deepScaffoldProject({ projectRoot: cwd, projectType, dryRun });

    const files = [...scaffold.files];
    const diffs: DeepScaffoldFileDiff[] = [...scaffold.diffs];
    for (const step of deepScaffold.steps) {
      if (step.diff && step.path) {
        diffs.push({ path: step.path, diff: step.diff });
      }
    }

    let cursorConfigUpdated = false;
    if (flags.cursor && !dryRun) {
      const mcpUrl = flags["mcp-url"] ?? process.env.MONETIZEKIT_MCP_URL ?? DEFAULT_MCP_URL;
      await mergeCursorMcpJson(join(cwd, ".cursor", "mcp.json"), mcpUrl);
      await writeTextFile(join(cwd, ".cursor", "monetizekit.env.example"), renderCursorEnvExample());
      files.push(".cursor/mcp.json", ".cursor/monetizekit.env.example");
      cursorConfigUpdated = true;
      this.output.info("Cursor MCP scaffold complete. Set env vars and restart Cursor.");
    } else if (flags.cursor && dryRun) {
      this.output.info("--dry-run: skipping Cursor MCP scaffold (not part of Shallow_Scaffold/Deep_Scaffold).");
    }

    if (!deepScaffold.supported) {
      this.output.info(describeUnsupportedDeepScaffoldProjectType(projectType));
    }

    this.output.result(
      {
        projectType,
        files,
        cursor: cursorConfigUpdated,
        dryRun,
        deepScaffoldSupported: deepScaffold.supported,
        steps: deepScaffold.steps,
        ...(dryRun ? { diffs } : {}),
      },
      "1.0.0",
    );
  }
}

function describeUnsupportedDeepScaffoldProjectType(projectType: ProjectType): string {
  switch (projectType) {
    case "go":
      return "Deep scaffolding (provider wrap, middleware, webhook route, protected example) requires a published MonetizeKit SDK for Go, which does not exist yet. Falling back to Shallow_Scaffold (.monetizekit/ files) only.";
    case "python":
      return "Deep scaffolding (provider wrap, middleware, webhook route, protected example) requires a published MonetizeKit SDK for Python, which does not exist yet. Falling back to Shallow_Scaffold (.monetizekit/ files) only.";
    case "java":
      return "Deep scaffolding (provider wrap, middleware, webhook route, protected example) requires a published MonetizeKit SDK for Java, which does not exist yet. Falling back to Shallow_Scaffold (.monetizekit/ files) only.";
    case "generic":
      return "Deep scaffolding (provider wrap, middleware, webhook route, protected example) is only available for Next.js (@monetizekit/react) and Node (@monetizekit/node) projects today. Falling back to Shallow_Scaffold (.monetizekit/ files) only.";
    case "nextjs":
    case "node":
      return "";
    default: {
      const exhaustiveCheck: never = projectType;
      throw new Error(`Unhandled project type: ${String(exhaustiveCheck)}`);
    }
  }
}
