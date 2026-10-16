/**
 * PHP Project Defaults
 * @file Default languages, tools, and source paths for PHP packages.
 */

/**
 * @typedef {import("../../contracts.js").ProjectDefinition} ProjectDefinition
 */

/**
 * Default development tools and source paths for a general PHP package.
 *
 * @type {ProjectDefinition}
 */
export default {
  id: "php",
  languages: [
    "php",
  ],
  tools: [
    "editorconfig",
    "gitignore",
    "lefthook",
    "markdownlint",
    "prettier",
    "vscode",
    "parallellint",
    "phpcs",
    "phpstan",
  ],
  environment: "php",
  paths: [
    "src",
  ],
};
