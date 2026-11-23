import type { ResolvedCheck, ResolvedSettings, StandardId } from "../../contracts.js";
import {
  emptyContribution,
  exclusionGlobs,
  jsArray,
  managedHeader,
  npmDependency,
  scopeGlobs,
  styleJs,
} from "./shared.js";
import type { ToolDefinition } from "./types.js";

const competingFiles = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts",
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yaml",
  ".eslintrc.yml",
];

const cacheArgs = ["--cache", "--cache-location", ".cache/eslint/"];

/**
 * The JavaScript standard, which TypeScript shares because both use one ESLint installation.
 */
function scriptStandard(settings: ResolvedSettings): StandardId {
  const { standards } = settings.selections;

  return standards.javascript ?? standards.typescript ?? "community";
}

/**
 * Every extension ESLint checks.
 */
function scriptExtensions(settings: ResolvedSettings): string[] {
  return [...(settings.extensions.javascript ?? []), ...(settings.extensions.typescript ?? [])];
}

/**
 * Renders the community configuration from `@eslint/js`, `typescript-eslint`, and the React plugins.
 */
function renderCommunity(settings: ResolvedSettings, entryFile: string): string {
  const js = settings.extensions.javascript ?? [];
  const ts = settings.extensions.typescript ?? [];
  const react = settings.selections.ui.includes("react");
  const globals = `globals.${settings.globals}`;
  const imports = ['import js from "@eslint/js";', 'import { defineConfig, globalIgnores } from "eslint/config";'];
  const blocks = [`  globalIgnores(${jsArray(exclusionGlobs(settings))}, "Configra exclusions"),`];

  imports.push('import globals from "globals";');

  if (ts.length > 0) {
    imports.push('import tseslint from "typescript-eslint";');
  }

  if (react) {
    imports.push('import eslintReact from "@eslint-react/eslint-plugin";');
    imports.push('import reactHooks from "eslint-plugin-react-hooks";');
  }

  if (js.length > 0) {
    blocks.push(
      [
        "  {",
        '    name: "configra/javascript",',
        `    files: ${jsArray(scopeGlobs(settings, js))},`,
        "    extends: [js.configs.recommended],",
        `    languageOptions: { globals: { ...${globals} } },`,
        "  },",
      ].join("\n"),
    );
  }

  if (ts.length > 0) {
    blocks.push(
      [
        "  {",
        '    name: "configra/typescript",',
        `    files: ${jsArray(scopeGlobs(settings, ts))},`,
        "    extends: [js.configs.recommended, tseslint.configs.recommended],",
        `    languageOptions: { globals: { ...${globals} } },`,
        "  },",
      ].join("\n"),
    );
  }

  if (react && js.length > 0) {
    blocks.push(renderReactBlock("configra/react-javascript", scopeGlobs(settings, js), "recommended"));
  }

  if (react && ts.length > 0) {
    blocks.push(renderReactBlock("configra/react-typescript", scopeGlobs(settings, ts), "recommended-typescript"));
  }

  return [
    `// ${managedHeader(entryFile)}`,
    "",
    ...imports,
    "",
    "export default defineConfig([",
    ...blocks,
    "]);",
    "",
  ].join("\n");
}

/**
 * Renders one React block. Both plugins ship the rules of hooks, so `@eslint-react` turns off its copies.
 */
function renderReactBlock(name: string, files: string[], preset: string): string {
  return [
    "  {",
    `    name: ${JSON.stringify(name)},`,
    `    files: ${jsArray(files)},`,
    "    extends: [",
    `      eslintReact.configs[${JSON.stringify(preset)}],`,
    '      eslintReact.configs["disable-conflict-eslint-plugin-react-hooks"],',
    "      reactHooks.configs.flat.recommended,",
    "    ],",
    "    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },",
    "  },",
  ].join("\n");
}

/**
 * Renders the WordPress configuration from `@wordpress/eslint-plugin`'s recommended preset.
 */
function renderWordPress(settings: ResolvedSettings, entryFile: string): string {
  const files = jsArray(scopeGlobs(settings, scriptExtensions(settings)));

  const blocks = [
    `  globalIgnores(${jsArray(exclusionGlobs(settings))}, "Configra exclusions"),`,
    [
      "  {",
      '    name: "configra/wordpress",',
      `    files: ${files},`,
      "    extends: [wordpress.configs.recommended],",
      "  },",
    ].join("\n"),
  ];

  if (settings.selections.tools.includes("prettier")) {
    blocks.push(
      [
        "  {",
        "    // Prettier formats through `format` and `format:check`, so ESLint doesn't run it as a rule.",
        '    name: "configra/prettier",',
        `    files: ${files},`,
        '    rules: { "prettier/prettier": "off" },',
        "  },",
      ].join("\n"),
    );
  }

  return [
    `// ${managedHeader(entryFile)}`,
    "",
    'import wordpress from "@wordpress/eslint-plugin";',
    'import { defineConfig, globalIgnores } from "eslint/config";',
    "",
    "export default defineConfig([",
    ...blocks,
    "]);",
    "",
  ].join("\n");
}

/**
 * Renders the project-owned entry file, created once.
 */
function renderEntryFile(): string {
  return [
    "/**",
    " * ESLint configuration.",
    " *",
    " * Configra manages .configra/eslint.mjs and loads it first. Add your own settings after it; later",
    " * entries override earlier ones.",
    " *",
    " * @see https://eslint.org/docs/latest/use/configure/configuration-files",
    " */",
    "",
    'import { defineConfig } from "eslint/config";',
    'import configra from "./.configra/eslint.mjs";',
    "",
    "export default defineConfig([",
    "  configra,",
    "  // {",
    '  //   rules: { "no-console": "warn" },',
    "  // },",
    "]);",
    "",
  ].join("\n");
}

export const eslintTool: ToolDefinition = {
  id: "eslint",
  label: "ESLint",
  description: "Lints JavaScript and TypeScript, including React when selected.",
  languages: ["javascript", "typescript"],
  available: true,
  checks: (settings): ResolvedCheck[] => [
    {
      id: "eslint",
      tool: "eslint",
      script: "lint:js",
      command: { executable: "eslint", args: [...cacheArgs, "--no-error-on-unmatched-pattern", "."] },
      fixCommand: { executable: "eslint", args: [...cacheArgs, "--no-error-on-unmatched-pattern", "--fix", "."] },
      hook: "pre-commit",
      extensions: scriptExtensions(settings),
      stagedArgs: [...cacheArgs, "--no-warn-ignored"],
      usesStagedFiles: true,
      aggregate: "lint",
    },
  ],
  render: (settings) => {
    const contribution = emptyContribution();
    const entryFile = `eslint.config${settings.configExtension}`;
    const standard = scriptStandard(settings);
    const typescript = (settings.extensions.typescript ?? []).length > 0;
    const react = settings.selections.ui.includes("react");

    contribution.files.push(
      {
        tool: "eslint",
        path: ".configra/eslint.mjs",
        ownership: "file",
        content: standard === "wordpress" ? renderWordPress(settings, entryFile) : renderCommunity(settings, entryFile),
        reason: `ESLint rules for the ${standard} standard`,
      },
      {
        tool: "eslint",
        path: entryFile,
        ownership: "entry",
        content: styleJs(renderEntryFile(), settings.formatting),
        reason: "Project ESLint entry file that loads .configra/eslint.mjs",
        reference: "./.configra/eslint.mjs",
      },
    );

    const dependencies =
      standard === "wordpress"
        ? ["eslint", "@wordpress/eslint-plugin", ...(typescript ? ["typescript"] : [])]
        : [
            "eslint",
            "@eslint/js",
            "globals",
            ...(typescript ? ["typescript-eslint"] : []),
            ...(react ? ["@eslint-react/eslint-plugin", "eslint-plugin-react-hooks"] : []),
            // `@eslint-react/eslint-plugin` requires TypeScript as a peer, even for JavaScript.
            ...(typescript || react ? ["typescript"] : []),
          ];

    contribution.fields.push(
      ...dependencies.map((name) => npmDependency("eslint", name, settings.npmRange(name, standard))),
    );

    contribution.competing.push(
      ...competingFiles.filter((path) => path !== entryFile).map((path) => ({ tool: "eslint" as const, path })),
      { tool: "eslint", path: "package.json", field: ["eslintConfig"] },
    );

    return contribution;
  },
};
