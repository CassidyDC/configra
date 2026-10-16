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
