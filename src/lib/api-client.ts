import { randomUUID } from "node:crypto";

export interface ApiClientConfig {
  baseUrl: string;
  token: string;
  timeout: number;
  retries: number;
  debug: boolean;
  trace: boolean;
  userAgent: string;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  requestId: string;
  rateLimitRemaining: number;
  rateLimitReset: number;
}

export interface ApiClientRuntime {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
  log: (message: string) => void;
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
}

const BASE_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 30_000;

function createTimeoutError(message: string): Error {
  const error = new Error(message);
  error.name = "TimeoutError";
  return error;
}

function isRetryableMethod(method: string, hasIdempotencyKey: boolean): boolean {
  if (method === "GET" || method === "PUT" || method === "DELETE") {
    return true;
  }

  return method === "POST" && hasIdempotencyKey;
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const seconds = Number.parseInt(value, 10);
  if (Number.isNaN(seconds) || seconds < 0) {
    return null;
  }

  return seconds * 1000;
}

function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    result[key.toLowerCase()] = value;
  }

  return result;
}

async function parseBody<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  const text = await response.text();
  return (text as unknown) as T;
}

export class ApiClient {
  private readonly config: ApiClientConfig;
  private readonly runtime: ApiClientRuntime;

  constructor(config: ApiClientConfig, runtimeOverrides: Partial<ApiClientRuntime> = {}) {
    this.config = config;
    this.runtime = {
      fetch: runtimeOverrides.fetch ?? fetch,
      sleep: runtimeOverrides.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
      random: runtimeOverrides.random ?? (() => Math.random()),
      log: runtimeOverrides.log ?? ((message) => process.stderr.write(`${message}\n`)),
      setTimeout: runtimeOverrides.setTimeout ?? setTimeout,
      clearTimeout: runtimeOverrides.clearTimeout ?? clearTimeout,
    };
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const url = new URL(path, this.config.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    return this.request<T>("GET", url, {});
  }

  async post<T>(path: string, body: unknown, idempotencyKey?: string): Promise<ApiResponse<T>> {
    return this.request<T>("POST", new URL(path, this.config.baseUrl), {
      body,
      idempotencyKey,
    });
  }

  async patch<T>(path: string, body: unknown, etag?: string): Promise<ApiResponse<T>> {
    return this.request<T>("PATCH", new URL(path, this.config.baseUrl), { body, etag });
  }

  async delete(path: string, etag?: string): Promise<ApiResponse<void>> {
    return this.request<void>("DELETE", new URL(path, this.config.baseUrl), { etag });
  }

  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    url: URL,
    options: { body?: unknown; idempotencyKey?: string; etag?: string },
  ): Promise<ApiResponse<T>> {
    const hasIdempotencyKey = Boolean(options.idempotencyKey);
    const isRetryable = isRetryableMethod(method, hasIdempotencyKey);
    const maxRetries = isRetryable ? Math.max(0, this.config.retries) : 0;
    const requestId = randomUUID();

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= maxRetries) {
      const controller = new AbortController();
      let timedOut = false;
      const timeoutHandle = this.runtime.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, this.config.timeout * 1000);

      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${this.config.token}`,
          "Content-Type": "application/json",
          "User-Agent": this.config.userAgent,
          "X-Request-Id": requestId,
        };

        if (options.idempotencyKey) {
          headers["Idempotency-Key"] = options.idempotencyKey;
        }

        if (options.etag) {
          headers["If-Match"] = options.etag;
        }

        if (this.config.debug) {
          this.runtime.log(
            `[ApiClient] ${method} ${url.toString()} attempt=${attempt + 1} requestId=${requestId}`,
          );
        }

        const response = await this.runtime.fetch(url, {
          method,
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: controller.signal,
        });

        this.runtime.clearTimeout(timeoutHandle);
        const responseHeaders = headersToObject(response.headers);
        const responseRequestId = responseHeaders["x-request-id"] ?? requestId;

        if (response.ok) {
          const data = await parseBody<T>(response);
          return {
            data,
            status: response.status,
            headers: responseHeaders,
            requestId: this.config.trace ? responseRequestId : requestId,
            rateLimitRemaining: Number.parseInt(responseHeaders["x-ratelimit-remaining"] ?? "0", 10),
            rateLimitReset: Number.parseInt(responseHeaders["x-ratelimit-reset"] ?? "0", 10),
          };
        }

        const canRetry = isRetryable && attempt < maxRetries;
        const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
        const retryableStatus = response.status === 429 || response.status >= 500;

        if (canRetry && retryableStatus) {
          const delay = this.computeRetryDelay(attempt, retryAfterMs);
          await this.runtime.sleep(delay);
          attempt += 1;
          continue;
        }

        const error = new Error(`HTTP ${response.status}`);
        (error as Error & { status?: number }).status = response.status;
        throw error;
      } catch (error) {
        this.runtime.clearTimeout(timeoutHandle);

        if (timedOut) {
          lastError = createTimeoutError(
            `Request timed out after ${this.config.timeout} second(s): ${method} ${url.toString()}`,
          );
        } else {
          lastError = error;
        }

        const status = (lastError as { status?: number }).status;
        if (typeof status === "number" && status !== 429 && status < 500) {
          throw lastError;
        }

        const canRetry = isRetryable && attempt < maxRetries;
        if (!canRetry) {
          throw lastError;
        }

        const delay = this.computeRetryDelay(attempt, null);
        await this.runtime.sleep(delay);
        attempt += 1;
      }
    }

    throw (lastError as Error) ?? new Error("Request failed");
  }

  private computeRetryDelay(attempt: number, retryAfterMs: number | null): number {
    const jitter = Math.floor(this.runtime.random() * 500);
    const exponential = Math.min(BASE_RETRY_DELAY_MS * 2 ** attempt + jitter, MAX_RETRY_DELAY_MS);
    if (retryAfterMs === null) {
      return exponential;
    }

    return Math.max(exponential, retryAfterMs);
  }
}
