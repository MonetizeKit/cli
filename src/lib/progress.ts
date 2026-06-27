export interface ProgressOptions {
  json: boolean;
  quiet: boolean;
}

interface ProgressRuntime {
  stderr: (message: string) => void;
}

export class ProgressIndicator {
  private readonly options: ProgressOptions;
  private readonly runtime: ProgressRuntime;

  constructor(options: ProgressOptions, runtime: Partial<ProgressRuntime> = {}) {
    this.options = options;
    this.runtime = {
      stderr: runtime.stderr ?? ((message) => process.stderr.write(message)),
    };
  }

  spinner(message: string): { stop: (finalMessage?: string) => void } {
    if (this.options.json || this.options.quiet) {
      return {
        stop: () => {
          // no-op in machine-readable or quiet modes
        },
      };
    }

    this.runtime.stderr(`${message}\n`);
    return {
      stop: (finalMessage?: string) => {
        if (finalMessage) {
          this.runtime.stderr(`${finalMessage}\n`);
        }
      },
    };
  }

  bar(total: number, label: string): { increment: (n?: number) => void; stop: () => void } {
    if (this.options.json || this.options.quiet) {
      return {
        increment: () => {
          // no-op in machine-readable or quiet modes
        },
        stop: () => {
          // no-op in machine-readable or quiet modes
        },
      };
    }

    let current = 0;
    this.runtime.stderr(`${label}: 0/${total}\n`);

    return {
      increment: (n = 1) => {
        current = Math.min(total, current + n);
        this.runtime.stderr(`${label}: ${current}/${total}\n`);
      },
      stop: () => {
        this.runtime.stderr(`${label}: ${current}/${total} complete\n`);
      },
    };
  }
}
