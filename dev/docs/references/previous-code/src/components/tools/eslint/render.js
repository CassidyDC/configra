/**
 * ESLint Configuration Generation
 * @file ESLint configuration, dependencies, and checks for selected JavaScript capabilities.
 */

import { json, patterns, hook } from "../shared.js";

/**
 * @typedef {import("../../../contracts.js").PackageContext} PackageContext
 * @typedef {import("../../../contracts.js").ToolContribution} ToolContribution
 */

/**
 * Render a flat ESLint configuration for the selected standard and capabilities.
 *
 * @param {PackageContext} project Resolved settings and package ownership.
 * @returns {ToolContribution} Proposed configuration and tool requirements.
 */
export default function render(project) {
  const wordpress = project.standards.javascript.id === "wordpress";
  const react = project.capabilities.includes("react");
  const ts = project.capabilities.includes("typescript");
  const imports = ['import { defineConfig } from "eslint/config";', 'import globals from "globals";'];
  const configs = [];
  const npm = { eslint: "^10.0.0", globals: "^17.0.0" };

  if (wordpress) {
    imports.push('import wordpress from "@wordpress/eslint-plugin";');
    configs.push("wordpress.configs.recommended");
    npm["@wordpress/eslint-plugin"] = "^27.1.0";
  } else {
    imports.push('import js from "@eslint/js";');
    configs.push("js.configs.recommended");
    npm["@eslint/js"] = "^10.0.0";
  }

  if (ts) {
    imports.push('import tseslint from "typescript-eslint";');
    npm["typescript-eslint"] = "^8.0.0";
    npm.typescript = "^5.0.0";
  }

  if (react && !wordpress) {
    imports.push('import react from "eslint-plugin-react";');
    configs.push("react.configs.flat.recommended", 'react.configs.flat["jsx-runtime"]');
    npm["eslint-plugin-react"] = "^7.37.0";
  }

  if (project.tools.includes("prettier")) {
    imports.push('import prettier from "eslint-config-prettier/flat";');
    npm["eslint-config-prettier"] = "^10.0.0";
  }

  const globals = project.environment === "node" ? "globals.node" : "{ ...globals.browser, ...globals.node }";
  const config = `${imports.join("\n")}\n\nexport default defineConfig(\n  { ignores: ${json(project.excludes).trim()} },\n  { files: ${json(patterns(project)).trim()}, extends: [${configs.join(", ")}], languageOptions: { globals: ${globals}, parserOptions: { ecmaFeatures: { jsx: ${react} } } }${react ? ', settings: { react: { version: "detect" } }' : ""} },\n${ts ? '  { files: ["**/*.{ts,mts,cts,tsx}"], extends: [tseslint.configs.recommended] },\n' : ""}${project.tools.includes("prettier") ? "  prettier,\n" : ""});\n`;

  return {
    files: { "eslint.config.mjs": config },
    npm,
    scripts: { "lint:js": "eslint ." },
    hooks: [hook("eslint", patterns(project), "npx --no-install eslint {staged_files}")],
  };
}
