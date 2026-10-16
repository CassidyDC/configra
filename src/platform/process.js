/**
 * @file Shell-free process execution and shell-argument quoting for generated scripts.
 */

import { spawn } from "node:child_process";

/**
 * @typedef {import("../contracts.js").InstallationOperation} InstallationOperation
 * @typedef {import("../contracts.js").ProcessOptions} ProcessOptions
 * @typedef {import("../contracts.js").InstallationResult} InstallationResult
 */

/**
 * Execute a dependency operation without a shell and report spawn or exit failures as results.
 *
 * @param {InstallationOperation} operation Prepared executable, arguments, and working directory.
 * @param {ProcessOptions} [options={}] Child-process output routing.
 * @returns {Promise<InstallationResult>} Completion status with operation context.
 */
export function execute(operation, { stdio = "inherit" } = {}) {
  return new Promise((resolve) => {
    const child = spawn(operation.command, operation.args, { cwd: operation.cwd, stdio, shell: false });
    child.once("error", (error) => resolve({ ...operation, success: false, error: error.message }));
    child.once("close", (code, signal) => resolve({ ...operation, success: code === 0, code, signal }));
  });
}

/**
 * Quote a value as one POSIX shell argument, including embedded apostrophes.
 *
 * @param {unknown} value Value converted to text before quoting.
 * @returns {string} Single-quoted, shell-safe argument.
 */
export const quote = (value) => "'" + String(value).replaceAll("'", "'\"'\"'") + "'";
