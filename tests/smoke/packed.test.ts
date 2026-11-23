import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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

/**
 * Builds and packs the package, or returns the tarball in `CONFIGRA_TARBALL` so a release tests the
 * exact file it publishes.
 */
function packedTarball(): string {
  if (process.env.CONFIGRA_TARBALL) {
    return resolve(repoRoot, process.env.CONFIGRA_TARBALL);
  }

  const build = exec("npm", ["run", "build"], repoRoot);

  expect(build.status, build.stderr).toBe(0);

  const pack = exec("npm", ["pack", "--pack-destination", workDir], repoRoot);

  expect(pack.status, pack.stderr).toBe(0);

  const tarball = readdirSync(workDir).find((name) => name.endsWith(".tgz"));

  expect(tarball).toBeDefined();

  return join(workDir, tarball ?? "");
}

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "configra-smoke-"));
  consumerDir = join(workDir, "consumer");

  const tarball = packedTarball();

  mkdirSync(consumerDir);
  writeFileSync(join(consumerDir, "package.json"), JSON.stringify({ name: "consumer", private: true }));

  const install = exec("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], consumerDir);

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

  it("prints help for bare configra, both aliases, and each command", () => {
    for (const args of [[], ["--help"], ["-h"], ["init", "--help"], ["update", "--help"]]) {
      const result = configra(...args);

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain("Usage: configra");
    }

    expect(configra("init", "--help").stdout).toContain("--on-conflict <action>");
  });

  it("plans a fresh project as one JSON document without prompting", () => {
    const target = join(workDir, "fresh");

    mkdirSync(target);

    const result = configra("init", "--cwd", target, "--dry-run", "--json");
    const document = JSON.parse(result.stdout) as { status: string; changes: Array<{ path: string }> };

    expect(result.status, result.stderr).toBe(0);
    expect(document.status).toBe("changes");
    expect(document.changes.map((change) => change.path)).toContain(".configra/scripts/commit-msg.js");
    expect(readdirSync(target)).toEqual([]);
  });

  it("packs the CLI entry point, schemas, and runtime assets", () => {
    const installed = join(consumerDir, "node_modules", "@cassidydc", "configra");

    for (const path of [
      "dist/cli/index.js",
      "dist/schemas/config.v1.json",
      "dist/schemas/output.v1.json",
      "dist/components/tools/assets/commit-msg.mjs",
      "dist/components/tools/assets/php-lint.mjs",
      "dist/components/tools/assets/php-tool.mjs",
      "README.md",
      "CHANGELOG.md",
      "LICENSE",
    ]) {
      expect(existsSync(join(installed, path)), path).toBe(true);
    }

    for (const declarations of ["commit-msg", "php-lint", "php-tool"]) {
      expect(existsSync(join(installed, `dist/components/tools/assets/${declarations}.d.mts`))).toBe(false);
    }
  });
});
