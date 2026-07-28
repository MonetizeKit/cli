import { createTwoFilesPatch } from "diff";

export interface DeepScaffoldFileDiff {
  path: string;
  /** Unified diff text; empty when `before === after`. */
  diff: string;
}

/**
 * Renders a unified diff for a single file's before/after content, used to
 * preview `--dry-run` edits (Requirement 2.4, 6.2). `before` is `null` for a
 * newly created file.
 */
export function renderUnifiedDiff(path: string, before: string | null, after: string): DeepScaffoldFileDiff {
  if (before === after) {
    return { path, diff: "" };
  }

  const diff = createTwoFilesPatch(
    before === null ? "/dev/null" : `a/${path}`,
    `b/${path}`,
    before ?? "",
    after,
    undefined,
    undefined,
    { context: 3 },
  );

  return { path, diff };
}
