/**
 * Composer Dependency Installation
 * @file Composer dependency operation planning and execution for selected PHP packages.
 */

import path from "node:path";
import { execute } from "./process.js";

/**
 * @typedef {import("../contracts.js").InstallationOperation} InstallationOperation
 * @typedef {typeof import("./process.js").execute} ProcessRunner
 */

/**
 * Prepare a Composer update in the package declaring PHP development dependencies.
 *
 * @param {string} root Absolute project root.
 * @param {string} packagePath Project-relative dependency owner.
 * @returns {InstallationOperation} Prepared Composer operation; no process is executed.
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
 * @type {ProcessRunner}
 */
export const install = execute;
