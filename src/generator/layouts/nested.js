import path from "node:path";
import { scripts as localScripts, context } from "./single.js";
import { quote } from "../../platform/process.js";

/**
 * @typedef {import("../../contracts.js").ResolvedPackage} ResolvedPackage
 * @typedef {import("../../contracts.js").PackageContext} PackageContext
 * @typedef {import("../../contracts.js").ToolContribution} ToolContribution
 */

/**
 * Reuse the common renderer context and package exclusion rules.
 *
 * @see module:generator/layouts/single.context
 */
export { context };

/**
 * Keep dependency declarations owned by the package that requires them.
 *
 * @param {ResolvedPackage} project Owning package.
 * @returns {string} Project-relative dependency owner path.
 */
export const dependencyOwner = (project) => project.path;

/**
 * Compose local checks and relative-path delegation to direct selected children.
 *
 * @param {PackageContext} project Package ownership and layout context.
 * @param {ToolContribution} contribution Combined scripts and requirements.
 * @returns {Object<string, string>} Local and aggregate npm scripts.
 */
export function scripts(project, contribution) {
  const result = localScripts(project, contribution);
  const calls = project.children.map(
    (child) => `npm --prefix ${quote(path.posix.relative(project.path, child))} run lint --if-present`,
  );

  if (calls.length) result.lint = [...(result["lint:local"] ? ["npm run lint:local"] : []), ...calls].join(" && ");

  return result;
}
