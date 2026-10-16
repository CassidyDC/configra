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
};
