import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const TSX_BIN = join(REPO_ROOT, "node_modules", ".bin", "tsx");
const DEV_ENTRY = join(REPO_ROOT, "bin", "dev.ts");
const BOUNDED_TIMEOUT_MS = 8_000;

interface CliResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function runCli(args: string[], env: NodeJS.ProcessEnv = {}): CliResult {
  const isolatedHome = mkdtempSync(join(tmpdir(), "monetizekit-cli-home-"));
  try {
    const result = spawnSync(TSX_BIN, [DEV_ENTRY, ...args], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      timeout: BOUNDED_TIMEOUT_MS,
      env: { ...process.env, HOME: isolatedHome, ...env },
      input: "",
    });

    return {
      status: result.status,
      signal: result.signal,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      // node reports a killed-by-timeout child via a non-null signal (SIGTERM)
      timedOut: result.signal !== null && result.error === undefined,
    };
  } finally {
    rmSync(isolatedHome, { recursive: true, force: true });
  }
}

/**
 * Async variant of `runCli`. Required whenever the CLI under test calls back into an
 * in-process mock HTTP server: `spawnSync` blocks this process's event loop for the
 * child's entire lifetime, so a same-process server would never get to `accept()` the
 * CLI's connection and the child would hang until the timeout killed it.
 */
function runCliAsync(args: string[], env: NodeJS.ProcessEnv = {}): Promise<CliResult> {
  const isolatedHome = mkdtempSync(join(tmpdir(), "monetizekit-cli-home-"));
  return new Promise((resolve) => {
    const child = spawn(TSX_BIN, [DEV_ENTRY, ...args], {
      cwd: REPO_ROOT,
      env: { ...process.env, HOME: isolatedHome, ...env },
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
    child.stdin.end();

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, BOUNDED_TIMEOUT_MS);

    child.on("close", (status, signal) => {
      clearTimeout(timer);
      rmSync(isolatedHome, { recursive: true, force: true });
      resolve({ status, signal, stdout, stderr, timedOut });
    });
  });
}

describe("Interactive_Prompt audit: Agent_Mode + missing input exits fast, never hangs", () => {
  // Feature: agent-mode-parity, Requirement 1.4/1.6, tasks.md 5.4

  it("auth login without --key under --mode agent exits 2 without opening a browser/prompting", () => {
    const result = runCli(["auth", "login", "--mode", "agent"]);

    expect(result.timedOut).toBe(false);
    expect(result.status).toBe(2);
    const payload = JSON.parse(result.stdout);
    expect(payload.data.error.code).toBe("InvalidArguments");
    expect(payload.data.error.message).toContain("--key");
  });

  it("auth login without --key and without a TTY (no --mode) still exits 2, not a hang", () => {
    const result = runCli(["auth", "login"]);

    expect(result.timedOut).toBe(false);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("--key");
  });

  it("entitlements overrides set without --yes under --mode agent exits 2 without prompting", () => {
    const result = runCli(["entitlements", "overrides", "set", "cust_1", "feature_1", "true", "--mode", "agent"]);

    expect(result.timedOut).toBe(false);
    expect(result.status).toBe(2);
    const payload = JSON.parse(result.stdout);
    expect(payload.data.error.code).toBe("InvalidArguments");
    expect(payload.data.error.remediation).toContain("--yes");
  });

  it("entitlements overrides clear without --yes under --mode agent exits 2 without prompting", () => {
    const result = runCli(["entitlements", "overrides", "clear", "cust_1", "feature_1", "--mode", "agent"]);

    expect(result.timedOut).toBe(false);
    expect(result.status).toBe(2);
    const payload = JSON.parse(result.stdout);
    expect(payload.data.error.code).toBe("InvalidArguments");
  });

  it("catalog products delete without --yes under --mode agent exits 2 before any network call", () => {
    const result = runCli([
      "catalog",
      "products",
      "delete",
      "prod_1",
      "--mode",
      "agent",
      "--api-url",
      "http://127.0.0.1:1",
    ]);

    expect(result.timedOut).toBe(false);
    expect(result.status).toBe(2);
    const payload = JSON.parse(result.stdout);
    expect(payload.data.error.code).toBe("InvalidArguments");
    expect(payload.data.error.remediation).toContain("--yes");
  });

  describe("catalog import (destructiveness depends on a remote diff)", () => {
    let server: Server;
    let baseUrl: string;
    let catalogDir: string;

    afterEach(async () => {
      catalogDir && rmSync(catalogDir, { recursive: true, force: true });
      if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it("without --yes under --mode agent exits 2 without hanging on a prompt", { timeout: 15_000 }, async () => {
      catalogDir = mkdtempSync(join(tmpdir(), "monetizekit-cli-catalog-import-"));
      mkdirSync(join(catalogDir, "plans"), { recursive: true });
      writeFileSync(
        join(catalogDir, "plans", "plan_1.json"),
        JSON.stringify({ id: "plan_1", name: "Local Name" }),
      );

      await new Promise<void>((resolve) => {
        server = createServer((request, response) => {
          response.setHeader("content-type", "application/json");
          if (request.url === "/api/v1/plans") {
            response.end(JSON.stringify([{ id: "plan_1", name: "Remote Name" }]));
            return;
          }

          response.end(JSON.stringify([]));
        });
        server.listen(0, "127.0.0.1", resolve);
      });

      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      baseUrl = `http://127.0.0.1:${port}`;

      const result = await runCliAsync([
        "catalog",
        "import",
        "--dir",
        catalogDir,
        "--mode",
        "agent",
        "--api-url",
        baseUrl,
      ]);

      expect(result.timedOut).toBe(false);
      expect(result.status).toBe(2);
      const payload = JSON.parse(result.stdout);
      expect(payload.data.error.code).toBe("InvalidArguments");
      expect(payload.data.error.remediation).toContain("--yes");
    });
  });
});
