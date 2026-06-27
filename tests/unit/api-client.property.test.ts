import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { ApiClient } from "../../src/lib/api-client.js";

function createJsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

describe("api client property tests", () => {
  // Feature: monetizekit-cli, Property 14: Retry with exponential backoff and jitter
  it("retries transient idempotent failures with increasing backoff", () => {
    fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (failureCount) => {
        let calls = 0;
        const delays: number[] = [];

        const client = new ApiClient(
          {
            baseUrl: "https://api.example.test",
            token: "token",
            timeout: 1,
            retries: failureCount,
            debug: false,
            trace: false,
            userAgent: "monetizekit-cli/test",
          },
          {
            fetch: async () => {
              calls += 1;
              if (calls <= failureCount) {
                return createJsonResponse({ error: "transient" }, 503);
              }

              return createJsonResponse({ ok: true }, 200);
            },
            sleep: async (ms) => {
              delays.push(ms);
            },
            random: () => 0,
            setTimeout: ((handler: TimerHandler) => {
              return setTimeout(handler, 0);
            }) as typeof setTimeout,
            clearTimeout,
          },
        );

        const response = await client.get<{ ok: boolean }>("/v1/test");
        expect(response.data.ok).toBe(true);
        expect(calls).toBe(failureCount + 1);
        expect(delays).toHaveLength(failureCount);

        for (let index = 1; index < delays.length; index += 1) {
          expect(delays[index]).toBeGreaterThan(delays[index - 1]);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: monetizekit-cli, Property 14: Retry with exponential backoff and jitter
  it("respects Retry-After on 429 responses", () => {
    fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 20 }), async (retryAfterSeconds) => {
        const delays: number[] = [];
        let calls = 0;

        const client = new ApiClient(
          {
            baseUrl: "https://api.example.test",
            token: "token",
            timeout: 1,
            retries: 1,
            debug: false,
            trace: false,
            userAgent: "monetizekit-cli/test",
          },
          {
            fetch: async () => {
              calls += 1;
              if (calls === 1) {
                return createJsonResponse(
                  { error: "rate_limited" },
                  429,
                  { "retry-after": String(retryAfterSeconds) },
                );
              }

              return createJsonResponse({ ok: true }, 200);
            },
            sleep: async (ms) => {
              delays.push(ms);
            },
            random: () => 0,
            setTimeout: ((handler: TimerHandler) => {
              return setTimeout(handler, 0);
            }) as typeof setTimeout,
            clearTimeout,
          },
        );

        await client.get<{ ok: boolean }>("/v1/test");
        expect(delays[0]).toBeGreaterThanOrEqual(retryAfterSeconds * 1000);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: monetizekit-cli, Property 15: Timeout enforcement
  it("fails with TimeoutError when timeout is exceeded", () => {
    fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (timeoutSeconds) => {
        const client = new ApiClient(
          {
            baseUrl: "https://api.example.test",
            token: "token",
            timeout: timeoutSeconds,
            retries: 0,
            debug: false,
            trace: false,
            userAgent: "monetizekit-cli/test",
          },
          {
            fetch: async (_url, init) =>
              await new Promise<Response>((_resolve, reject) => {
                const signal = init?.signal;
                if (signal) {
                  if (signal.aborted) {
                    reject(new Error("aborted"));
                    return;
                  }
                  signal.addEventListener("abort", () => reject(new Error("aborted")));
                }
              }),
            sleep: async () => {
              // no-op
            },
            random: () => 0,
            setTimeout: ((handler: TimerHandler) => {
              if (typeof handler === "function") {
                handler();
              }

              return 1 as unknown as ReturnType<typeof setTimeout>;
            }) as typeof setTimeout,
            clearTimeout: (() => {
              // no-op for synthetic timer
            }) as typeof clearTimeout,
          },
        );

        await expect(client.get("/v1/timeout")).rejects.toMatchObject({
          name: "TimeoutError",
        });
      }),
      { numRuns: 100 },
    );
  });

  // Feature: monetizekit-cli, Property 18: Idempotency key and timestamp propagation
  it("forwards idempotency key and request timestamp metadata correctly", () => {
    const idempotencyKeyArb = fc.option(fc.stringMatching(/^[A-Za-z0-9_-]{8,40}$/), {
      nil: undefined,
    });
    const timestampArb = fc.option(
      fc
        .integer({
          min: Date.parse("2000-01-01T00:00:00.000Z"),
          max: Date.parse("2100-01-01T00:00:00.000Z"),
        })
        .map((epochMs) => new Date(epochMs).toISOString()),
      {
        nil: undefined,
      },
    );

    fc.assert(
      fc.asyncProperty(idempotencyKeyArb, timestampArb, async (idempotencyKey, timestamp) => {
        let capturedHeaders: Record<string, string> = {};
        let capturedBody: Record<string, unknown> = {};

        const client = new ApiClient(
          {
            baseUrl: "https://api.example.test",
            token: "token",
            timeout: 1,
            retries: 0,
            debug: false,
            trace: false,
            userAgent: "monetizekit-cli/test",
          },
          {
            fetch: async (_url, init) => {
              capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
              capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
              return createJsonResponse({ accepted: true }, 200);
            },
            sleep: async () => {
              // no-op
            },
            random: () => 0,
            setTimeout: ((handler: TimerHandler) => {
              return setTimeout(handler, 0);
            }) as typeof setTimeout,
            clearTimeout,
          },
        );

        const payload: Record<string, unknown> = {
          customerId: "cust_test",
          meterId: "meter_test",
          value: 1,
        };

        if (timestamp !== undefined) {
          payload.timestamp = timestamp;
        }

        await client.post("/v1/usage", payload, idempotencyKey);

        if (idempotencyKey !== undefined) {
          expect(capturedHeaders["Idempotency-Key"]).toBe(idempotencyKey);
        } else {
          expect(capturedHeaders["Idempotency-Key"]).toBeUndefined();
        }

        if (timestamp !== undefined) {
          expect(capturedBody.timestamp).toBe(timestamp);
        } else {
          expect(capturedBody).not.toHaveProperty("timestamp");
        }
      }),
      { numRuns: 100 },
    );
  });
});
