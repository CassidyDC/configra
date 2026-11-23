import type { Diagnostic } from "../contracts.js";
import type { ApplyHooks } from "../generator/apply.js";
import { systemRunner, type ProcessRunner } from "../platform/process.js";
import { parseCliArgs } from "./args.js";
import { applyWorkflow, planWorkflow } from "./commands/workflow.js";
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

  /** Test hooks for the apply phase. */
  applyHooks?: ApplyHooks;
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

  const { document } = result;

  if (args.dryRun || document.status === "error" || !result.plan) {
    return emit(document, args.json, io, result.target);
  }

  const blocked = (diagnostic: Diagnostic, exitCode: number) => {
    document.diagnostics.push(diagnostic);
    document.status = exitCode === 2 ? "conflicts" : "error";
    document.exitCode = exitCode;

    return emit(document, args.json, io, result.target);
  };

  if (result.plan.conflicts.some((conflict) => !conflict.decision)) {
    return blocked(
      {
        code: "APPLY_CONFLICTS_UNRESOLVED",
        severity: "error",
        message: "Configra wrote nothing because conflicts need decisions. Pass --on-conflict retain or replace.",
      },
      2,
    );
  }

  if (interactive && !args.json && !args.yes) {
    return blocked(
      {
        code: "APPLY_APPROVAL_REQUIRED",
        severity: "error",
        message: "Review the preview, then pass --yes to approve it. Approval prompts arrive in a later build.",
      },
      1,
    );
  }

  applyWorkflow(args, result, io.runner ?? systemRunner, io.applyHooks);

  return emit(document, args.json, io, result.target);
}
