import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import manifest from "../../package.json" with { type: "json" };

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const isWindows = process.platform === "win32";
let workDir = "";
let consumerDir = "";

/**
 * Runs a command, using a shell on Windows so `.cmd` shims resolve.
 */
function exec(command: string, args: string[], cwd: string): SpawnSyncReturns<string> {
  return spawnSync(command, args, { cwd, encoding: "utf8", shell: isWindows });
}

/**
 * Runs the installed `configra` executable or Windows shim from the consumer.
 */
function configra(...args: string[]): SpawnSyncReturns<string> {
  const bin = join(consumerDir, "node_modules", ".bin", isWindows ? "configra.cmd" : "configra");

  return exec(isWindows ? `"${bin}"` : bin, args, consumerDir);
}

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "configra-smoke-"));
  consumerDir = join(workDir, "consumer");

  const build = exec("npm", ["run", "build"], repoRoot);

  expect(build.status, build.stderr).toBe(0);

  const pack = exec("npm", ["pack", "--pack-destination", workDir], repoRoot);

  expect(pack.status, pack.stderr).toBe(0);

  const tarball = readdirSync(workDir).find((name) => name.endsWith(".tgz"));

  expect(tarball).toBeDefined();
  mkdirSync(consumerDir);
  writeFileSync(join(consumerDir, "package.json"), JSON.stringify({ name: "consumer", private: true }));

  const install = exec(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", join(workDir, tarball ?? "")],
    consumerDir,
  );

  expect(install.status, install.stderr).toBe(0);
});

afterAll(() => {
  if (workDir) {
    rmSync(workDir, { recursive: true, force: true });
  }
});

describe("packed CLI", () => {
  it("prints the version through the installed executable", () => {
    const result = configra("--version");

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe(manifest.version);
  });
});
