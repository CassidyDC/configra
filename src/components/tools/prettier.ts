import type { FormatSettings, ResolvedSettings } from "../../contracts.js";
import { emptyContribution, isScoped, managedHeader, npmDependency, styleJs } from "./shared.js";
import type { ToolDefinition } from "./types.js";

const competingFiles = [
  ".prettierrc",
  ".prettierrc.json",
  ".prettierrc.json5",
  ".prettierrc.yaml",
  ".prettierrc.yml",
  ".prettierrc.toml",
  ".prettierrc.js",
  ".prettierrc.mjs",
  ".prettierrc.cjs",
  ".prettierrc.ts",
  ".prettierrc.mts",
  ".prettierrc.cts",
  "prettier.config.js",
  "prettier.config.mjs",
  "prettier.config.cjs",
  "prettier.config.ts",
  "prettier.config.mts",
  "prettier.config.cts",
];

/**
 * Maps the shared formatting settings to Prettier option names.
 */
function prettierOptions(formatting: Partial<FormatSettings>): Record<string, unknown> {
  const options: Record<string, unknown> = {};

  if (formatting.lineWidth !== undefined) options.printWidth = formatting.lineWidth;
  if (formatting.indentSize !== undefined) options.tabWidth = formatting.indentSize;
  if (formatting.indentStyle !== undefined) options.useTabs = formatting.indentStyle === "tab";
  if (formatting.endOfLine !== undefined) options.endOfLine = formatting.endOfLine;
  if (formatting.quoteStyle !== undefined) options.singleQuote = formatting.quoteStyle === "single";
  if (formatting.semicolons !== undefined) options.semi = formatting.semicolons;
  if (formatting.trailingCommas !== undefined) options.trailingComma = formatting.trailingCommas;
  if (formatting.bracketSpacing !== undefined) options.bracketSpacing = formatting.bracketSpacing;

  return options;
}

/**
 * In a WordPress site, lists what Prettier checks: the site's own root files, without core's
 * `readme.html` or PHP, and everything in the selected directories. Elsewhere, Prettier checks the whole
 * project, so this returns undefined.
 */
function formatTargets(settings: ResolvedSettings): string[] | undefined {
  if (!isScoped(settings)) {
    return undefined;
  }

  return [
    "*.{js,mjs,cjs,ts,mts,cts,json,md,yml,yaml}",
    ...settings.scopePrefixes.filter((prefix) => prefix !== "").map((prefix) => `${prefix}*`),
    ...settings.scopeFiles,
  ];
}

/**
 * Renders `.configra/prettier.mjs`.
 */
function renderConfigraFile(settings: ResolvedSettings, entryFile: string): string {
  const header = `// ${managedHeader(entryFile)}\n`;

  if (settings.formattingStandard === "wordpress") {
    // The WordPress preset already matches the WordPress formatting defaults, so only explicit overrides follow it.
    const overrides = Object.entries(prettierOptions(settings.selections.formatting))
      .map(([key, value]) => `  ${key}: ${JSON.stringify(value)},\n`)
      .join("");

    return [
      header,
      'import wordpress from "@wordpress/prettier-config";',
      "",
      '/** @type {import("prettier").Config} */',
      `export default {\n  ...wordpress,\n${overrides}};\n`,
    ].join("\n");
  }

  const options = Object.entries(prettierOptions(settings.formatting))
    .map(([key, value]) => `  ${key}: ${JSON.stringify(value)},\n`)
    .join("");

  return [header, '/** @type {import("prettier").Config} */', `export default {\n${options}};\n`].join("\n");
}

/**
 * Renders the project-owned entry file, created once.
 */
function renderEntryFile(): string {
  return [
    "/**",
    " * Prettier configuration.",
    " *",
    " * Configra manages .configra/prettier.mjs and keeps it in sync with .editorconfig. Add your own",
    " * options after the spread; they override Configra's.",
    " *",
    " * @see https://prettier.io/docs/configuration",
    " */",
    "",
    'import configra from "./.configra/prettier.mjs";',
    "",
    '/** @type {import("prettier").Config} */',
    "export default {",
    "  ...configra,",
    "  // printWidth: 100,",
    "};",
    "",
  ].join("\n");
}

export const prettierTool: ToolDefinition = {
  id: "prettier",
  label: "Prettier",
  description: "Formats JavaScript, TypeScript, CSS, JSON, Markdown, YAML, and the other file types it supports.",
  languages: [],
  available: true,
  checks: (settings) => {
    const targets = formatTargets(settings);
    const options = targets
      ? ["--ignore-unknown", "--no-error-on-unmatched-pattern"]
      : ["--no-error-on-unmatched-pattern"];

    return [
      {
        id: "prettier",
        tool: "prettier",
        script: "format:check",
        command: { executable: "prettier", args: ["--check", ...options, ...(targets ?? ["."])] },
        fixCommand: { executable: "prettier", args: ["--write", ...options, ...(targets ?? ["."])] },
        hook: "pre-commit",
        extensions: [],
        ...(targets ? { globs: targets } : {}),
        stagedArgs: ["--check", "--ignore-unknown", "--no-error-on-unmatched-pattern"],
        usesStagedFiles: true,
        aggregate: "format",
      },
    ];
  },
  render: (settings) => {
    const contribution = emptyContribution();
    const entryFile = `prettier.config${settings.configExtension}`;

    contribution.files.push(
      {
        tool: "prettier",
        path: ".configra/prettier.mjs",
        ownership: "file",
        content: renderConfigraFile(settings, entryFile),
        reason: "Prettier options derived from the formatting settings",
      },
      {
        tool: "prettier",
        path: entryFile,
        ownership: "entry",
        content: styleJs(renderEntryFile(), settings.formatting),
        reason: "Project Prettier entry file that loads .configra/prettier.mjs",
        reference: "./.configra/prettier.mjs",
      },
    );

    contribution.lines.push({
      tool: "prettier",
      path: ".prettierignore",
      // Configra-owned lefthook.yml sits outside .configra/, so it's ignored like the rest of Configra's files.
      lines: [
        ...settings.exclusions,
        "package-lock.json",
        "composer.lock",
        ...(settings.selections.tools.includes("lefthook") ? ["lefthook.yml"] : []),
      ],
      reason: "Keep excluded directories, minified files, and lockfiles out of formatting",
    });

    contribution.fields.push(npmDependency("prettier", "prettier", settings.npmRange("prettier")));

    if (settings.formattingStandard === "wordpress") {
      contribution.fields.push(
        npmDependency(
          "prettier",
          "@wordpress/prettier-config",
          settings.npmRange("@wordpress/prettier-config", "wordpress"),
        ),
      );
    }

    contribution.competing.push(
      ...competingFiles.filter((path) => path !== entryFile).map((path) => ({ tool: "prettier" as const, path })),
      { tool: "prettier", path: "package.json", field: ["prettier"] },
    );

    return contribution;
  },
};
