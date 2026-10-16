/**
 * @typedef {import("../../contracts.js").ResolvedPackage} ResolvedPackage
 * @typedef {import("../../contracts.js").ResolvedProject} ResolvedProject
 * @typedef {import("../../contracts.js").PackageContext} PackageContext
 * @typedef {import("../../contracts.js").ToolContribution} ToolContribution
 */

/**
 * Add local exclusions and workspace lookup information to a resolved package.
 *
 * @param {ResolvedPackage & {descendants: string[]}} project Package and selected descendants.
 * @param {ResolvedProject} resolved Complete resolution and ownership graph.
 * @returns {PackageContext} Renderer context for this package.
 */
export function context(project, resolved) {
  return {
    ...project,
    workspaceNames: Object.fromEntries(resolved.graph.packages.map((node) => [node.path, node.workspaceName])),
    excludes: [
      "**/node_modules/**",
      "**/vendor/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/.phpstan-cache/**",
      "**/.venv/**",
      "**/__pycache__/**",
      ...resolved.graph.candidates
        .filter(
          (candidate) =>
            candidate.gitBoundary && (project.path === "." || candidate.path.startsWith(project.path + "/")),
        )
        .map((candidate) => candidate.path.slice(project.path === "." ? 0 : project.path.length + 1) + "/**"),
      ...project.children.map((child) => child.slice(project.path === "." ? 0 : project.path.length + 1) + "/**"),
    ],
    layout: resolved.request.layout,
  };
}

/**
 * Compose local tool checks without child-package delegation.
 *
 * @param {PackageContext} project Package ownership and layout context.
 * @param {ToolContribution} contribution Combined scripts and requirements.
 * @returns {Object<string, string>} Local and aggregate npm scripts.
 */
export function scripts(project, contribution) {
  const result = { ...contribution.scripts };
  const checks = Object.keys(result)
    .filter((name) => name.startsWith("lint:") || name === "format:check")
    .sort();
  if (checks.length) result["lint:local"] = checks.map((name) => `npm run ${name}`).join(" && ");
  if (checks.length) result.lint = "npm run lint:local";
  return result;
}

/**
 * Keep dependency declarations owned by the package that requires them.
 *
 * @param {ResolvedPackage} project Owning package.
 * @returns {string} Project-relative dependency owner path.
 */
export const dependencyOwner = (project) => project.path;
