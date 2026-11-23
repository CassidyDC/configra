/**
 * PHP Parallel Lint Tool Definition
 * @file PHP Parallel Lint integration metadata, supported operations, and configuration ownership.
 */

/**
 * @typedef {import("../../../contracts.js").ToolDefinition} ToolDefinition
 */

/**
 * PHP Parallel Lint integration metadata, requirements, operations, and configuration ownership.
 *
 * @type {ToolDefinition}
 */
export default {
  id: "parallellint",
  languages: [
    "php",
  ],
  capabilities: [],
  operations: [
    "lint:php:syntax",
  ],
  scope: "package",
  requirements: [
    "composer:php-parallel-lint/php-parallel-lint",
  ],
};
