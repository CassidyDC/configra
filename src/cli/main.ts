import type { Diagnostic } from "../contracts.js";
import { systemRunner, type ProcessRunner } from "../platform/process.js";
import { parseCliArgs } from "./args.js";
import { planWorkflow } from "./commands/workflow.js";
import { commandHelp, overviewHelp } from "./help.js";
import { createStyle, emptyDocument, renderText, type OutputDocument } from "./output.js";
import { readVersion } from "./version.js";

/**
 * The streams and environment the CLI uses, injectable for tests.
 */
export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  cwd?: string;
  stdinIsTTY?: boolean;
  stdoutIsTTY?: boolean;
  env?: Record<string, string | undefined>;
  runner?: ProcessRunner;
}

const defaultIo: CliIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

/**
 * Prints a document as JSON or text and returns its exit code.
 */
function emit(document: OutputDocument, json: boolean, io: CliIo, target: string): number {
  if (json) {
    io.stdout(`${JSON.stringify(document, null, 2)}\n`);

    return document.exitCode;
  }

  const style = createStyle(Boolean(io.stdoutIsTTY ?? process.stdout.isTTY) && !(io.env ?? process.env).NO_COLOR);
  const text = renderText(document, style, target);
  const onlyErrors = document.status === "error" && document.changes.length === 0;

  (onlyErrors ? io.stderr : io.stdout)(text);

  return document.exitCode;
}

/**
 * Prints argument errors in the requested format.
 */
function argumentErrors(
  diagnostics: Diagnostic[],
  json: boolean,
  io: CliIo,
  version: string,
  command: OutputDocument["command"],
): number {
  if (json) {
    const document = emptyDocument(version, command, false);

    document.status = "error";
    document.exitCode = 1;
    document.diagnostics = diagnostics;
    io.stdout(`${JSON.stringify(document, null, 2)}\n`);

    return 1;
  }

  io.stderr(
    `${diagnostics.map((diagnostic) => `error ${diagnostic.code}: ${diagnostic.message}`).join("\n")}\nRun \`configra --help\` for usage.\n`,
  );

  return 1;
}

/**
 * Runs the CLI with the given arguments and returns the exit code.
 */
export async function run(argv: readonly string[], io: CliIo = defaultIo): Promise<number> {
  const version = readVersion();
  const parsed = parseCliArgs(argv);

  if (!parsed.ok) {
    if (parsed.args.help && !parsed.args.json) {
      io.stdout(parsed.args.command ? commandHelp(parsed.args.command) : overviewHelp(version));

      return 0;
    }

    return argumentErrors(parsed.diagnostics, parsed.args.json ?? false, io, version, parsed.args.command ?? null);
  }

  const { args } = parsed;

  if (args.version) {
    io.stdout(args.json ? `${JSON.stringify({ version: 1, configra: version })}\n` : `${version}\n`);

    return 0;
  }

  if (args.help || !args.command) {
    io.stdout(args.command ? commandHelp(args.command) : overviewHelp(version));

    return 0;
  }

  const interactive = Boolean(io.stdinIsTTY ?? process.stdin.isTTY) && Boolean(io.stdoutIsTTY ?? process.stdout.isTTY);

  const result = planWorkflow(args.command, args, {
    cwd: io.cwd ?? process.cwd(),
    version,
    runner: io.runner ?? systemRunner,
    interactive: interactive && !args.json && !args.dryRun,
  });

  if (args.dryRun || result.document.status === "error" || !result.plan) {
    return emit(result.document, args.json, io, result.target);
  }

  result.document.diagnostics.push({
    code: "APPLY_UNAVAILABLE",
    severity: "error",
    message: "Writing files isn't available in this build yet. Use --dry-run to preview the plan.",
  });

  result.document.status = "error";
  result.document.exitCode = 1;

  return emit(result.document, args.json, io, result.target);
}
