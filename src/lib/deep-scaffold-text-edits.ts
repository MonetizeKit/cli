export interface TextEdit {
  start: number;
  end: number;
  replacement: string;
}

/**
 * Applies a set of non-overlapping edits (computed from offsets into the
 * same original text) in a single pass, so multiple independent Codemod
 * edits against one parse can be combined without positions shifting under
 * each other.
 */
export function applyTextEdits(text: string, edits: TextEdit[]): string {
  const sortedEdits = [...edits].sort((a, b) => a.start - b.start);

  let result = "";
  let cursor = 0;
  for (const edit of sortedEdits) {
    result += text.slice(cursor, edit.start);
    result += edit.replacement;
    cursor = edit.end;
  }

  result += text.slice(cursor);
  return result;
}
