import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CommandName, Diagnostic } from "../contracts.js";
import type { ApplyHooks } from "../generator/apply.js";
import { configPath } from "../generator/plan.js";
import { systemRunner, type ProcessRunner } from "../platform/process.js";
import { parseCliArgs, type ParsedArgs } from "./args.js";
import {
  applyWorkflow,
  planWorkflow,
  type ApplyOptions,
  type PlannedWorkflow,
  type WorkflowEnvironment,
} from "./commands/workflow.js";
import { commandHelp, overviewHelp } from "./help.js";
import { createStyle, emptyDocument, renderOutcome, renderText, type OutputDocument, type Style } from "./output.js";
import { approve, settleConflicts, unresolvedConflicts } from "./prompts/approval.js";
import { canceled, terminalPrompter, type Prompter } from "./prompts/prompter.js";
import { runWizard } from "./prompts/wizard.js";
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

  /** Answers terminal prompts. Defaults to the clack prompts. */
  prompter?: Prompter;

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

  const text = renderText(document, styleFor(io), target);
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

  const terminal = Boolean(io.stdinIsTTY ?? process.stdin.isTTY) && Boolean(io.stdoutIsTTY ?? process.stdout.isTTY);

  if (args.interactive && !terminal) {
    return argumentErrors(
      [
        {
          code: "ARG_INTERACTIVE_NO_TERMINAL",
          severity: "error",
          message: "--interactive needs a terminal for standard input and output.",
        },
      ],
      args.json,
      io,
      version,
      args.command,
    );
  }

  const prompting = terminal && !args.json && !args.dryRun;

  const environment: WorkflowEnvironment = {
    cwd: io.cwd ?? process.cwd(),
    version,
    runner: io.runner ?? systemRunner,
    interactive: prompting,
  };

  const session: TerminalSession = {
    io,
    args: { ...args, command: args.command },
    environment,
    prompter: io.prompter ?? terminalPrompter,
    style: styleFor(io),
  };

  if (prompting && wantsWizard(args, environment.cwd)) {
    return wizardRun(session);
  }

  const result = planWorkflow(args.command, args, environment);
  const { document } = result;

  if (args.dryRun || document.status === "error" || !result.plan) {
    return emit(document, args.json, io, result.target);
  }

  if (prompting && !args.yes) {
    return approvedRun(session, result);
  }

  if (result.plan.conflicts.some((conflict) => !conflict.decision)) {
    return blocked(document, unresolvedDiagnostic, 2, args.json, io, result.target);
  }

  applyWorkflow(args, result, environment.runner, applyOptions(io));

  return emit(document, args.json, io, result.target);
}

const unresolvedDiagnostic: Diagnostic = {
  code: "APPLY_CONFLICTS_UNRESOLVED",
  severity: "error",
  message: "Configra wrote nothing because conflicts need decisions. Pass --on-conflict retain or replace.",
};

/**
 * A workflow run in a terminal, where Configra can prompt.
 */
interface TerminalSession {
  io: CliIo;
  args: ParsedArgs & { command: CommandName };
  environment: WorkflowEnvironment;
  prompter: Prompter;
  style: Style;
}

/**
 * Returns the text style for the CLI's stdout.
 */
function styleFor(io: CliIo): Style {
  return createStyle(Boolean(io.stdoutIsTTY ?? process.stdout.isTTY) && !(io.env ?? process.env).NO_COLOR);
}

/**
 * Returns the apply options for the CLI's test hooks.
 */
function applyOptions(io: CliIo, saveOnly = false): ApplyOptions {
  return { saveOnly, ...(io.applyHooks ? { hooks: io.applyHooks } : {}) };
}

/**
 * Blocks a run with a diagnostic and prints the document.
 */
function blocked(
  document: OutputDocument,
  diagnostic: Diagnostic,
  exitCode: number,
  json: boolean,
  io: CliIo,
  target: string,
): number {
  document.diagnostics.push(diagnostic);
  document.status = exitCode === 2 ? "conflicts" : "error";
  document.exitCode = exitCode;

  return emit(document, json, io, target);
}

/**
 * Returns whether a terminal run opens the setup wizard: `--interactive`, or `init` with no saved config,
 * no --config file, and no selection flags.
 */
function wantsWizard(args: ParsedArgs, cwd: string): boolean {
  if (args.interactive) {
    return true;
  }

  return (
    args.command === "init" &&
    args.config === undefined &&
    !args.hasSelectionFlags &&
    !existsSync(join(resolve(cwd, args.cwd ?? "."), configPath))
  );
}

/**
 * Reports a canceled run, which leaves the project untouched.
 */
function canceledRun(session: TerminalSession): number {
  session.io.stdout("Canceled. Configra wrote nothing.\n");

  return 130;
}

/**
 * Applies an approved run and prints what each phase did, without repeating the approved preview.
 */
function finishRun(session: TerminalSession, planned: PlannedWorkflow, args: ParsedArgs, saveOnly = false): number {
  const { io } = session;
  const { document } = planned;

  applyWorkflow(args, planned, session.environment.runner, applyOptions(io, saveOnly));
  (document.status === "error" ? io.stderr : io.stdout)(renderOutcome(document, session.style));

  return document.exitCode;
}

/**
 * Shows a flag run's preview in the terminal, asks about each conflict, and asks for approval.
 */
async function approvedRun(session: TerminalSession, result: PlannedWorkflow): Promise<number> {
  const { io, args, environment, prompter, style } = session;
  const target = result.target;
  let planned = result;

  io.stdout(renderText(planned.document, style, target, "prompts"));

  if (unresolvedConflicts(planned).length > 0) {
    const settled = await settleConflicts(prompter, planned, (decisions) =>
      planWorkflow(args.command, args, { ...environment, decisions }),
    );

    if (settled === canceled) {
      return canceledRun(session);
    }

    planned = settled;

    if (planned.document.status === "error") {
      return emit(planned.document, false, io, target);
    }

    if (unresolvedConflicts(planned).length > 0) {
      return blocked(planned.document, unresolvedDiagnostic, 2, false, io, target);
    }

    io.stdout(renderText(planned.document, style, target, "prompts"));
  }

  const hasWork = planned.document.changes.length > 0 || args.install || args.installHooks;

  if (hasWork && !(await approve(prompter))) {
    return canceledRun(session);
  }

  return finishRun(session, planned, args);
}

/**
 * Runs the setup wizard and applies the outcome it approves.
 */
async function wizardRun(session: TerminalSession): Promise<number> {
  const { io, args, environment, prompter, style } = session;

  const result = await runWizard({
    prompter,
    command: args.command,
    args,
    environment,
    print: io.stdout,
    style,
  });

  if (result.kind === "canceled") {
    prompter.outro("Canceled. Configra wrote nothing.");

    return 130;
  }

  if (result.kind === "stopped") {
    prompter.outro("Configra wrote nothing.");

    return 1;
  }

  if (result.kind === "failed") {
    return emit(result.planned.document, false, io, result.planned.target);
  }

  const code = finishRun(session, result.planned, result.args, result.outcome === "save");

  if (code === 0) {
    prompter.outro(
      result.outcome === "save"
        ? "Saved .configra/config.json. Run `configra update` to generate the files."
        : "Configra set up the project.",
    );
  }

  return code;
}
