/**
 * Component Registry
 * @file Explicit registry of supported projects, capabilities, standards, and tool integrations.
 */

import node from "./projects/node.js";
import php from "./projects/php.js";
import site from "./projects/wordpress/site.js";
import plugin from "./projects/wordpress/plugin.js";
import theme from "./projects/wordpress/theme.js";
import react from "./capabilities/react.js";
import typescript from "./capabilities/typescript.js";
import jsCommunity from "./standards/javascript/community.js";
import jsWordpress from "./standards/javascript/wordpress.js";
import cssCommunity from "./standards/css/community.js";
import cssWordpress from "./standards/css/wordpress.js";
import phpCommunity from "./standards/php/community.js";
import phpWordpress from "./standards/php/wordpress.js";
import editorconfig from "./tools/editorconfig/definition.js";
import renderEditorconfig from "./tools/editorconfig/render.js";
import gitignore from "./tools/gitignore/definition.js";
import renderGitignore from "./tools/gitignore/render.js";
import eslint from "./tools/eslint/definition.js";
import renderEslint from "./tools/eslint/render.js";
import prettier from "./tools/prettier/definition.js";
import renderPrettier from "./tools/prettier/render.js";
import markdownlint from "./tools/markdownlint/definition.js";
import renderMarkdownlint from "./tools/markdownlint/render.js";
import lefthook from "./tools/lefthook/definition.js";
import renderLefthook from "./tools/lefthook/render.js";
import parallellint from "./tools/parallellint/definition.js";
import renderParallellint from "./tools/parallellint/render.js";
import phpcs from "./tools/phpcs/definition.js";
import renderPhpcs from "./tools/phpcs/render.js";
import phpstan from "./tools/phpstan/definition.js";
import renderPhpstan from "./tools/phpstan/render.js";
import stylelint from "./tools/stylelint/definition.js";
import renderStylelint from "./tools/stylelint/render.js";
import vscode from "./tools/vscode/definition.js";
import renderVscode from "./tools/vscode/render.js";
import webpack from "./tools/webpack/definition.js";
import renderWebpack from "./tools/webpack/render.js";

/**
 * @typedef {import("../contracts.js").ProjectDefinition} ProjectDefinition
 * @typedef {import("../contracts.js").CapabilityDefinition} CapabilityDefinition
 * @typedef {import("../contracts.js").StandardDefinition} StandardDefinition
 * @typedef {import("../contracts.js").ToolIntegration} ToolIntegration
 */

/**
 * Supported project defaults indexed by stable component identifier.
 *
 * @type {Object<string, ProjectDefinition>}
 */
export const projects = Object.fromEntries([node, php, site, plugin, theme].map((item) => [item.id, item]));

/**
 * Explicitly registered optional language capabilities.
 *
 * @type {Object<string, CapabilityDefinition>}
 */
export const capabilities = { react, typescript };

/**
 * Supported standards indexed first by language and then standard identifier.
 *
 * @type {Object<string, Object<string, StandardDefinition>>}
 */
export const standards = {
  javascript: { community: jsCommunity, wordpress: jsWordpress },
  css: { community: cssCommunity, wordpress: cssWordpress },
  php: { community: phpCommunity, wordpress: phpWordpress },
};

/**
 * Supported tool metadata and pure renderer implementations.
 *
 * @type {Object<string, ToolIntegration>}
 */
export const tools = {
  editorconfig: { ...editorconfig, render: renderEditorconfig },
  gitignore: { ...gitignore, render: renderGitignore },
  eslint: { ...eslint, render: renderEslint },
  prettier: { ...prettier, render: renderPrettier },
  markdownlint: { ...markdownlint, render: renderMarkdownlint },
  lefthook: { ...lefthook, render: renderLefthook },
  parallellint: { ...parallellint, render: renderParallellint },
  phpcs: { ...phpcs, render: renderPhpcs },
  phpstan: { ...phpstan, render: renderPhpstan },
  stylelint: { ...stylelint, render: renderStylelint },
  vscode: { ...vscode, render: renderVscode },
  webpack: { ...webpack, render: renderWebpack },
};
