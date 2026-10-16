import path from "node:path";
import { execute } from "./process.js";

/**
 * Prepare a Composer update in the package declaring PHP development dependencies.
 *
 * @param {string} root Absolute project root.
 * @param {string} packagePath Project-relative dependency owner.
 * @returns {import("../contracts.js").InstallationOperation} Prepared Composer operation; no process is executed.
 */
export function installation(root, packagePath) {
  return {
    ecosystem: "composer",
    package: packagePath,
    command: "composer",
    args: ["update", "--no-interaction"],
    cwd: path.resolve(root, packagePath),
  };
}
/**
 * Execute a prepared composer operation through the shared process adapter.
 *
 * @type {typeof import("./process.js").execute}
 */
export const install = execute;
