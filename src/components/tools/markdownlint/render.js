import { json, hook } from "../shared.js";
export default function render(project) {
  return {
    files: {
      ".markdownlint-cli2.jsonc": json({ config: { default: true, "line-length": false }, ignores: project.excludes }),
    },
    npm: { "markdownlint-cli2": "^0.23.0" },
    scripts: { "lint:markdown": 'markdownlint-cli2 "**/*.md"' },
    hooks: [hook("markdownlint", ["**/*.md"], "npx --no-install markdownlint-cli2 {staged_files}")],
  };
}
