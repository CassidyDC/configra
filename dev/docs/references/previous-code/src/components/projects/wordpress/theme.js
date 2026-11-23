/**
 * WordPress Theme Project Defaults
 * @file Default languages, tools, and source paths for WordPress themes.
 */

/**
 * @typedef {import("../../../contracts.js").ProjectDefinition} ProjectDefinition
 */

/**
 * WordPress theme defaults with optional framework and language capabilities.
 *
 * @type {ProjectDefinition}
 */
export default {
  id: "wordpress-theme",
  languages: [
    "javascript",
    "css",
    "php",
  ],
  tools: [
    "editorconfig",
    "gitignore",
    "lefthook",
    "markdownlint",
    "prettier",
    "vscode",
    "eslint",
    "stylelint",
    "parallellint",
    "phpcs",
    "phpstan",
  ],
  environment: "wordpress",
  paths: [
    "src",
    "assets",
    "templates",
  ],
};
