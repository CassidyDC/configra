/**
 * @file Package-scoped Markdownlint configuration and documentation checks.
 */

import { json, hook } from "../shared.js";

/**
 * @typedef {import("../../../contracts.js").PackageContext} PackageContext
 * @typedef {import("../../../contracts.js").ToolContribution} ToolContribution
 */

/**
 * Render Markdown checks and exclusions scoped to the owning package.
 *
 * @param {PackageContext} project Resolved settings and package ownership.
 * @returns {ToolContribution} Proposed configuration and tool requirements.
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
