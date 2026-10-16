/**
 * Default development tools and source paths for a general PHP package.
 *
 * @type {import("../../contracts.js").ProjectDefinition}
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
