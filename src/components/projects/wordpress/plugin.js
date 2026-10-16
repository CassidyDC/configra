/**
 * WordPress plugin defaults shared by standalone and child packages.
 *
 * @type {import("../../../contracts.js").ProjectDefinition}
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
