import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_MCP_URL,
  MONETIZEKIT_MCP_SERVER_NAME,
  mergeMonetizekitMcpConfig,
} from "../../src/lib/mcp-config.js";

describe("mcp config property tests", () => {
  // Feature: monetizekit-cli, Property 20: MCP config merge preserves existing entries
  it("preserves existing mcpServers while upserting the monetizekit server entry", () => {
    const keyArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,15}$/);
    const valueArb = fc.record({
      url: fc.webUrl({ withFragments: false }),
      transport: fc.constantFrom("sse", "stdio"),
      env: fc.dictionary(fc.stringMatching(/^[A-Z_]{2,20}$/), fc.string({ maxLength: 40 })),
    });

    fc.assert(
      fc.property(
        fc.dictionary(keyArb, valueArb),
        fc.option(fc.webUrl({ withFragments: false }), { nil: undefined }),
        (servers, maybeUrl) => {
          const { [MONETIZEKIT_MCP_SERVER_NAME]: _, ...withoutMk } = servers;
          const input = { mcpServers: withoutMk, extra: { keep: true } };
          const merged = mergeMonetizekitMcpConfig(input, maybeUrl ?? DEFAULT_MCP_URL);

          expect(merged.extra).toEqual(input.extra);
          for (const [key, value] of Object.entries(withoutMk)) {
            expect(merged.mcpServers[key]).toEqual(value);
          }

          const monetizekitEntry = merged.mcpServers[MONETIZEKIT_MCP_SERVER_NAME] as {
            url: string;
            env: Record<string, string>;
            metadata: Record<string, string>;
          };
          expect(monetizekitEntry.url).toBe(maybeUrl ?? DEFAULT_MCP_URL);
          expect(monetizekitEntry.env.MONETIZEKIT_MCP_TOKEN).toBe("${MONETIZEKIT_MCP_TOKEN}");
          expect(monetizekitEntry.metadata.workspaceId).toBe("${MONETIZEKIT_WORKSPACE_ID}");
          expect(monetizekitEntry.metadata.environment).toBe("${MONETIZEKIT_ENV}");
        },
      ),
      { numRuns: 100 },
    );
  });
});
