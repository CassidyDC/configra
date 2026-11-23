import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const isWindows = process.platform === "win32";
const lefthookBin = join(repoRoot, "node_modules", ".bin", isWindows ? "lefthook.cmd" : "lefthook");
let dir = "";

/**
 * Runs a command in the temporary repository.
 */
function exec(command: string, args: string[]): SpawnSyncReturns<string> {
  return spawnSync(command, args, { cwd: dir, encoding: "utf8", shell: isWindows });
}

/**
 * Runs Git and fails the test when it exits with an error.
 */
function git(...args: string[]): string {
  const result = exec("git", args);

  expect(result.status, result.stderr).toBe(0);

  return result.stdout;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "configra-lefthook-"));
  git("init", "-q");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("config", "core.autocrlf", "false");

  // The check fails when any staged file contains the marker, so it shows which content the hook saw.
  writeFileSync(
    join(dir, "check.mjs"),
    [
      'import { readFileSync } from "node:fs";',
      "const bad = process.argv.slice(2).filter((file) => readFileSync(file, 'utf8').includes('BAD'));",
      "if (bad.length > 0) { console.error(`marker in ${bad.join(', ')}`); process.exit(1); }",
      "",
    ].join("\n"),
  );

  writeFileSync(
    join(dir, "lefthook.yml"),
    [
      "pre-commit:",
      "  commands:",
      "    check:",
      '      glob: "*.txt"',
      "      run: node check.mjs {staged_files}",
      "",
    ].join("\n"),
  );

  writeFileSync(join(dir, "f.txt"), "good\n");
  git("add", ".");
  git("commit", "-q", "-m", "Initial commit");

  const install = exec(isWindows ? `"${lefthookBin}"` : lefthookBin, ["install"]);

  expect(install.status, install.stderr + install.stdout).toBe(0);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("Lefthook pre-commit with partially staged files", () => {
  it("checks the staged content and restores unstaged changes", () => {
    writeFileSync(join(dir, "f.txt"), "good\nstaged\n");
    git("add", "f.txt");
    writeFileSync(join(dir, "f.txt"), "good\nstaged\nBAD unstaged\n");

    const commit = exec("git", ["commit", "-q", "-m", "Commit the staged part"]);

    expect(commit.status, commit.stderr + commit.stdout).toBe(0);
    expect(git("show", "HEAD:f.txt")).toBe("good\nstaged\n");
    expect(readFileSync(join(dir, "f.txt"), "utf8")).toBe("good\nstaged\nBAD unstaged\n");
  });

  it("rejects bad staged content even when the working tree is clean", () => {
    writeFileSync(join(dir, "f.txt"), "good\nBAD staged\n");
    git("add", "f.txt");
    writeFileSync(join(dir, "f.txt"), "good\nclean\n");

    const commit = exec("git", ["commit", "-q", "-m", "Should fail"]);

    expect(commit.status).not.toBe(0);
    expect(readFileSync(join(dir, "f.txt"), "utf8")).toBe("good\nclean\n");
  });
});
