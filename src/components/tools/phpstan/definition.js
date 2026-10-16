/**
 * PHPStan integration metadata, requirements, operations, and configuration ownership.
 *
 * @type {import("../../../contracts.js").ToolDefinition}
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
