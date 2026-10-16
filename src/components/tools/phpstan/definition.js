/**
 * @file PHPStan integration metadata, supported operations, and configuration ownership.
 */

/**
 * @typedef {import("../../../contracts.js").ToolDefinition} ToolDefinition
 */

/**
 * PHPStan integration metadata, requirements, operations, and configuration ownership.
 *
 * @type {ToolDefinition}
 */
export default {
  id: "phpstan",
  languages: [
    "php",
  ],
  capabilities: [],
  operations: [
    "lint:php:types",
  ],
  scope: "package",
  requirements: [
    "composer:phpstan/phpstan",
  ],
  alternatives: [
    "phpstan.neon",
    "phpstan.dist.neon",
  ],
};
