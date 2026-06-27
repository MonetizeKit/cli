const MASK_SUFFIX = "****";

export const SECRET_PATTERNS: RegExp[] = [
  /Authorization:\s*[^\r\n]+/gi,
  /Bearer\s+[A-Za-z0-9._-]+/g,
  /mk_live_[A-Za-z0-9_-]+/g,
  /mk_test_[A-Za-z0-9_-]+/g,
  /pk_live_[A-Za-z0-9_-]+/g,
  /pk_test_[A-Za-z0-9_-]+/g,
  /whsec_[A-Za-z0-9_-]+/g,
];

function maskSecret(match: string): string {
  const prefixLength = Math.min(8, match.length);
  return `${match.slice(0, prefixLength)}${MASK_SUFFIX}`;
}

export function redact(input: string): string {
  let output = input;
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, (match) => maskSecret(match));
  }

  return output;
}

function patchStreamWrite(stream: NodeJS.WriteStream): () => void {
  const originalWrite = stream.write.bind(stream);

  const patchedWrite = ((chunk: unknown, encoding?: unknown, callback?: unknown) => {
    let resolvedEncoding = encoding;
    let resolvedCallback = callback;

    if (typeof resolvedEncoding === "function") {
      resolvedCallback = resolvedEncoding;
      resolvedEncoding = undefined;
    }

    const redactedChunk =
      typeof chunk === "string" || Buffer.isBuffer(chunk)
        ? redact(String(chunk))
        : chunk;

    return originalWrite(
      redactedChunk as never,
      resolvedEncoding as never,
      resolvedCallback as never,
    );
  }) as typeof stream.write;

  (stream.write as typeof patchedWrite) = patchedWrite;

  return () => {
    (stream.write as typeof originalWrite) = originalWrite;
  };
}

export function installRedactionFilter(): () => void {
  const restoreStdout = patchStreamWrite(process.stdout);
  const restoreStderr = patchStreamWrite(process.stderr);

  return () => {
    restoreStdout();
    restoreStderr();
  };
}
