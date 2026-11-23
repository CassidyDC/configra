import { parseArgs } from "node:util";
import type { CommandName, Diagnostic } from "../contracts.js";
import { acceptsOption, commands, options } from "./options.js";

/**
 * Parsed command-line arguments before selection validation. List values are `[]` when passed empty.
 */
export interface ParsedArgs {
  command: CommandName | undefined;
  help: boolean;
  version: boolean;
  json: boolean;
  cwd?: string;
  config?: string;
  project?: string;
  packages?: string[];
  languages?: string[];
  ui?: string[];
  standards?: string[];
  tools?: string[];
  commitMessages?: string;
  interactive: boolean;
  yes: boolean;
  onConflict?: string;
  dryRun: boolean;
  exitCode: boolean;
  install: boolean;
  installHooks: boolean;

  /** True when any flag selects what to generate, which skips the automatic wizard. */
  hasSelectionFlags: boolean;
}

export type ParseResult =
  { ok: true; args: ParsedArgs } | { ok: false; args: Partial<ParsedArgs>; diagnostics: Diagnostic[] };

const selectionFlags = ["project", "package", "languages", "ui", "standard", "tools", "commit-messages"];

/**
 * Splits a comma-separated list. An empty value is an explicit empty list.
 */
function splitList(value: string | undefined): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

/**
 * Converts a `parseArgs` error into a stable diagnostic.
 */
function parseError(error: unknown): Diagnostic {
  const err = error as { code?: string; message?: string };
  const message = err.message ?? String(error);

  const code =
    err.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION"
      ? "ARG_UNKNOWN_OPTION"
      : err.code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE"
        ? "ARG_INVALID_OPTION_VALUE"
        : err.code === "ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL"
          ? "ARG_UNEXPECTED_ARGUMENT"
          : "ARG_INVALID";

  return { code, severity: "error", message: message.replace(/\. To specify a positional argument.*$/s, ".") };
}

/**
 * Parses the arguments against the option table and checks command availability, conflicts, and requirements.
 */
export function parseCliArgs(argv: readonly string[]): ParseResult {
  const config = Object.fromEntries(
    options.map((option) => [
      option.name,
      { type: option.type, multiple: option.multiple ?? false, ...(option.short ? { short: option.short } : {}) },
    ]),
  );

  let parsed: ReturnType<typeof parseArgs<{ options: typeof config; allowPositionals: true; strict: true }>>;

  try {
    parsed = parseArgs({ args: [...argv], options: config, allowPositionals: true, strict: true });
  } catch (error) {
    const json = argv.includes("--json");

    return { ok: false, args: { json }, diagnostics: [parseError(error)] };
  }

  const values = parsed.values as Record<string, string | boolean | string[] | undefined>;
  const diagnostics: Diagnostic[] = [];
  const [first, ...rest] = parsed.positionals;
  let command: CommandName | undefined;

  if (first !== undefined) {
    const known = commands.find((candidate) => candidate.name === first);

    if (known) {
      command = known.name;
    } else {
      diagnostics.push({
        code: "ARG_UNKNOWN_COMMAND",
        severity: "error",
        message: `Unknown command "${first}". Use ${commands.map((candidate) => candidate.name).join(" or ")}.`,
      });
    }
  }

  if (rest.length > 0) {
    diagnostics.push({
      code: "ARG_UNEXPECTED_ARGUMENT",
      severity: "error",
      message: `Unexpected argument "${rest[0]}".`,
    });
  }

  const given = options.filter((option) => values[option.name] !== undefined && values[option.name] !== false);
  const reportedConflicts = new Set<string>();

  for (const option of given) {
    if (!acceptsOption(option, command)) {
      diagnostics.push({
        code: "ARG_OPTION_NOT_SUPPORTED",
        severity: "error",
        message: command
          ? `--${option.name} isn't supported by ${command}.`
          : `--${option.name} needs a command: init or update.`,
      });
    }

    for (const other of option.conflicts ?? []) {
      const pair = [option.name, other].sort().join(" ");

      if (given.some((candidate) => candidate.name === other) && !reportedConflicts.has(pair)) {
        reportedConflicts.add(pair);
        diagnostics.push({
          code: "ARG_CONFLICT",
          severity: "error",
          message: `--${option.name} can't be combined with --${other}.`,
        });
      }
    }

    for (const required of option.requires ?? []) {
      if (!given.some((candidate) => candidate.name === required)) {
        diagnostics.push({
          code: "ARG_REQUIRES",
          severity: "error",
          message: `--${option.name} requires --${required}.`,
        });
      }
    }

    if (
      option.values &&
      option.type === "string" &&
      !option.multiple &&
      option.name !== "languages" &&
      option.name !== "ui" &&
      option.name !== "tools"
    ) {
      const value = values[option.name] as string;

      if (!option.values.includes(value)) {
        diagnostics.push({
          code: "ARG_INVALID_VALUE",
          severity: "error",
          message: `--${option.name} must be one of ${option.values.join(", ")}, not "${value}".`,
        });
      }
    }
  }

  const str = (name: string) => values[name] as string | undefined;
  const bool = (name: string) => values[name] === true;
  const list = (name: string) => values[name] as string[] | undefined;

  const args: ParsedArgs = {
    command,
    help: bool("help"),
    version: bool("version"),
    json: bool("json"),
    interactive: bool("interactive"),
    yes: bool("yes"),
    dryRun: bool("dry-run"),
    exitCode: bool("exit-code"),
    install: bool("install"),
    installHooks: bool("install-hooks"),
    hasSelectionFlags: given.some((option) => selectionFlags.includes(option.name)),
  };

  const assign = <K extends keyof ParsedArgs>(key: K, value: ParsedArgs[K] | undefined) => {
    if (value !== undefined) {
      args[key] = value;
    }
  };

  assign("cwd", str("cwd"));
  assign("config", str("config"));
  assign("project", str("project"));
  assign("packages", list("package"));
  assign("languages", splitList(str("languages")));
  assign("ui", splitList(str("ui")));
  assign("standards", list("standard"));
  assign("tools", splitList(str("tools")));
  assign("commitMessages", str("commit-messages"));
  assign("onConflict", str("on-conflict"));

  return diagnostics.length > 0 ? { ok: false, args, diagnostics } : { ok: true, args };
}
