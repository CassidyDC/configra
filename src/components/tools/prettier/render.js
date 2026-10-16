import { options } from "./options.js";
import { json, hook } from "../shared.js";

/**
 * @typedef {import("../../../contracts.js").PackageContext} PackageContext
 * @typedef {import("../../../contracts.js").ToolContribution} ToolContribution
 */

/**
 * Render formatter settings and exclusions consistent with resolved formatting.
 *
 * @param {PackageContext} project Resolved settings and package ownership.
 * @returns {ToolContribution} Proposed configuration and tool requirements.
 */
export default function render(project) {
  const wordpress = project.standards.javascript?.id === "wordpress";
  const config = options(project);
  const npm = { prettier: "^3.0.0" };
  if (wordpress) npm["@wordpress/prettier-config"] = "^4.0.0";
  const source = `module.exports = { ${wordpress ? '...require("@wordpress/prettier-config"),' : ""} ...${json(config).trim()} };\n`;
  return {
    files: {
      "prettier.config.cjs": source,
      ".prettierignore":
        [...project.excludes, ".cassidydc-toolset-state.json", "package-lock.json", "composer.lock"].join("\n") + "\n",
    },
    npm,
    scripts: { "format:check": "prettier . --check", format: "prettier . --write" },
    hooks: [
      hook(
        "prettier",
        ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,css,html,json,jsonc,md,yml,yaml}"],
        "npx --no-install prettier --check {staged_files}",
      ),
    ],
  };
}
