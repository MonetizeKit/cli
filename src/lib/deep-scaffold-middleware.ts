import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { Node, Project } from "ts-morph";
import type { SourceFile } from "ts-morph";

import { renderUnifiedDiff } from "./deep-scaffold-diff.js";
import { resolveMiddlewarePath, resolveNextjsSrcPrefix } from "./deep-scaffold-paths.js";
import { applyTextEdits } from "./deep-scaffold-text-edits.js";
import type { TextEdit } from "./deep-scaffold-text-edits.js";
import type { DeepScaffoldOptions, DeepScaffoldStepResult } from "./deep-scaffold.js";
import { writeTextFile } from "./io.js";

export const MIDDLEWARE_MARKER_START = "// @monetizekit:middleware-start";
export const MIDDLEWARE_MARKER_END = "// @monetizekit:middleware-end";
const MONETIZEKIT_MATCHER_PATTERN = "/monetizekit-example/:path*";
const UNRECOGNIZED_MATCHER_REASON = "existing matcher config not recognized";
const NO_DEFAULT_EXPORT_REASON = "no default export found in middleware file";

const MARKER_BLOCK = [
  MIDDLEWARE_MARKER_START,
  "/**",
  " * MonetizeKit-owned middleware helper. Call this from your own middleware",
  " * handler to enable entitlement-aware routing for the routes covered by",
  " * MonetizeKit's matcher pattern below. See https://docs.monetizekit.com.",
  " */",
  "export function monetizekitMiddleware(request: unknown): void {",
  "  // TODO: add MonetizeKit entitlement checks for protected routes here.",
  "}",
  MIDDLEWARE_MARKER_END,
].join("\n");

export async function applyMiddlewareScaffold(options: DeepScaffoldOptions): Promise<DeepScaffoldStepResult> {
  if (options.projectType !== "nextjs") {
    return {
      step: "middleware",
      status: "skipped",
      reason: "middleware scaffold only applies to Next.js projects",
    };
  }

  const srcPrefix = await resolveNextjsSrcPrefix(options.projectRoot);
  const relativePath = resolveMiddlewarePath(srcPrefix);
  const absolutePath = join(options.projectRoot, relativePath);

  const existingText = await readExistingFile(absolutePath);
  if (existingText === null) {
    const newText = buildNewMiddlewareFile();
    return await finalizeStep(options, relativePath, absolutePath, null, newText);
  }

  if (existingText.includes(MIDDLEWARE_MARKER_START)) {
    return { step: "middleware", status: "already-present", path: relativePath };
  }

  const merged = mergeMiddlewareFile(existingText, relativePath);
  if (!merged.ok) {
    return { step: "middleware", status: "skipped", path: relativePath, reason: merged.reason };
  }

  return await finalizeStep(options, relativePath, absolutePath, existingText, merged.text);
}

async function finalizeStep(
  options: DeepScaffoldOptions,
  relativePath: string,
  absolutePath: string,
  before: string | null,
  after: string,
): Promise<DeepScaffoldStepResult> {
  if (options.dryRun) {
    const { diff } = renderUnifiedDiff(relativePath, before, after);
    return { step: "middleware", status: "applied", path: relativePath, diff };
  }

  await writeTextFile(absolutePath, after);
  return { step: "middleware", status: "applied", path: relativePath };
}

async function readExistingFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    const typed = error as NodeJS.ErrnoException;
    if (typed.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function buildNewMiddlewareFile(): string {
  return [
    MARKER_BLOCK,
    "",
    "export default function middleware(request: unknown) {",
    "  monetizekitMiddleware(request);",
    "}",
    "",
    "export const config = {",
    "  // Add your own route patterns alongside MonetizeKit's below.",
    `  matcher: ["${MONETIZEKIT_MATCHER_PATTERN}"],`,
    "};",
    "",
  ].join("\n");
}

type MergeResult = { ok: true; text: string } | { ok: false; reason: string };

/**
 * Inserts the marker block above the file's `export default` and merges
 * MonetizeKit's matcher pattern into `config.matcher`. Both edits are
 * computed as offsets against the same original parse and combined in one
 * pass (`applyTextEdits`) rather than mutated sequentially, so neither
 * edit's position is invalidated by the other.
 */
function mergeMiddlewareFile(existingText: string, relativePath: string): MergeResult {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile(relativePath, existingText);

  const defaultExportStart = findDefaultExportStart(sourceFile);
  if (defaultExportStart === undefined) {
    return { ok: false, reason: NO_DEFAULT_EXPORT_REASON };
  }

  const matcherEdit = computeMatcherEdit(sourceFile);
  if (!matcherEdit.ok) {
    return matcherEdit;
  }

  const markerEdit: TextEdit = {
    start: defaultExportStart,
    end: defaultExportStart,
    replacement: `${MARKER_BLOCK}\n\n`,
  };

  return { ok: true, text: applyTextEdits(existingText, [markerEdit, matcherEdit.edit]) };
}

function findDefaultExportStart(sourceFile: SourceFile): number | undefined {
  const defaultExportStatement = sourceFile.getStatements().find((statement) => {
    if (Node.isExportAssignment(statement)) {
      return true;
    }

    if (Node.isFunctionDeclaration(statement) || Node.isClassDeclaration(statement)) {
      return statement.isDefaultExport();
    }

    return false;
  });

  return defaultExportStatement?.getStart();
}

type MatcherEditResult = { ok: true; edit: TextEdit } | { ok: false; reason: string };

/**
 * Recognizes exactly the shapes design.md calls out as safe to merge into:
 * no `config` export yet, a `config` object without a `matcher` key, a
 * string-literal matcher, or an array-of-string-literals matcher. Anything
 * else (a referenced identifier, a template literal, a non-string array
 * element, etc.) fails closed per Requirement 3.3.
 */
function computeMatcherEdit(sourceFile: SourceFile): MatcherEditResult {
  const configDeclaration = sourceFile.getVariableDeclaration("config");
  if (!configDeclaration) {
    const insertPos = sourceFile.getEnd();
    return {
      ok: true,
      edit: {
        start: insertPos,
        end: insertPos,
        replacement: `\nexport const config = {\n  matcher: ["${MONETIZEKIT_MATCHER_PATTERN}"],\n};\n`,
      },
    };
  }

  const statement = configDeclaration.getVariableStatement();
  if (!statement?.hasExportKeyword()) {
    return { ok: false, reason: UNRECOGNIZED_MATCHER_REASON };
  }

  const initializer = configDeclaration.getInitializer();
  if (!initializer || !Node.isObjectLiteralExpression(initializer)) {
    return { ok: false, reason: UNRECOGNIZED_MATCHER_REASON };
  }

  const matcherProperty = initializer.getProperty("matcher");
  if (!matcherProperty) {
    const insertPos = initializer.getEnd() - 1;
    const needsLeadingComma = initializer.getProperties().length > 0;
    return {
      ok: true,
      edit: {
        start: insertPos,
        end: insertPos,
        replacement: `${needsLeadingComma ? "," : ""}\n  matcher: ["${MONETIZEKIT_MATCHER_PATTERN}"],\n`,
      },
    };
  }

  if (!Node.isPropertyAssignment(matcherProperty)) {
    return { ok: false, reason: UNRECOGNIZED_MATCHER_REASON };
  }

  const matcherValue = matcherProperty.getInitializer();
  if (!matcherValue) {
    return { ok: false, reason: UNRECOGNIZED_MATCHER_REASON };
  }

  if (Node.isStringLiteral(matcherValue)) {
    return {
      ok: true,
      edit: {
        start: matcherValue.getStart(),
        end: matcherValue.getEnd(),
        replacement: `[${matcherValue.getText()}, "${MONETIZEKIT_MATCHER_PATTERN}"]`,
      },
    };
  }

  if (Node.isArrayLiteralExpression(matcherValue)) {
    const elements = matcherValue.getElements();
    if (!elements.every((element) => Node.isStringLiteral(element))) {
      return { ok: false, reason: UNRECOGNIZED_MATCHER_REASON };
    }

    const alreadyPresent = elements.some(
      (element) => Node.isStringLiteral(element) && element.getLiteralText() === MONETIZEKIT_MATCHER_PATTERN,
    );
    if (alreadyPresent) {
      const noopPos = matcherValue.getStart();
      return { ok: true, edit: { start: noopPos, end: noopPos, replacement: "" } };
    }

    const insertPos = matcherValue.getEnd() - 1;
    const needsLeadingComma = elements.length > 0;
    return {
      ok: true,
      edit: {
        start: insertPos,
        end: insertPos,
        replacement: `${needsLeadingComma ? ", " : ""}"${MONETIZEKIT_MATCHER_PATTERN}"`,
      },
    };
  }

  return { ok: false, reason: UNRECOGNIZED_MATCHER_REASON };
}
