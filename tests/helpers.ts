import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect } from "vitest";
import { run } from "../src/cli/main.js";
import type { OutputDocument } from "../src/cli/output.js";
import { canceled, type Canceled, type Prompter } from "../src/cli/prompts/prompter.js";
import { systemRunner, type ProcessRunner } from "../src/platform/process.js";

const created: string[] = [];

afterEach(() => {
  // Retry because Git can still be writing in the background, such as for automatic maintenance after a commit.
  for (const dir of created.splice(0)) {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
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
 * A process runner that reports fixed versions for version probes and runs other Git commands for real.
 */
export const fakeRunner: ProcessRunner = {
  run: (executable, args, cwd) => {
    if (executable === "git" && !args.includes("--version")) {
      return systemRunner.run(executable, args, cwd);
    }

    // The check after a Composer install that PHP_CodeSniffer registered the WordPress standard.
    if (executable === "php" && args.includes("-i")) {
      return {
        status: 0,
        stdout: "The installed coding standards are PSR12, WordPress and WordPress-Core",
        stderr: "",
      };
    }

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
  stream: (executable) => ({ status: null, error: new Error(`${executable} doesn't run in offline tests`) }),
};

/**
 * Records the streamed commands a run makes and answers them with the given exit codes in order.
 */
export function recordingRunner(statuses: number[] = []): ProcessRunner & { calls: string[] } {
  const calls: string[] = [];

  return {
    calls,
    run: fakeRunner.run,
    stream: (executable, args) => {
      calls.push([executable, ...args].join(" "));

      return { status: statuses.shift() ?? 0 };
    },
  };
}

export interface CliRun {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Answers a prompt with its initial value: the preselected choice, the preselected items, or yes.
 */
export const accept: unique symbol = Symbol("accept");

/**
 * A scripted answer: a value, `accept` for the initial value, or `canceled`.
 */
export type Answer = string | string[] | boolean | typeof accept | Canceled;

/**
 * A prompter that answers prompts in order from a script and records every question and note. It fails
 * the test when a prompt has no scripted answer.
 */
export function scriptedPrompter(answers: Answer[] = []): Prompter & { asked: string[]; notes: string[] } {
  const asked: string[] = [];
  const notes: string[] = [];

  const next = <Value>(message: string, initial: Value): Value | Canceled => {
    asked.push(message);

    if (answers.length === 0) {
      throw new Error(`No scripted answer for the prompt "${message}".`);
    }

    const answer = answers.shift();

    return answer === accept ? initial : (answer as Value | Canceled);
  };

  return {
    asked,
    notes,
    intro: (title) => notes.push(title),
    outro: (message) => notes.push(message),
    note: (message, title) => notes.push(title ? `${title}\n${message}` : message),
    warn: (message) => notes.push(message),
    select: ({ message, choices, initial }) =>
      Promise.resolve(next(message, initial ?? choices.find((choice) => !choice.disabled)?.value)) as never,
    multiselect: ({ message, initial }) => Promise.resolve(next(message, initial)),
    confirm: ({ message, initial }) => Promise.resolve(next(message, initial ?? true)),
    text: ({ message, initial, validate }) => {
      const answer = next(message, initial);

      if (typeof answer === "string" && validate?.(answer) !== undefined) {
        throw new Error(`The scripted answer "${answer}" for "${message}" is invalid: ${String(validate(answer))}`);
      }

      return Promise.resolve(answer);
    },
  };
}

/**
 * Runs the CLI in-process from the given working directory. A terminal run fails the test if it prompts.
 */
export async function runCli(
  argv: string[],
  cwd: string,
  tty = false,
  runner: ProcessRunner = fakeRunner,
  prompter: Prompter = scriptedPrompter(),
): Promise<CliRun> {
  let stdout = "";
  let stderr = "";

  const code = await run(argv, {
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
    cwd,
    stdinIsTTY: tty,
    stdoutIsTTY: tty,
    env: { NO_COLOR: "1" },
    runner,
    prompter,
  });

  return { code, stdout, stderr };
}

/**
 * Runs the CLI in a simulated terminal with scripted prompt answers.
 */
export async function runTerminal(
  argv: string[],
  cwd: string,
  answers: Answer[],
  runner: ProcessRunner = fakeRunner,
): Promise<CliRun & { asked: string[]; notes: string[] }> {
  const prompter = scriptedPrompter(answers);
  const result = await runCli(argv, cwd, true, runner, prompter);

  expect(answers, `Unused answers after: ${prompter.asked.join(" | ")}`).toEqual([]);

  return { ...result, asked: prompter.asked, notes: prompter.notes };
}

export { canceled };

/**
 * Runs the CLI with --json and parses the single document it prints.
 */
export async function runJson(
  argv: string[],
  cwd: string,
  runner: ProcessRunner = fakeRunner,
): Promise<{ code: number; document: OutputDocument; stderr: string }> {
  const result = await runCli([...argv, "--json"], cwd, false, runner);

  return { code: result.code, document: JSON.parse(result.stdout) as OutputDocument, stderr: result.stderr };
}
