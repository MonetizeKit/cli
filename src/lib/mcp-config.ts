import { readFile } from "node:fs/promises";

import { isRecord, writeTextFile } from "./io.js";

export const DEFAULT_MCP_URL = "https://mcp.monetizekit.com/v1";
export const MONETIZEKIT_MCP_SERVER_NAME = "monetizekit-mcp";

export interface McpServerEntry {
  url: string;
  transport: "sse";
  env: Record<string, string>;
  metadata: {
    workspaceId: string;
    environment: string;
    readOnlyDefault: boolean;
    toolDescriptions: boolean;
    groupLabel: string;
  };
  overrides: {
    url: string | null;
    timeout: number;
    allowedTools: string[] | null;
  };
}

export interface McpConfig {
  mcpServers: Record<string, unknown>;
  [key: string]: unknown;
}

export function buildMonetizekitMcpEntry(url: string): McpServerEntry {
  return {
    url,
    transport: "sse",
    env: {
      MONETIZEKIT_MCP_TOKEN: "${MONETIZEKIT_MCP_TOKEN}",
    },
    metadata: {
      workspaceId: "${MONETIZEKIT_WORKSPACE_ID}",
      environment: "${MONETIZEKIT_ENV}",
      readOnlyDefault: true,
      toolDescriptions: true,
      groupLabel: "MonetizeKit",
    },
    overrides: {
      url: null,
      timeout: 30,
      allowedTools: null,
    },
  };
}

export function mergeMonetizekitMcpConfig(existing: unknown, mcpUrl: string): McpConfig {
  const current = isRecord(existing) ? existing : {};
  const mcpServersRaw = current.mcpServers;
  const mcpServers = isRecord(mcpServersRaw) ? { ...mcpServersRaw } : {};
  mcpServers[MONETIZEKIT_MCP_SERVER_NAME] = buildMonetizekitMcpEntry(mcpUrl);

  return {
    ...current,
    mcpServers,
  };
}

export async function mergeCursorMcpJson(path: string, mcpUrl: string): Promise<McpConfig> {
  let parsed: unknown = {};
  try {
    const source = await readFile(path, "utf8");
    parsed = JSON.parse(source) as unknown;
  } catch (error) {
    const typed = error as NodeJS.ErrnoException;
    if (typed?.code !== "ENOENT") {
      throw error;
    }
  }

  const merged = mergeMonetizekitMcpConfig(parsed, mcpUrl);
  await writeTextFile(path, `${JSON.stringify(merged, null, 2)}\n`);
  return merged;
}

export function renderCursorEnvExample(): string {
  return [
    "# MonetizeKit MCP configuration",
    "# Set these variables in your environment or secret manager",
    "MONETIZEKIT_MCP_TOKEN=",
    "MONETIZEKIT_WORKSPACE_ID=",
    "MONETIZEKIT_ENV=dev",
    "",
  ].join("\n");
}
