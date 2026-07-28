import { cp, mkdtemp, readdir, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));

export const DEEP_SCAFFOLD_FIXTURES_ROOT = join(currentDir, "..", "fixtures", "deep-scaffold");

/**
 * Copies a fixture's `input/` directory into a fresh temp dir so Codemod
 * tests can mutate real files without touching the checked-in fixtures.
 */
export async function copyFixtureInputToTempDir(fixtureDir: string): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), "monetizekit-deep-scaffold-"));
  await cp(join(fixtureDir, "input"), projectRoot, { recursive: true });
  return projectRoot;
}

export async function readFileTree(root: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      const content = await readFile(fullPath, "utf8");
      files.set(relative(root, fullPath), content);
    }
  }

  if (await pathExists(root)) {
    await walk(root);
  }

  return files;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
