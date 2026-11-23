import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach } from "vitest";
import { run } from "../src/cli/main.js";
import type { OutputDocument } from "../src/cli/output.js";
import type { ProcessRunner } from "../src/platform/process.js";

const created: string[] = [];

afterEach(() => {
  for (const dir of created.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * Creates a temporary directory with the given files, removed after the test.
 */
export function tempProject(files: Record<string, string> = {}, name = "project"): string {
  const parent = mkdtempSync(join(tmpdir(), "configra-test-"));
  const root = join(parent, name);

  created.push(parent);
  mkdirSync(root, { recursive: true });
  writeFiles(root, files);

  return root;
}

/**
 * Writes files relative to a root, creating directories as needed.
 */
export function writeFiles(root: string, files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
}

/**
 * A process runner that reports fixed versions without running anything.
 */
export const fakeRunner: ProcessRunner = {
  run: (executable) => {
    const versions: Record<string, string> = {
      npm: "11.6.0",
      git: "git version 2.50.0",
      php: "8.3.0",
      composer: "Composer version 2.8.0",
    };
    const version = versions[executable];

    return version
      ? { status: 0, stdout: version, stderr: "" }
      : { status: null, stdout: "", stderr: "", error: new Error("ENOENT") };
  },
};

export interface CliRun {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Runs the CLI in-process from the given working directory.
 */
export async function runCli(argv: string[], cwd: string, tty = false): Promise<CliRun> {
  let stdout = "";
  let stderr = "";

  const code = await run(argv, {
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
    cwd,
    stdinIsTTY: tty,
    stdoutIsTTY: tty,
    env: { NO_COLOR: "1" },
    runner: fakeRunner,
  });

  return { code, stdout, stderr };
}

/**
 * Runs the CLI with --json and parses the single document it prints.
 */
export async function runJson(
  argv: string[],
  cwd: string,
): Promise<{ code: number; document: OutputDocument; stderr: string }> {
  const result = await runCli([...argv, "--json"], cwd);

  return { code: result.code, document: JSON.parse(result.stdout) as OutputDocument, stderr: result.stderr };
}
