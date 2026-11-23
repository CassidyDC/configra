import { readFileSync } from "node:fs";
import type { ResolvedCheck, ResolvedSettings } from "../../contracts.js";
import { emptyContribution, exclusionGlobs, npmDependency, quoteArg } from "./shared.js";
import type { ToolDefinition } from "./types.js";

const projectFile = "lefthook-project.yml";
const commitMessageScript = ".configra/scripts/commit-msg.mjs";

const competingFiles = [
  "lefthook.yaml",
  "lefthook.json",
  "lefthook.jsonc",
  "lefthook.toml",
  ".lefthook.yml",
  ".lefthook.yaml",
  ".lefthook.json",
  ".lefthook.jsonc",
  ".lefthook.toml",
  ".config/lefthook.yml",
  ".config/lefthook.yaml",
];

/**
 * Builds the staged-file glob for a check, matching at any depth with Lefthook's doublestar matcher.
 */
function stagedGlobs(settings: ResolvedSettings, extensions: string[]): string[] {
  if (extensions.length === 0) {
    return [];
  }

  const suffix = extensions.length === 1 ? `*.${extensions[0]}` : `*.{${extensions.join(",")}}`;

  return settings.scopePrefixes.map((prefix) => `${prefix === "" ? "" : prefix}${suffix}`);
}

/**
 * Renders one hook command. `npx --no` runs the project's installed binary without downloading anything.
 */
function renderHookCommand(settings: ResolvedSettings, check: ResolvedCheck): string[] {
  const args = check.usesStagedFiles ? [...(check.stagedArgs ?? []), "{staged_files}"] : check.command.args;
  const run = ["npx", "--no", "--", check.command.executable, ...args].map((arg) =>
    arg === "{staged_files}" ? arg : quoteArg(arg),
  );
  const lines = [`    ${check.id}:`];
  const globs = stagedGlobs(settings, check.extensions);

  if (check.usesStagedFiles && globs.length > 0) {
    lines.push("      glob:", ...globs.map((glob) => `        - ${JSON.stringify(glob)}`));
  }

  if (check.usesStagedFiles) {
    lines.push("      exclude:", ...exclusionGlobs(settings).map((glob) => `        - ${JSON.stringify(glob)}`));
  }

  lines.push(`      run: ${run.join(" ")}`);

  return lines;
}

/**
 * Summarizes the generated hooks for previews and the JSON plan.
 */
export function hookSummary(
  settings: ResolvedSettings,
  checks: ResolvedCheck[],
): Array<{ hook: string; name: string; run: string }> {
  const hooks = checks
    .filter((check) => check.hook !== undefined)
    .map((check) => ({
      hook: check.hook as string,
      name: check.id,
      run: (renderHookCommand(settings, check).at(-1) as string).replace(/^\s*run: /, ""),
    }));

  if (settings.selections.tools.includes("lefthook") && settings.selections.commitMessages !== "off") {
    hooks.push({
      hook: "commit-msg",
      name: "commit-message",
      run: `node ${commitMessageScript} --mode ${settings.selections.commitMessages} {1}`,
    });
  }

  return settings.selections.tools.includes("lefthook") ? hooks : [];
}

/**
 * Renders the Configra-owned `lefthook.yml`. It extends the project file, whose settings win.
 */
function renderLefthookFile(settings: ResolvedSettings, checks: ResolvedCheck[]): string {
  const lines = [
    `# Managed by Configra. Put your changes in ${projectFile}, which overrides this file.`,
    "# Put personal overrides in lefthook-local.yml, which overrides both.",
    "# Activate the hooks with `npx lefthook install`. See https://lefthook.dev/configuration/",
    "",
    "glob_matcher: doublestar",
    "",
    "extends:",
    `  - ${projectFile}`,
  ];

  for (const hook of ["pre-commit", "pre-push"] as const) {
    const hookChecks = checks.filter((check) => check.hook === hook);

    if (hookChecks.length === 0) {
      continue;
    }

    lines.push("", `${hook}:`);

    if (hook === "pre-commit") {
      lines.push("  parallel: true");
    }

    lines.push("  commands:");

    for (const check of hookChecks) {
      lines.push(...renderHookCommand(settings, check));
    }
  }

  const mode = settings.selections.commitMessages;

  if (mode !== "off") {
    lines.push(
      "",
      "commit-msg:",
      "  commands:",
      "    commit-message:",
      `      run: node ${commitMessageScript} --mode ${mode} {1}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

/**
 * Renders the project-owned hook settings file, created once.
 */
function renderProjectFile(): string {
  return [
    "# Project Git hook settings. Configra created this file once and never changes it.",
    "# Settings here override lefthook.yml, which Configra manages. See https://lefthook.dev/configuration/",
    "#",
    "# pre-commit:",
    "#   commands:",
    "#     eslint:",
    "#       skip: true",
    "",
  ].join("\n");
}

export const lefthookTool: ToolDefinition = {
  id: "lefthook",
  label: "Lefthook",
  description: "Git hooks that run read-only checks on staged files and validate commit messages.",
  languages: [],
  available: true,
  checks: () => [],
  render: (settings, checks) => {
    const contribution = emptyContribution();

    contribution.files.push(
      {
        tool: "lefthook",
        path: "lefthook.yml",
        ownership: "file",
        content: renderLefthookFile(settings, checks),
        reason: "Git hooks for the selected checks",
      },
      {
        tool: "lefthook",
        path: projectFile,
        ownership: "entry",
        content: renderProjectFile(),
        reason: "Project hook settings that override lefthook.yml",
      },
    );

    if (settings.selections.commitMessages !== "off") {
      contribution.files.push({
        tool: "lefthook",
        path: commitMessageScript,
        ownership: "file",
        content: readFileSync(new URL("./assets/commit-msg.mjs", import.meta.url), "utf8"),
        reason: `Commit-message check for ${settings.selections.commitMessages} subjects`,
        executable: true,
      });
    }

    contribution.fields.push(npmDependency("lefthook", "lefthook", settings.npmRange("lefthook")));
    contribution.competing.push(...competingFiles.map((path) => ({ tool: "lefthook" as const, path })));

    return contribution;
  },
};
