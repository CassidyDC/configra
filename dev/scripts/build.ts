/**
 * Build Script
 * @file Compiles the published source and copies runtime assets into dist/.
 */

import { spawnSync } from "node:child_process";
import { chmodSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const dist = new URL("../../dist/", import.meta.url);

rmSync(dist, { recursive: true, force: true });

const compile = spawnSync("npx", ["tsc", "-p", "tsconfig.build.json"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (compile.status !== 0) {
  process.exit(compile.status ?? 1);
}

chmodSync(new URL("cli/index.js", dist), 0o755);
