import type { ResolvedCheck, ResolvedSettings } from "../../contracts.js";
import {
  emptyContribution,
  exclusionGlobs,
  jsArray,
  configraFile,
  managedHeader,
  npmDependency,
  scopeGlobs,
  styleJs,
} from "./shared.js";
import type { ToolDefinition } from "./types.js";

const competingFiles = [
  "stylelint.config.js",
  "stylelint.config.mjs",
  "stylelint.config.cjs",
  "stylelint.config.ts",
  "stylelint.config.mts",
  "stylelint.config.cts",
  ".stylelintrc",
  ".stylelintrc.js",
  ".stylelintrc.mjs",
  ".stylelintrc.cjs",
  ".stylelintrc.json",
  ".stylelintrc.yaml",
  ".stylelintrc.yml",
];

/**
 * The CSS files the full check covers, as globs Stylelint expands itself.
 */
function cssGlobs(settings: ResolvedSettings): string[] {
  return scopeGlobs(settings, settings.extensions.css ?? []);
}

/**
 * Renders the Configra-owned config. The entry file spreads it, so `ignoreFiles` keeps applying.
 */
function renderConfig(settings: ResolvedSettings, entryFile: string): string {
  const preset =
    settings.selections.standards.css === "wordpress" ? "@wordpress/stylelint-config" : "stylelint-config-standard";

  return [
    `// ${managedHeader(entryFile)}`,
    "",
    '/** @type {import("stylelint").Config} */',
    "export default {",
    `  extends: [${JSON.stringify(preset)}],`,
    `  ignoreFiles: ${jsArray(exclusionGlobs(settings))},`,
    "  rules: {},",
    "};",
    "",
  ].join("\n");
}

/**
 * Renders the project-owned entry file, created once.
 */
function renderEntryFile(managed: string): string {
  return [
    "/**",
    " * Stylelint configuration.",
    " *",
    ` * Configra manages ${managed}. Add your own rules inside \`rules\` after the spread; they`,
    " * override Configra's. Spreading the file, instead of extending it, keeps its `ignoreFiles` in effect.",
    " *",
    " * @see https://stylelint.io/user-guide/configure",
    " */",
    "",
    `import configra from "./${managed}";`,
    "",
    '/** @type {import("stylelint").Config} */',
    "export default {",
    "  ...configra,",
    "  rules: {",
    "    ...configra.rules,",
    '    // "selector-class-pattern": null,',
    "  },",
    "};",
    "",
  ].join("\n");
}

export const stylelintTool: ToolDefinition = {
  id: "stylelint",
  label: "Stylelint",
  description: "Lints CSS.",
  languages: ["css"],
  available: true,
  checks: (settings): ResolvedCheck[] => {
    const globs = cssGlobs(settings);

    return [
      {
        id: "stylelint",
        tool: "stylelint",
        script: "lint:css",
        command: { executable: "stylelint", args: ["--allow-empty-input", ...globs] },
        fixCommand: { executable: "stylelint", args: ["--allow-empty-input", "--fix", ...globs] },
        hook: "pre-commit",
        extensions: settings.extensions.css ?? [],
        stagedArgs: ["--allow-empty-input"],
        usesStagedFiles: true,
        aggregate: "lint",
      },
    ];
  },
  render: (settings) => {
    const contribution = emptyContribution();
    const managed = configraFile(settings, "stylelint");
    const entryFile = `stylelint.config${settings.configExtension}`;
    const standard = settings.selections.standards.css ?? "community";

    contribution.files.push(
      {
        tool: "stylelint",
        path: managed,
        ownership: "file",
        content: styleJs(renderConfig(settings, entryFile), settings.formatting),
        reason: `Stylelint rules for the ${standard} standard`,
      },
      {
        tool: "stylelint",
        path: entryFile,
        ownership: "entry",
        content: styleJs(renderEntryFile(managed), settings.formatting),
        reason: `Project Stylelint entry file that loads ${managed}`,
        reference: `./${managed}`,
      },
    );

    const dependencies =
      standard === "wordpress"
        ? ["stylelint", "@wordpress/stylelint-config", "stylelint-scss"]
        : ["stylelint", "stylelint-config-standard"];

    contribution.fields.push(
      ...dependencies.map((name) => npmDependency("stylelint", name, settings.npmRange(name, standard))),
    );

    contribution.competing.push(
      ...competingFiles.filter((path) => path !== entryFile).map((path) => ({ tool: "stylelint" as const, path })),
      { tool: "stylelint", path: "package.json", field: ["stylelint"] },
    );

    return contribution;
  },
};
