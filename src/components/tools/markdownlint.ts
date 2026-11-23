import type { ResolvedSettings } from "../../contracts.js";
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

const entryFile = ".markdownlint-cli2.mjs";

/**
 * Rules that overlap with Prettier's Markdown formatting, from markdownlint's own `style/prettier` preset.
 */
const prettierOverlap = [
  "blanks-around-fences",
  "blanks-around-headings",
  "blanks-around-lists",
  "code-fence-style",
  "emphasis-style",
  "heading-start-left",
  "heading-style",
  "hr-style",
  "line-length",
  "list-indent",
  "list-marker-space",
  "no-blanks-blockquote",
  "no-hard-tabs",
  "no-missing-space-atx",
  "no-missing-space-closed-atx",
  "no-multiple-blanks",
  "no-multiple-space-atx",
  "no-multiple-space-blockquote",
  "no-multiple-space-closed-atx",
  "no-trailing-spaces",
  "ol-prefix",
  "strong-style",
  "ul-indent",
];

const competingFiles = [
  ".markdownlint-cli2.jsonc",
  ".markdownlint-cli2.yaml",
  ".markdownlint-cli2.cjs",
  ".markdownlint.jsonc",
  ".markdownlint.json",
  ".markdownlint.yaml",
  ".markdownlint.yml",
  ".markdownlint.cjs",
  ".markdownlint.mjs",
];

/**
 * Renders `.configra/markdownlint-cli2.js`, or `.mjs` outside ESM packages.
 */
function renderConfigraFile(settings: ResolvedSettings): string {
  const rules = ["    default: true,\n"];

  if (settings.selections.tools.includes("prettier")) {
    rules.push("    // Prettier formats Markdown, so these overlapping style rules are off.\n");
    rules.push(...prettierOverlap.map((rule) => `    ${JSON.stringify(rule)}: false,\n`));
  }

  return [
    `// ${managedHeader(entryFile)}`,
    "",
    '/** @type {import("markdownlint-cli2").Options} */',
    "export default {",
    `  config: {\n${rules.join("")}  },`,
    `  ignores: ${jsArray(exclusionGlobs(settings))},`,
    "  gitignore: true,",
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
    " * markdownlint-cli2 configuration.",
    " *",
    ` * Configra manages ${managed}. Add your own rules inside \`config\` after the spread;`,
    " * they override Configra's.",
    " *",
    " * @see https://github.com/DavidAnson/markdownlint-cli2#configuration",
    " */",
    "",
    `import configra from "./${managed}";`,
    "",
    '/** @type {import("markdownlint-cli2").Options} */',
    "export default {",
    "  ...configra,",
    "  config: {",
    "    ...configra.config,",
    '    // "no-duplicate-heading": { siblings_only: true },',
    "  },",
    "};",
    "",
  ].join("\n");
}

export const markdownlintTool: ToolDefinition = {
  id: "markdownlint",
  label: "markdownlint",
  description: "Lints Markdown files with markdownlint-cli2.",
  languages: [],
  available: true,
  checks: (settings) => {
    const globs = scopeGlobs(settings, ["md"]);

    return [
      {
        id: "markdownlint",
        tool: "markdownlint",
        script: "lint:md",
        command: { executable: "markdownlint-cli2", args: globs },
        fixCommand: { executable: "markdownlint-cli2", args: ["--fix", ...globs] },
        hook: "pre-commit",
        extensions: ["md"],
        usesStagedFiles: true,
        aggregate: "lint",
      },
    ];
  },
  render: (settings) => {
    const contribution = emptyContribution();
    const managed = configraFile(settings, "markdownlint-cli2");

    contribution.files.push(
      {
        tool: "markdownlint",
        path: managed,
        ownership: "file",
        content: renderConfigraFile(settings),
        reason: "markdownlint rules and exclusions",
      },
      {
        tool: "markdownlint",
        path: entryFile,
        ownership: "entry",
        content: styleJs(renderEntryFile(managed), settings.formatting),
        reason: `Project markdownlint-cli2 entry file that loads ${managed}`,
        reference: `./${managed}`,
      },
    );

    contribution.fields.push(
      npmDependency("markdownlint", "markdownlint-cli2", settings.npmRange("markdownlint-cli2")),
    );

    contribution.competing.push(...competingFiles.map((path) => ({ tool: "markdownlint" as const, path })));

    return contribution;
  },
};
