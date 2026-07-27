import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { Node, Project } from "ts-morph";
import type { ArrowFunction, FunctionDeclaration, FunctionExpression, JsxElement, SourceFile } from "ts-morph";

import { renderUnifiedDiff } from "./deep-scaffold-diff.js";
import { findAppRouterLayoutPath } from "./deep-scaffold-paths.js";
import type { DeepScaffoldOptions, DeepScaffoldStepResult } from "./deep-scaffold.js";
import { writeTextFile } from "./io.js";

const MONETIZEKIT_REACT_MODULE = "@monetizekit/react";
const PROVIDER_NAME = "MonetizeKitProvider";
const UNRECOGNIZED_LAYOUT_REASON = "unrecognized layout return shape";

type FunctionLikeNode = FunctionDeclaration | FunctionExpression | ArrowFunction;

export async function applyProviderWrap(options: DeepScaffoldOptions): Promise<DeepScaffoldStepResult> {
  const relativePath = await findAppRouterLayoutPath(options.projectRoot);
  if (!relativePath) {
    return {
      step: "providerWrap",
      status: "skipped",
      reason: "no app/layout.tsx or src/app/layout.tsx found",
    };
  }

  const absolutePath = join(options.projectRoot, relativePath);
  const originalText = await readFile(absolutePath, "utf8");

  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile(relativePath, originalText);

  const alreadyImported = sourceFile
    .getImportDeclarations()
    .some((declaration) => declaration.getModuleSpecifierValue() === MONETIZEKIT_REACT_MODULE);
  if (alreadyImported) {
    return { step: "providerWrap", status: "already-present", path: relativePath };
  }

  const rootElement = findRootLayoutJsxElement(sourceFile);
  if (!rootElement) {
    return {
      step: "providerWrap",
      status: "skipped",
      path: relativePath,
      reason: UNRECOGNIZED_LAYOUT_REASON,
    };
  }

  const newText = buildWrappedLayoutText(sourceFile, rootElement);

  if (options.dryRun) {
    const { diff } = renderUnifiedDiff(relativePath, originalText, newText);
    return { step: "providerWrap", status: "applied", path: relativePath, diff };
  }

  await writeTextFile(absolutePath, newText);
  return { step: "providerWrap", status: "applied", path: relativePath };
}

/**
 * Locates the layout's default-exported function and the single JSX root
 * element it returns. Anything else (no default export found, a fragment,
 * a conditional, a self-closing element, etc.) is fail-closed as
 * unrecognized (Requirement 2.3) rather than guessed at.
 */
function findRootLayoutJsxElement(sourceFile: SourceFile): JsxElement | undefined {
  const functionLikeNode = findDefaultExportedFunctionLikeNode(sourceFile);
  if (!functionLikeNode) {
    return undefined;
  }

  const returnedExpression = getReturnedExpression(functionLikeNode);
  if (!returnedExpression) {
    return undefined;
  }

  const unwrapped = unwrapParenthesized(returnedExpression);
  return Node.isJsxElement(unwrapped) ? unwrapped : undefined;
}

function findDefaultExportedFunctionLikeNode(sourceFile: SourceFile): FunctionLikeNode | undefined {
  const declarations = sourceFile.getExportedDeclarations().get("default") ?? [];
  for (const declaration of declarations) {
    if (Node.isFunctionDeclaration(declaration)) {
      return declaration;
    }

    if (Node.isVariableDeclaration(declaration)) {
      const initializer = declaration.getInitializer();
      if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) {
        return initializer;
      }
    }
  }

  return undefined;
}

function getReturnedExpression(functionLikeNode: FunctionLikeNode): Node | undefined {
  if (Node.isArrowFunction(functionLikeNode)) {
    const body = functionLikeNode.getBody();
    if (!Node.isBlock(body)) {
      return body;
    }

    return findReturnExpressionInBlockStatements(body.getStatements());
  }

  const body = functionLikeNode.getBody();
  if (!body || !Node.isBlock(body)) {
    return undefined;
  }

  return findReturnExpressionInBlockStatements(body.getStatements());
}

function findReturnExpressionInBlockStatements(statements: Node[]): Node | undefined {
  const returnStatement = statements.find((statement) => Node.isReturnStatement(statement));
  if (!returnStatement || !Node.isReturnStatement(returnStatement)) {
    return undefined;
  }

  return returnStatement.getExpression();
}

function unwrapParenthesized(node: Node): Node {
  let current = node;
  while (Node.isParenthesizedExpression(current)) {
    current = current.getExpression();
  }

  return current;
}

/**
 * Builds the layout file's full new text via plain string splicing on the
 * original source, rather than ts-morph's node-replacement/printer APIs
 * (`replaceWithText()`, `addImportDeclaration()`). Those APIs re-indent
 * multi-line replacements to the node's contextual depth, which double-counts
 * indentation we've already computed from the literal source — splicing
 * against raw offsets keeps every untouched line byte-for-byte unchanged.
 */
function buildWrappedLayoutText(sourceFile: SourceFile, rootElement: JsxElement): string {
  const originalText = sourceFile.getFullText();
  const wrappedElementText = buildWrappedElementText(rootElement);

  const importDeclarations = sourceFile.getImportDeclarations();
  const lastImport = importDeclarations.at(-1);
  const importStatement = `import { ${PROVIDER_NAME} } from "${MONETIZEKIT_REACT_MODULE}";`;
  const importInsertPos = lastImport ? lastImport.getEnd() : 0;
  const importInsertText = lastImport ? `\n${importStatement}` : `${importStatement}\n`;

  return (
    originalText.slice(0, importInsertPos) +
    importInsertText +
    originalText.slice(importInsertPos, rootElement.getStart()) +
    wrappedElementText +
    originalText.slice(rootElement.getEnd())
  );
}

/**
 * Replaces the root element's children with a single
 * `<MonetizeKitProvider>` wrapping the original children, leaving the root
 * element's own tag/props untouched (Requirement 2.1).
 */
function buildWrappedElementText(element: JsxElement): string {
  const openingText = element.getOpeningElement().getText();
  const closingText = element.getClosingElement().getText();
  const elementText = element.getText();
  const innerText = elementText.slice(openingText.length, elementText.length - closingText.length);

  const rootIndent = getLiteralLineIndentation(element);
  const childIndent = resolveChildIndent(element, rootIndent);
  const indentUnit =
    childIndent.length > rootIndent.length ? childIndent.slice(rootIndent.length) : "  ";

  // Drop the purely-whitespace boundary lines that connect the original
  // children to the opening/closing tags — they're reconstructed explicitly
  // below, so keeping them too would double up the blank line.
  const innerLines = innerText.split("\n");
  while (innerLines.length > 0 && innerLines[0].trim().length === 0) {
    innerLines.shift();
  }
  while (innerLines.length > 0 && (innerLines.at(-1) ?? "").trim().length === 0) {
    innerLines.pop();
  }

  const reindentedInner = innerLines
    .map((line) => (line.trim().length === 0 ? "" : `${indentUnit}${line}`))
    .join("\n");

  const wrappedInner =
    `\n${childIndent}<${PROVIDER_NAME}>\n${reindentedInner}\n${childIndent}</${PROVIDER_NAME}>\n${rootIndent}`;

  return `${openingText}${wrappedInner}${closingText}`;
}

function resolveChildIndent(element: JsxElement, rootIndent: string): string {
  const jsxChild = element
    .getJsxChildren()
    .find((child) => Node.isJsxElement(child) || Node.isJsxSelfClosingElement(child) || Node.isJsxFragment(child));

  if (jsxChild) {
    return getLiteralLineIndentation(jsxChild);
  }

  return `${rootIndent}  `;
}

/**
 * `Node.getIndentationText()` reflects ts-morph's *computed* formatting
 * indentation (based on AST nesting depth), not the literal source column —
 * it can disagree with how the user actually indented the file. We read the
 * real leading whitespace on the node's own line instead, so re-wrapping
 * preserves the user's existing indentation style exactly.
 */
function getLiteralLineIndentation(node: Node): string {
  const fullText = node.getSourceFile().getFullText();
  const start = node.getStart();
  const lineStart = fullText.lastIndexOf("\n", start - 1) + 1;
  const prefix = fullText.slice(lineStart, start);
  return /^\s*$/.test(prefix) ? prefix : "";
}
