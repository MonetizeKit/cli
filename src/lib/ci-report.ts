import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { CiRunResult } from "./ci.js";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderJUnitXml(result: CiRunResult): string {
  const failures = result.summary.fail;
  const skipped = result.summary.skipped;
  const totalSeconds = (result.checks.reduce((acc, check) => acc + check.durationMs, 0) / 1000).toFixed(
    3,
  );

  const testCases = result.checks
    .map((check) => {
      const durationSeconds = (check.durationMs / 1000).toFixed(3);
      const header = `<testcase name="${escapeXml(check.name)}" classname="monetizekit.cli.${escapeXml(result.kind)}" time="${durationSeconds}">`;

      if (check.status === "fail") {
        return `${header}<failure message="${escapeXml(check.message)}">${escapeXml(
          JSON.stringify(check.details ?? {}),
        )}</failure></testcase>`;
      }

      if (check.status === "skipped") {
        return `${header}<skipped message="${escapeXml(check.message)}"/></testcase>`;
      }

      return `${header}</testcase>`;
    })
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<testsuites><testsuite name="monetizekit-cli ${escapeXml(result.kind)}" tests="${result.summary.total}" failures="${failures}" skipped="${skipped}" time="${totalSeconds}">` +
    testCases +
    `</testsuite></testsuites>\n`
  );
}

export async function writeJUnitReport(path: string, result: CiRunResult): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, renderJUnitXml(result), "utf8");
}
