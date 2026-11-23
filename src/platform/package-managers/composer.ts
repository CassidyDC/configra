import type { CommandSpec } from "../../contracts.js";

/** Flags every Configra-driven Composer run uses: no project scripts and no prompts. */
const commonFlags = ["--no-scripts", "--no-interaction", "--no-progress"];

/**
 * Returns the Composer command that reconciles the managed packages. With a lockfile, it runs a partial
 * update of only those packages with `--minimal-changes`, so unrelated locked versions stay put and a
 * retry still syncs a lockfile that an earlier failed or generate-only run left behind. Without a
 * lockfile, nothing locked can change, so it resolves everything.
 */
export function composerInstall(hasLockfile: boolean, packages: readonly string[]): CommandSpec {
  if (!hasLockfile) {
    return { executable: "composer", args: ["update", ...commonFlags] };
  }

  return {
    executable: "composer",
    args: ["update", ...[...packages].sort(), "--with-dependencies", "--minimal-changes", ...commonFlags],
  };
}
