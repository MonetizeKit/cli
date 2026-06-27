import type { Hook } from "@oclif/core";

import { installRedactionFilter } from "../lib/redaction.js";

let restoreRedactionFilter: (() => void) | null = null;

const hook: Hook.Init = async function initHook() {
  if (!restoreRedactionFilter) {
    restoreRedactionFilter = installRedactionFilter();
  }

  if (process.argv.includes("--debug")) {
    process.stderr.write("[monetizekit-cli] debug mode enabled\n");
  }

  if (process.argv.includes("--trace")) {
    process.stderr.write("[monetizekit-cli] trace mode enabled\n");
  }
};

export default hook;
