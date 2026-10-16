/**
 * Defaults and child discovery hints for a WordPress wp-content project.
 *
 * @type {import("../../../contracts.js").ProjectDefinition}
 */
export default {
  id: "wordpress-site",
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
    ".",
  ],
  discovery: [
    "plugins",
    "themes",
    "mu-plugins",
  ],
};
