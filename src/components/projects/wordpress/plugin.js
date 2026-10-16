/**
 * @file Default languages, tools, and source paths for WordPress plugins.
 */

/**
 * @typedef {import("../../../contracts.js").ProjectDefinition} ProjectDefinition
 */

/**
 * WordPress plugin defaults shared by standalone and child packages.
 *
 * @type {ProjectDefinition}
 */
export default {
  id: "wordpress-plugin",
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
    "includes",
    "assets",
  ],
};
