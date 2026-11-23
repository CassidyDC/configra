import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Returns the nearest directory at or above `start` that contains `.git`, or undefined outside a repository.
 */
export function findGitRoot(start: string): string | undefined {
  let current = start;

  for (;;) {
    if (existsSync(join(current, ".git"))) {
      return current;
    }

    const parent = dirname(current);

    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
}

/**
 * Returns whether a directory is the root of its own Git repository or worktree.
 */
export function isGitBoundary(directory: string): boolean {
  return existsSync(join(directory, ".git"));
}
