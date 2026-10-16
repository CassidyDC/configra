import { json } from "../shared.js";
/**
 * Serialize combined package checks into one Git-root hook configuration.
 *
 * @param {import("../../../contracts.js").PackageContext} project Resolved settings and package ownership.
 * @param {object} [options={}] Combined contributions supplied by the planner.
 * @param {import("../../../contracts.js").HookRequirement[]} [options.hooks=[]] Git-relative staged checks.
 * @returns {import("../../../contracts.js").ToolContribution} Proposed configuration and tool requirements.
 */
export default function render(project, { hooks = [] } = {}) {
  const commands = Object.fromEntries(
    hooks.map((item) => [
      item.id,
      {
        glob: item.glob,
        ...(item.root === "." ? {} : { root: item.root + "/" }),
        exclude: item.excludes,
        run: item.run,
      },
    ]),
  );
  // JSON is a YAML subset; Lefthook accepts it without an extra serializer dependency.
  return {
    files: { "lefthook.yml": json({ glob_matcher: "doublestar", "pre-commit": { parallel: false, commands } }) },
    npm: { lefthook: "^2.2.0" },
    scripts: { "hooks:install": "lefthook install" },
  };
}
