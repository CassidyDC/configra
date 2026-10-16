import { scripts as localScripts, context } from "./single.js";
import { quote } from "../../platform/process.js";
/**
 * Reuse the common renderer context and package exclusion rules.
 *
 * @see module:generator/layouts/single.context
 */
export { context };
/**
 * Keep dependency declarations owned by the package that requires them.
 *
 * @param {import("../../contracts.js").ResolvedPackage} project Owning package.
 * @returns {string} Project-relative dependency owner path.
 */
export const dependencyOwner = (project) => project.path;

/**
 * Compose local checks and root delegation using exact workspace package names.
 *
 * @param {import("../../contracts.js").PackageContext} project Package ownership and layout context.
 * @param {import("../../contracts.js").ToolContribution} contribution Combined scripts and requirements.
 * @returns {Object<string, string>} Local and aggregate npm scripts.
 */
export function scripts(project, contribution) {
  const result = localScripts(project, contribution);
  // Select exact workspace names: a path selector also includes nested workspaces in npm.
  if (project.path === ".") {
    const calls = project.descendants.map(
      (child) => `npm run lint:local --workspace=${quote(project.workspaceNames[child])} --if-present`,
    );
    if (calls.length) result.lint = [...(result["lint:local"] ? ["npm run lint:local"] : []), ...calls].join(" && ");
  }
  return result;
}
