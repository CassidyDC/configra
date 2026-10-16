/**
 * @file Stylelint configuration and dependencies for the selected CSS standard.
 */

import { json, hook } from "../shared.js";

/**
 * @typedef {import("../../../contracts.js").PackageContext} PackageContext
 * @typedef {import("../../../contracts.js").ToolContribution} ToolContribution
 */

/**
 * Render stylesheet lint settings for the selected CSS standard.
 *
 * @param {PackageContext} project Resolved settings and package ownership.
 * @returns {ToolContribution} Proposed configuration and tool requirements.
 */
export default function render(project) {
  const standard = project.standards.css.settings.extends;

  return {
    files: {
      "stylelint.config.mjs": `export default ${json({ extends: [standard], ignoreFiles: project.excludes })};\n`,
    },
    npm: {
      ...(standard.startsWith("@wordpress/") ? { "stylelint-scss": "^7.2.0" } : {}),
      stylelint: "^17.14.1",
      [standard]: standard.startsWith("@wordpress/") ? "^26.1.0" : "^40.0.0",
    },
    scripts: { "lint:css": 'stylelint "**/*.css" --allow-empty-input' },
    hooks: [hook("stylelint", ["**/*.css"], "npx --no-install stylelint {staged_files}")],
  };
}
