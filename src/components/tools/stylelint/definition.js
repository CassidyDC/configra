export default {
  id: "stylelint",
  languages: [
    "css",
  ],
  capabilities: [],
  operations: [
    "lint:css",
  ],
  scope: "package",
  requirements: [
    "npm:stylelint",
  ],
  alternatives: [
    "stylelint.config.js",
    "stylelint.config.cjs",
    ".stylelintrc",
    ".stylelintrc.json",
    ".stylelintrc.js",
    ".stylelintrc.cjs",
    ".stylelintrc.yaml",
    ".stylelintrc.yml",
  ],
};
