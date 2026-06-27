import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname } from "node:path";

import YAML from "yaml";

export async function readStructuredFile(path: string): Promise<unknown> {
  const source = await readFile(path, "utf8");
  const extension = extname(path).toLowerCase();

  if (extension === ".yaml" || extension === ".yml") {
    return YAML.parse(source);
  }

  return JSON.parse(source) as unknown;
}

export async function readObjectFile(path: string): Promise<Record<string, unknown>> {
  const parsed = await readStructuredFile(path);
  if (!isRecord(parsed)) {
    throw new Error(`Expected an object in ${path}.`);
  }

  return parsed;
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
