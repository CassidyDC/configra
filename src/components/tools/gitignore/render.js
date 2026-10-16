/**
 * @typedef {import("../../../contracts.js").PackageContext} PackageContext
 * @typedef {import("../../../contracts.js").ToolContribution} ToolContribution
 */

/**
 * Contribute project-appropriate ignore entries for ownership-aware merging.
 *
 * @param {PackageContext} project Resolved settings and package ownership.
 * @returns {ToolContribution} Proposed configuration and tool requirements.
 */
export default function render(project) {
  const entries = ["node_modules/", ".DS_Store"];
  if (project.languages.includes("php")) entries.push("vendor/", ".phpstan-cache/");
  if (project.languages.includes("python")) entries.push("__pycache__/", "*.py[cod]", ".venv/", ".pytest_cache/");
  if (project.tools.includes("webpack")) entries.push("dist/");
  return { lines: { ".gitignore": entries } };
}
