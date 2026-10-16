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
  return patterns.some((pattern) => path.matchesGlob(relative, pattern.replace(/\/$/, "")));
}

export function installation(root, packagePath, workspace = false) {
  return {
    ecosystem: "npm",
    package: packagePath,
    command: "npm",
    args: workspace ? ["install", `--workspace=${packagePath}`] : ["install"],
    cwd: workspace ? root : path.resolve(root, packagePath),
  };
}
export const install = execute;
