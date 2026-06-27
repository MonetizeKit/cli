import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

import { readStructuredFile, writeTextFile, isRecord } from "./io.js";

export type ProjectType = "nextjs" | "node" | "go" | "python" | "java" | "generic";

export interface InitScaffoldOptions {
  projectRoot: string;
  projectType: ProjectType;
  stripe: boolean;
}

export interface InitScaffoldResult {
  projectType: ProjectType;
  files: string[];
}

export interface SdkInstallResult {
  projectType: ProjectType;
  supported: boolean;
  packageName: string | null;
  packageManager: string | null;
  command: string | null;
  installed: boolean;
  message: string;
}

export async function detectProjectType(projectRoot: string): Promise<ProjectType> {
  const has = async (relativePath: string) => {
    try {
      await access(join(projectRoot, relativePath), constants.F_OK);
      return true;
    } catch {
      return false;
    }
  };

  const hasPackageJson = await has("package.json");
  if (hasPackageJson) {
    const packageJson = await readStructuredFile(join(projectRoot, "package.json"));
    if (isRecord(packageJson)) {
      const dependencies = {
        ...(isRecord(packageJson.dependencies) ? packageJson.dependencies : {}),
        ...(isRecord(packageJson.devDependencies) ? packageJson.devDependencies : {}),
      };
      if ("next" in dependencies || (await has("next.config.js")) || (await has("next.config.mjs"))) {
        return "nextjs";
      }
    }

    return "node";
  }

  if ((await has("go.mod")) || (await has("go.work"))) {
    return "go";
  }

  if ((await has("pyproject.toml")) || (await has("requirements.txt"))) {
    return "python";
  }

  if ((await has("pom.xml")) || (await has("build.gradle")) || (await has("build.gradle.kts"))) {
    return "java";
  }

  return "generic";
}

export async function scaffoldMonetizekitProject(
  options: InitScaffoldOptions,
): Promise<InitScaffoldResult> {
  const files: string[] = [];
  const baseDir = ".monetizekit";
  const readmePath = join(options.projectRoot, baseDir, "README.md");
  const envPath = join(options.projectRoot, baseDir, ".env.example");
  const sdkPath = join(options.projectRoot, baseDir, "sdk.example.ts");

  await writeTextFile(
    readmePath,
    [
      "# MonetizeKit scaffold",
      "",
      `Detected project type: ${options.projectType}`,
      "",
      "1. Set `MONETIZEKIT_API_URL`, `MONETIZEKIT_WORKSPACE`, and `MONETIZEKIT_TOKEN`.",
      "2. Install the SDK via `monetizekit init sdk install`.",
      "3. Run `monetizekit ci smoke` to validate setup.",
      "",
    ].join("\n"),
  );
  files.push(`${baseDir}/README.md`);

  await writeTextFile(
    envPath,
    [
      "MONETIZEKIT_API_URL=https://api.monetizekit.com",
      "MONETIZEKIT_WORKSPACE=",
      "MONETIZEKIT_ENV=dev",
      "MONETIZEKIT_TOKEN=",
      "",
    ].join("\n"),
  );
  files.push(`${baseDir}/.env.example`);

  await writeTextFile(
    sdkPath,
    [
      "import { MonetizeKitClient } from \"@monetizekit/node\";",
      "",
      "const client = new MonetizeKitClient({",
      "  apiUrl: process.env.MONETIZEKIT_API_URL ?? \"https://api.monetizekit.com\",",
      "  token: process.env.MONETIZEKIT_TOKEN ?? \"\",",
      "  workspaceId: process.env.MONETIZEKIT_WORKSPACE ?? \"\",",
      "});",
      "",
      "void client;",
      "",
    ].join("\n"),
  );
  files.push(`${baseDir}/sdk.example.ts`);

  if (options.stripe) {
    const stripePath = join(options.projectRoot, baseDir, "stripe", "webhook-handler.example.ts");
    await writeTextFile(
      stripePath,
      [
        "import crypto from \"node:crypto\";",
        "",
        "export function verifyStripeSignature(payload: string, signature: string, secret: string): boolean {",
        "  const expected = crypto",
        "    .createHmac(\"sha256\", secret)",
        "    .update(payload)",
        "    .digest(\"hex\");",
        "  return signature === expected;",
        "}",
        "",
      ].join("\n"),
    );
    files.push(`${baseDir}/stripe/webhook-handler.example.ts`);
  }

  return {
    projectType: options.projectType,
    files,
  };
}

export async function scaffoldCiTemplates(projectRoot: string): Promise<string[]> {
  const files: string[] = [];
  const githubPath = join(projectRoot, ".github", "workflows", "monetizekit-ci.yml");
  const gitlabPath = join(projectRoot, ".gitlab-ci.monetizekit.yml");

  await writeTextFile(
    githubPath,
    [
      "name: monetizekit-cli",
      "on: [push, pull_request]",
      "jobs:",
      "  monetizekit:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: actions/checkout@v4",
      "      - run: monetizekit ci smoke --json",
      "      - run: monetizekit ci contract-test --junit-out artifacts/monetizekit-contract.xml",
      "",
    ].join("\n"),
  );
  files.push(".github/workflows/monetizekit-ci.yml");

  await writeTextFile(
    gitlabPath,
    [
      "monetizekit_ci:",
      "  image: node:22",
      "  script:",
      "    - monetizekit ci smoke --json",
      "    - monetizekit ci contract-test --junit-out artifacts/monetizekit-contract.xml",
      "  artifacts:",
      "    when: always",
      "    paths:",
      "      - artifacts/monetizekit-contract.xml",
      "",
    ].join("\n"),
  );
  files.push(".gitlab-ci.monetizekit.yml");

  return files;
}

export async function installSdkForProject(
  projectRoot: string,
  projectType: ProjectType,
): Promise<SdkInstallResult> {
  const packageName = resolveSdkPackageName(projectType);
  if (!packageName) {
    return {
      projectType,
      supported: false,
      packageName: null,
      packageManager: null,
      command: null,
      installed: false,
      message:
        "Automatic SDK install currently supports Node/Next.js projects only. Install SDK manually for this project type.",
    };
  }

  const packageManager = await detectPackageManager(projectRoot);
  if (!packageManager) {
    return {
      projectType,
      supported: false,
      packageName,
      packageManager: null,
      command: null,
      installed: false,
      message: "No package manager lockfile found. Install SDK package manually.",
    };
  }

  const command = buildInstallCommand(packageManager, packageName);
  const [binary, ...args] = command;

  const completed = await runProcess(binary, args, projectRoot);
  if (!completed.ok) {
    return {
      projectType,
      supported: true,
      packageName,
      packageManager,
      command: command.join(" "),
      installed: false,
      message: completed.message,
    };
  }

  return {
    projectType,
    supported: true,
    packageName,
    packageManager,
    command: command.join(" "),
    installed: true,
    message: `Installed ${packageName} with ${packageManager}.`,
  };
}

function resolveSdkPackageName(projectType: ProjectType): string | null {
  switch (projectType) {
    case "nextjs":
      return "@monetizekit/react";
    case "node":
      return "@monetizekit/node";
    default:
      return null;
  }
}

async function detectPackageManager(projectRoot: string): Promise<"pnpm" | "npm" | "yarn" | null> {
  const has = async (relativePath: string) => {
    try {
      await access(join(projectRoot, relativePath), constants.F_OK);
      return true;
    } catch {
      return false;
    }
  };

  if (await has("pnpm-lock.yaml")) return "pnpm";
  if (await has("yarn.lock")) return "yarn";
  if (await has("package-lock.json")) return "npm";
  return null;
}

function buildInstallCommand(packageManager: "pnpm" | "npm" | "yarn", packageName: string): string[] {
  switch (packageManager) {
    case "pnpm":
      return ["pnpm", "add", packageName];
    case "yarn":
      return ["yarn", "add", packageName];
    case "npm":
      return ["npm", "install", packageName];
  }
}

async function runProcess(
  binary: string,
  args: string[],
  cwd: string,
): Promise<{ ok: boolean; message: string }> {
  return await new Promise((resolve) => {
    const child = spawn(binary, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      resolve({ ok: false, message: error.message });
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true, message: "ok" });
      } else {
        const message = stderr.trim().split("\n").at(-1) ?? `Installer exited with code ${String(code)}.`;
        resolve({ ok: false, message });
      }
    });
  });
}
