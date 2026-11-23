import { existsSync, readFileSync } from "node:fs";
import { dirname, join, matchesGlob, relative, sep } from "node:path";
import type { CommandSpec } from "../../contracts.js";

/**
 * The install command Configra runs. Lifecycle scripts stay off so Lefthook's postinstall can't activate
 * hooks, and the audit and funding notices stay out of the output.
 */
export const npmInstall: CommandSpec = {
  executable: "npm",
  args: ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
};

/**
 * Returns the workspace patterns a manifest declares, in either the array or the object form.
 */
function workspacePatterns(manifest: unknown): string[] {
  if (!manifest || typeof manifest !== "object") {
    return [];
  }

  const workspaces = (manifest as { workspaces?: unknown }).workspaces;
  const patterns = Array.isArray(workspaces)
    ? workspaces
    : (workspaces as { packages?: unknown } | undefined)?.packages;

  return Array.isArray(patterns) ? patterns.filter((pattern): pattern is string => typeof pattern === "string") : [];
}

/**
 * Returns the root of an enclosing npm workspace that lists `root` as a member, where `npm install` would
 * run instead, or undefined when npm installs in `root` itself.
 */
export function enclosingWorkspaceRoot(root: string): string | undefined {
  let current = dirname(root);

  for (;;) {
    const manifestPath = join(current, "package.json");

    if (existsSync(manifestPath)) {
      try {
        const member = relative(current, root).split(sep).join("/");
        const patterns = workspacePatterns(JSON.parse(readFileSync(manifestPath, "utf8")));

        if (patterns.some((pattern) => matchesGlob(member, pattern.replace(/^\.\//, "").replace(/\/+$/, "")))) {
          return current;
        }
      } catch {
        // An unreadable manifest declares no workspaces.
      }
    }

    const parent = dirname(current);

    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
}

/**
 * Returns the path of a project's installed binary, such as `node_modules/.bin/lefthook`.
 */
export function installedBinary(root: string, name: string): string | undefined {
  const candidates = process.platform === "win32" ? [`${name}.cmd`, `${name}.exe`, name] : [name];

  for (const candidate of candidates) {
    const path = join(root, "node_modules", ".bin", candidate);

    if (existsSync(path)) {
      return path;
    }
  }

  return undefined;
}
