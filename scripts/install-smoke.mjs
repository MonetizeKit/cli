/**
 * Published-package install smoke: pack the real tarball (prepack builds dist +
 * oclif manifest), install it into a clean project, and run the published
 * binary to confirm it resolves and executes for external consumers.
 */
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(path.join(tmpdir(), "mk-cli-smoke-"));

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: "inherit" });
}

try {
  run(`npm pack --pack-destination "${work}"`, repo);
  const tarball = readdirSync(work).find((f) => f.endsWith(".tgz"));
  if (!tarball) throw new Error("npm pack produced no tarball");

  writeFileSync(path.join(work, "package.json"), JSON.stringify({ name: "smoke", private: true }, null, 2));
  run(`npm install --no-save "${path.join(work, tarball)}"`, work);

  const bin = path.join(work, "node_modules", ".bin", "monetizekit");
  run(`"${bin}" --version`, work);
  run(`"${bin}" customers list --help`, work);
  console.log("Install smoke passed: @monetizekit/cli installs + the monetizekit binary runs in a clean project.");
} finally {
  rmSync(work, { recursive: true, force: true });
}
