/**
 * Example Updater
 * @file Regenerates examples/ by running the examples test in update mode.
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const result = spawnSync("npx", ["vitest", "run", "tests/integration/examples.test.ts"], {
  cwd: fileURLToPath(new URL("../../", import.meta.url)),
  env: { ...process.env, UPDATE_EXAMPLES: "1" },
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
