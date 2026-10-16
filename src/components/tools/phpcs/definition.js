/**
 * PHP CodeSniffer integration metadata, requirements, operations, and configuration ownership.
 *
 * @type {import("../../../contracts.js").ToolDefinition}
 */
export default {
  id: "phpcs",
  languages: [
    "php",
  ],
  capabilities: [],
  operations: [
    "lint:php:style",
  ],
  scope: "package",
  requirements: [
    "composer:squizlabs/php_codesniffer",
  ],
  alternatives: [
    "phpcs.xml",
    ".phpcs.xml",
    ".phpcs.xml.dist",
  ],
};
