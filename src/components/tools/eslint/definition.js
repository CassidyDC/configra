export default {
  id: "eslint",
  languages: [
    "javascript",
  ],
  capabilities: [
    "react",
    "typescript",
  ],
  operations: [
    "lint:js",
  ],
  scope: "package",
  requirements: [
    "npm:eslint",
  ],
};
