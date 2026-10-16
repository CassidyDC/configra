import { json, hook } from "../shared.js";
/**
 * Render Markdown checks and exclusions scoped to the owning package.
 *
 * @param {import("../../../contracts.js").PackageContext} project Resolved settings and package ownership.
 * @returns {import("../../../contracts.js").ToolContribution} Proposed configuration and tool requirements.
 */
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
