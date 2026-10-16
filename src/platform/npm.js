import path from "node:path";
import { readJson } from "./filesystem.js";
import { execute } from "./process.js";

/**
 * @typedef {import("../contracts.js").InstallationOperation} InstallationOperation
 * @typedef {typeof import("./process.js").execute} ProcessRunner
 */

/**
 * Read and validate npm workspace declarations without modifying the manifest.
 *
 * @param {string} root Absolute workspace registration root.
 * @returns {Promise<string[]>} Declared workspace paths and glob patterns.
 * @throws {Error} If the manifest or workspace declaration has an unsupported shape.
 */
export async function workspacePatterns(root) {
  const manifest = await readJson(root, "package.json", {});
  const patterns = manifest.workspaces?.packages ?? manifest.workspaces ?? [];

  if (!Array.isArray(patterns) || patterns.some((pattern) => typeof pattern !== "string")) {
    throw new Error("package.json workspaces must be an array of package paths or globs");
  }

  return patterns;
}

/**
 * Match a package path against ordered workspace inclusions and exclusions.
 *
 * @param {string} relative Project-relative package directory.
 * @param {string[]} patterns Declared workspace patterns, including negations.
 * @returns {boolean} Whether the path remains included after exclusions and later explicit inclusions.
 */
export function matchesWorkspace(relative, patterns) {
  const includes = [];
  let excludes = [];

  for (let pattern of patterns) {
    const bangs = pattern.match(/^!+/)?.[0].length ?? 0;

    pattern = pattern
      .slice(bangs)
      .replace(/^\.?\/+/, "")
      .replace(/\/$/, "")
      .replaceAll("\\", "/");

    if (bangs % 2) excludes.push(pattern);
    else {
      excludes = excludes.filter((excluded) => !path.matchesGlob(pattern, excluded));
      includes.push(pattern);
    }
  }

  const ancestors = relative.split("/").map((_, index, segments) => segments.slice(0, index + 1).join("/"));

  return (
    includes.some((pattern) => path.matchesGlob(relative, pattern)) &&
    !excludes.some((pattern) => ancestors.some((ancestor) => path.matchesGlob(ancestor, pattern)))
  );
}

/**
 * Prepare a dependency installation scoped to the owning package or exact workspace name.
 *
 * @param {string} root Absolute project root.
 * @param {string} packagePath Project-relative dependency owner.
 * @param {boolean} [workspace=false] Whether npm workspace installation semantics apply.
 * @param {string} [workspaceName] Exact registered workspace name for a child package.
 * @returns {InstallationOperation} Prepared npm operation; no process is executed.
 */
export function installation(root, packagePath, workspace = false, workspaceName) {
  return {
    ecosystem: "npm",
    package: packagePath,
    command: "npm",
    args:
      workspace && packagePath !== "."
        ? ["install", `--workspace=${workspaceName ?? packagePath}`]
        : ["install", "--workspaces=false"],
    cwd: workspace ? root : path.resolve(root, packagePath),
  };
}

/**
 * Execute a prepared npm operation through the shared process adapter.
 *
 * @type {ProcessRunner}
 */
export const install = execute;
