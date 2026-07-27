import type { z } from "zod";

import { ExitCode } from "./exit-codes.js";

export interface FieldError {
  path: string;
  message: string;
}

export interface InputRejection {
  exitCode: ExitCode;
  message: string;
  remediation?: string;
  fieldErrors?: FieldError[];
}

export type ResolveInputResult<T> = { ok: true; data: T } | ({ ok: false } & InputRejection);

export async function readStdin(stream: NodeJS.ReadableStream = process.stdin): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Resolves the raw JSON text for `--input-json <value>`, treating the literal
 * value "-" as "read the document from stdin" per Requirement 2.1.
 */
export async function readInputJsonValue(
  value: string,
  stream: NodeJS.ReadableStream = process.stdin,
): Promise<string> {
  return value === "-" ? readStdin(stream) : value;
}

function toJsonPointer(path: Array<string | number>): string {
  return path.length === 0 ? "" : `/${path.map(String).join("/")}`;
}

export function mapZodIssuesToFieldErrors(issues: z.ZodIssue[]): FieldError[] {
  return issues.map((issue) => ({ path: toJsonPointer(issue.path), message: issue.message }));
}

export function hasAnyDefinedValue(candidate: Record<string, unknown> | undefined): boolean {
  if (!candidate) {
    return false;
  }

  return Object.values(candidate).some((value) => value !== undefined);
}

export function validateAgainstSchema<T>(
  schema: z.ZodType<T>,
  document: unknown,
): ResolveInputResult<T> {
  const result = schema.safeParse(document);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  const fieldErrors = mapZodIssuesToFieldErrors(result.error.issues);
  const messageLines = fieldErrors.map((fieldError) => `  ${fieldError.path || "/"}: ${fieldError.message}`);

  return {
    ok: false,
    exitCode: ExitCode.ValidationFailed,
    message: `Input failed schema validation:\n${messageLines.join("\n")}`,
    fieldErrors,
  };
}

/**
 * Requirement 2.4: `--input-json` together with individual flags/args for the
 * same command's input is a usage conflict, not a silent override.
 */
export function checkMutualExclusion(
  inputJson: string | undefined,
  flagsCandidate: Record<string, unknown> | undefined,
): InputRejection | null {
  if (inputJson !== undefined && hasAnyDefinedValue(flagsCandidate)) {
    return {
      exitCode: ExitCode.InvalidArguments,
      message: "--input-json cannot be combined with individual flags/args for this command's input.",
      remediation: "Supply either --input-json or the individual flags/args, not both.",
    };
  }

  return null;
}
