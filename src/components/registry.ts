/**
 * The explicit list of supported presets, languages, UI frameworks, standards, and tools. The argument
 * parser, validator, and help output all read these definitions.
 */

import type { LanguageId, PresetId, StandardId, ToolId, UiId } from "../contracts.js";
import { languages } from "./languages/index.js";
import { nodeProject } from "./projects/node.js";
import type { ProjectDefinition } from "./projects/types.js";
import { wordpressSiteProject } from "./projects/wordpress-site.js";
import { editorconfigTool } from "./tools/editorconfig.js";
import { eslintTool } from "./tools/eslint.js";
import { gitignoreTool } from "./tools/gitignore.js";
import { lefthookTool } from "./tools/lefthook.js";
import { markdownlintTool } from "./tools/markdownlint.js";
import { phpcsTool, phpLintTool, phpstanTool, stylelintTool } from "./tools/pending.js";
import { prettierTool } from "./tools/prettier.js";
import type { ToolDefinition } from "./tools/types.js";
import { uis } from "./ui/index.js";

export const projects: Record<PresetId, ProjectDefinition> = {
  node: nodeProject,
  "wordpress-site": wordpressSiteProject,
};

export { languages, uis };

/** Tools in the order they appear in previews, scripts, and hooks. */
export const tools: Record<ToolId, ToolDefinition> = {
  editorconfig: editorconfigTool,
  gitignore: gitignoreTool,
  prettier: prettierTool,
  markdownlint: markdownlintTool,
  eslint: eslintTool,
  stylelint: stylelintTool,
  "php-lint": phpLintTool,
  phpcs: phpcsTool,
  phpstan: phpstanTool,
  lefthook: lefthookTool,
};

export const presetIds = Object.keys(projects) as PresetId[];

export const languageIds = Object.keys(languages) as LanguageId[];

export const uiIds = Object.keys(uis) as UiId[];

export const standardIds: StandardId[] = ["community", "wordpress"];

export const toolIds = Object.keys(tools) as ToolId[];

export const commitMessageModes = ["plain", "conventional", "off"] as const;

/** Tools every setup gets unless the selection removes them. */
export const universalTools: ToolId[] = ["editorconfig", "gitignore", "prettier", "markdownlint", "lefthook"];

/**
 * The supported standard combinations. JavaScript and TypeScript share one ESLint installation, so they
 * must use the same standard. CSS and PHP choose independently, and React works with either JavaScript
 * standard. Add a row only with a clean consumer fixture.
 */
export const supportedStandardCombinations: ReadonlyArray<Partial<Record<LanguageId, StandardId>>> = [
  { javascript: "community", typescript: "community" },
  { javascript: "wordpress", typescript: "wordpress" },
  { css: "community" },
  { css: "wordpress" },
  { php: "community" },
  { php: "wordpress" },
];

/** Languages that must share one standard. */
export const sharedStandardGroups: LanguageId[][] = [["javascript", "typescript"]];
