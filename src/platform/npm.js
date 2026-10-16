import path from "node:path";
import { readJson } from "./filesystem.js";
import { execute } from "./process.js";

export async function workspacePatterns(root) {
  const manifest = await readJson(root, "package.json", {});
  const patterns = manifest.workspaces?.packages ?? manifest.workspaces ?? [];
  if (!Array.isArray(patterns) || patterns.some((pattern) => typeof pattern !== "string")) {
    throw new Error("package.json workspaces must be an array of package paths or globs");
  }
  return patterns;
}

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
export const install = execute;
