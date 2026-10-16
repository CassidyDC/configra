/**
 * @file PHP CodeSniffer integration metadata, supported operations, and configuration ownership.
 */

/**
 * @typedef {import("../../../contracts.js").ToolDefinition} ToolDefinition
 */

/**
 * PHP CodeSniffer integration metadata, requirements, operations, and configuration ownership.
 *
 * @type {ToolDefinition}
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
