import YAML from "yaml";

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

export interface OutputOptions {
  json: boolean;
  quiet: boolean;
  noColor: boolean;
  output?: "json" | "yaml" | "table";
}

export interface OutputWriters {
  stdout?: (chunk: string) => void;
  stderr?: (chunk: string) => void;
}

export class OutputManager {
  private readonly options: OutputOptions;
  private readonly stdout: (chunk: string) => void;
  private readonly stderr: (chunk: string) => void;

  constructor(options: OutputOptions, writers: OutputWriters = {}) {
    this.options = options;
    this.stdout = writers.stdout ?? ((chunk) => process.stdout.write(chunk));
    this.stderr = writers.stderr ?? ((chunk) => process.stderr.write(chunk));
  }

  result(data: unknown, schemaVersion: string): void {
    if (this.options.json || this.options.output === "json") {
      this.writeStdout(
        JSON.stringify({
          schemaVersion,
          data,
        }),
      );
      return;
    }

    if (this.options.output === "yaml") {
      this.writeStdout(YAML.stringify(data));
      return;
    }

    if (this.options.output === "table" && Array.isArray(data)) {
      const rows = data as Array<Record<string, unknown>>;
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      this.table(rows, columns);
      return;
    }

    if (typeof data === "string") {
      this.writeStdout(data);
      return;
    }

    this.writeStdout(JSON.stringify(data, null, 2));
  }

  info(message: string): void {
    if (this.options.quiet) {
      return;
    }

    this.writeStderr(message);
  }

  warn(message: string): void {
    if (this.options.quiet) {
      return;
    }

    this.writeStderr(message);
  }

  error(message: string): void {
    this.writeStderr(message);
  }

  table(data: Record<string, unknown>[], columns: string[]): void {
    if (columns.length === 0) {
      this.writeStdout("");
      return;
    }

    const toCell = (value: unknown): string =>
      typeof value === "string" ? value : JSON.stringify(value ?? "");

    const widths = columns.map((column) =>
      Math.max(column.length, ...data.map((row) => toCell(row[column]).length)),
    );

    const renderRow = (cells: string[]) =>
      cells
        .map((cell, index) => cell.padEnd(widths[index], " "))
        .join(" | ")
        .trimEnd();

    const header = renderRow(columns);
    const separator = widths.map((width) => "-".repeat(width)).join("-+-");
    const rows = data.map((row) => renderRow(columns.map((column) => toCell(row[column]))));

    this.writeStdout([header, separator, ...rows].join("\n"));
  }

  private sanitize(text: string): string {
    if (!this.options.noColor) {
      return text;
    }

    return text.replaceAll(ANSI_PATTERN, "");
  }

  private ensureTrailingNewline(text: string): string {
    return text.endsWith("\n") ? text : `${text}\n`;
  }

  private writeStdout(text: string): void {
    this.stdout(this.ensureTrailingNewline(this.sanitize(text)));
  }

  private writeStderr(text: string): void {
    this.stderr(this.ensureTrailingNewline(this.sanitize(text)));
  }
}
