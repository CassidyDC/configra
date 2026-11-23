/**
 * The command and option table. It drives argument parsing, help output, and validation messages.
 */

import type { CommandName } from "../contracts.js";
import { commitMessageModes, languageIds, presetIds, standardIds, toolIds, uiIds } from "../components/registry.js";

export interface OptionSpec {
  name: string;
  short?: string;
  type: "boolean" | "string";
  multiple?: boolean;

  /** The value placeholder shown in help, such as `<path>`. */
  placeholder?: string;

  /** `all` options work with every command and with no command. */
  commands: "all" | CommandName[];
  description: string;

  /** Accepted values, read from the same registry the validator uses. */
  values?: readonly string[];
  defaultText?: string;

  /** Options this one can't be combined with. */
  conflicts?: string[];

  /** Options this one needs. */
  requires?: string[];
}

export interface CommandSpec {
  name: CommandName;
  summary: string;
  description: string[];
  examples: Array<{ command: string; description: string }>;
}

export const commands: CommandSpec[] = [
  {
    name: "init",
    summary: "Set up a new or existing project.",
    description: [
      "In a terminal with no saved config and no selection flags, init opens the setup wizard.",
      "Otherwise it uses saved selections from --config, the flags, and the preset defaults. Without",
      "--project it uses the node preset, or stops and suggests --project wordpress-site when the target",
      "looks like a WordPress site. It stops and points to update when the target already has",
      ".configra/config.json.",
    ],
    examples: [
      {
        command: "configra init --cwd ./site --project wordpress-site --dry-run",
        description: "Report on a site without writing anything",
      },
      { command: "configra init --project node --dry-run --json", description: "Print the generation plan as JSON" },
      {
        command:
          "configra init --project wordpress-site --package wp-content/plugins/example --package wp-content/themes/example",
        description: "Set up a WordPress site that checks one plugin and one theme",
      },
    ],
  },
  {
    name: "update",
    summary: "Reapply or change an existing setup, or apply saved selections on a fresh checkout.",
    description: [
      "Requires .configra/config.json at the target root. Flags change the saved selections, and the",
      "result is saved back to the config. Rerun with --install to retry dependency installation.",
    ],
    examples: [
      { command: "configra update --dry-run --exit-code", description: "Fail in CI when generated files have drifted" },
      { command: "configra update --install", description: "Apply saved selections and install dependencies" },
      { command: "configra update --tools=editorconfig,gitignore,prettier", description: "Replace the tool list" },
    ],
  },
];

const workflow: CommandName[] = ["init", "update"];

export const options: OptionSpec[] = [
  { name: "help", short: "h", type: "boolean", commands: "all", description: "Show the overview or command help." },
  {
    name: "version",
    short: "v",
    type: "boolean",
    commands: "all",
    description: "Print the installed Configra version.",
  },
  {
    name: "cwd",
    type: "string",
    placeholder: "<path>",
    commands: "all",
    description: "Target an existing directory. Relative paths resolve from the current directory.",
    defaultText: "the current directory",
  },
  {
    name: "json",
    type: "boolean",
    commands: "all",
    description: "Print one versioned JSON result on stdout and suppress prompts.",
    conflicts: ["interactive"],
  },
  {
    name: "config",
    type: "string",
    placeholder: "<file>",
    commands: workflow,
    description: "Read selections from a JSON file and save the result as the project's config.",
    defaultText: ".configra/config.json under the target, when present",
  },
  {
    name: "project",
    type: "string",
    placeholder: "<id>",
    commands: workflow,
    description: "Choose the project preset.",
    values: presetIds,
  },
  {
    name: "package",
    type: "string",
    multiple: true,
    placeholder: "<path>",
    commands: workflow,
    description: "Select a plugin or theme directory, relative to the target. Repeat for more.",
  },
  {
    name: "languages",
    type: "string",
    placeholder: "<ids>",
    commands: workflow,
    description: "Set the comma-separated language list. Pass --languages= to clear it.",
    values: languageIds,
    defaultText: "the preset's languages",
  },
  {
    name: "ui",
    type: "string",
    placeholder: "<ids>",
    commands: workflow,
    description: "Set the comma-separated UI list. Pass --ui= to clear it.",
    values: uiIds,
    defaultText: "none",
  },
  {
    name: "standard",
    type: "string",
    multiple: true,
    placeholder: "<language>=<id>",
    commands: workflow,
    description: "Override the coding standard for one language, such as php=wordpress. Repeat for more.",
    values: standardIds,
    defaultText: "the preset's standard",
  },
  {
    name: "tools",
    type: "string",
    placeholder: "<ids>",
    commands: workflow,
    description: "Set the comma-separated tool list.",
    values: toolIds,
    defaultText: "the universal tools plus the tools for the selected languages",
  },
  {
    name: "commit-messages",
    type: "string",
    placeholder: "<mode>",
    commands: workflow,
    description: "Check commit subjects as plain sentences, Conventional Commits, or not at all.",
    values: commitMessageModes,
    defaultText: "plain",
  },
  {
    name: "interactive",
    type: "boolean",
    commands: workflow,
    description: "Open the setup wizard with saved selections and flags prefilled. Needs a terminal.",
    conflicts: ["dry-run", "json"],
  },
  {
    name: "yes",
    type: "boolean",
    commands: workflow,
    description:
      "Approve the preview without prompting. Unsettled conflicts still stop the run unless --on-conflict is passed.",
  },
  {
    name: "on-conflict",
    type: "string",
    placeholder: "<action>",
    commands: workflow,
    description:
      "Settle every conflict without prompting. retain keeps the existing content and records the decision; replace overwrites it and takes ownership.",
    values: ["retain", "replace"],
  },
  {
    name: "dry-run",
    type: "boolean",
    commands: workflow,
    description:
      "Preview changes, conflicts, and commands without writing anything. Also reports detected languages, UI, candidate directories, and prerequisites.",
  },
  {
    name: "exit-code",
    type: "boolean",
    commands: workflow,
    description: "With --dry-run, exit with code 3 when the plan has changes or conflicts.",
    requires: ["dry-run"],
  },
  {
    name: "install",
    type: "boolean",
    commands: workflow,
    description: "Install the declared dependencies after generating files.",
  },
  {
    name: "install-hooks",
    type: "boolean",
    commands: workflow,
    description: "Activate the Git hooks. Needs a Git repository and an available Lefthook binary.",
  },
];

export const exitCodes: Array<{ code: number; description: string }> = [
  { code: 0, description: "Success, including a dry run that found changes without --exit-code." },
  { code: 1, description: "Argument, validation, or execution failure." },
  { code: 2, description: "Unresolved conflicts blocked the run." },
  { code: 3, description: "--dry-run --exit-code found pending changes or conflicts." },
  { code: 130, description: "The run was interrupted or canceled before writing, including a declined approval." },
];

/**
 * Returns whether a command accepts an option.
 */
export function acceptsOption(option: OptionSpec, command: CommandName | undefined): boolean {
  if (option.commands === "all") {
    return true;
  }

  return command !== undefined && option.commands.includes(command);
}
