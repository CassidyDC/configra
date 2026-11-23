import type { CommandName } from "../contracts.js";
import { acceptsOption, commands, exitCodes, options, type OptionSpec } from "./options.js";

const width = 32;

/**
 * Formats one option row with its accepted values, default, and option relationships.
 */
function formatOption(option: OptionSpec): string[] {
  const flag = `${option.short ? `-${option.short}, ` : "    "}--${option.name}${option.placeholder ? ` ${option.placeholder}` : ""}`;
  const lines = [`  ${flag.padEnd(width)}${option.description}`];
  const indent = " ".repeat(width + 2);

  if (option.values) {
    lines.push(`${indent}Values: ${option.values.join(", ")}`);
  }

  if (option.defaultText) {
    lines.push(`${indent}Default: ${option.defaultText}`);
  }

  if (option.multiple) {
    lines.push(`${indent}Repeatable.`);
  }

  if (option.conflicts) {
    lines.push(`${indent}Can't be combined with ${option.conflicts.map((name) => `--${name}`).join(" or ")}.`);
  }

  if (option.requires) {
    lines.push(`${indent}Requires ${option.requires.map((name) => `--${name}`).join(" and ")}.`);
  }

  return lines;
}

/**
 * The overview shown by `configra` and `configra --help`.
 */
export function overviewHelp(version: string): string {
  const lines = [
    `Configra ${version}`,
    "Generate editable linting, formatting, and Git hook configuration for Node.js projects and WordPress sites.",
    "",
    "Usage: configra <command> [options]",
    "",
    "Commands:",
    ...commands.map((command) => `  ${command.name.padEnd(width)}${command.summary}`),
    "",
    "Shared options:",
    ...options.filter((option) => option.commands === "all").flatMap(formatOption),
    "",
    "Run `configra <command> --help` for a command's options and examples.",
    "Generated checks need Node.js 24.15 and npm 11 or later, plus PHP 7.4 and Composer 2.7 or later for PHP tools.",
    "",
  ];

  return lines.join("\n");
}

/**
 * The help for one command, listing every option the parser accepts for it.
 */
export function commandHelp(name: CommandName): string {
  const command = commands.find((candidate) => candidate.name === name);

  if (!command) {
    throw new Error(`Unknown command ${name}`);
  }

  const lines = [
    `Usage: configra ${command.name} [options]`,
    "",
    command.summary,
    "",
    ...command.description,
    "",
    "Options:",
    ...options.filter((option) => acceptsOption(option, name)).flatMap(formatOption),
    "",
    "How selections combine:",
    "  Explicit flags override saved selections, and preset defaults fill anything left unset. List flags",
    "  (--languages, --ui, --tools, --package) replace the saved list, and an empty value such as --ui=",
    "  clears it. --standard merges by language, so php=community changes only PHP. Settings that have no",
    "  flag, such as formatting and exclusions, come from the config file. See the selection schema at",
    "  dist/schemas/config.v1.json in the installed package.",
    "",
    "Setup wizard outcomes:",
    "  Save config only     Write .configra/config.json and nothing else.",
    "  Generate files       Save the config and generate the tooling files.",
    "  Generate and install Also install the declared dependencies.",
    "",
    "Exit codes:",
    ...exitCodes.map((entry) => `  ${String(entry.code).padEnd(width)}${entry.description}`),
    "",
    "Examples:",
    ...command.examples.flatMap((example) => [`  # ${example.description}`, `  ${example.command}`]),
    "",
  ];

  return lines.join("\n");
}
