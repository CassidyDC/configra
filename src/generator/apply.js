/**
 * @file Generation preflight, managed file writes, and optional dependency installation.
 */

import { read, write, hash, safePath } from "../platform/filesystem.js";
import { install as npmInstall } from "../platform/npm.js";
import { install as composerInstall } from "../platform/composer.js";

/**
 * @typedef {import("../contracts.js").GenerationPlan} GenerationPlan
 * @typedef {import("../contracts.js").ApplyOptions} ApplyOptions
 * @typedef {import("../contracts.js").ApplyResult} ApplyResult
 */

/**
 * Validate every precondition, write generation state last, and optionally install dependencies.
 *
 * @param {GenerationPlan} plan Complete proposal with captured file snapshots.
 * @param {ApplyOptions} [options={}] Conflict, installation, and adapter controls.
 * @returns {Promise<ApplyResult>} Applied paths and distinct write or installation failures.
 * @throws {Error} If conflicts are unresolved or project files changed before application.
 */
export async function apply(
  plan,
  { force = false, install = false, execute, writeFile = write, stdio = "inherit" } = {},
) {
  const result = { generated: false, applied: [], failed: [], installations: [] };

  if (plan.conflicts.length && !force)
    throw new Error(
      "Unresolved conflicts; no files were written. Resolve the listed entries or use --force to replace the conflicting generated content.",
    );

  for (const [name, snapshot] of Object.entries(plan.snapshots)) {
    await safePath(plan.root, name);

    if (hash(await read(plan.root, name)) !== snapshot)
      throw new Error(`Project changed after planning: ${name}. No files were written; run again.`);
  }

  for (const change of plan.changes) {
    try {
      await writeFile(plan.root, change.path, change.content);
      result.applied.push(change.path);
    } catch (error) {
      result.failed.push({ path: change.path, error: error.message });
      return result;
    }
  }

  result.generated = true;

  if (install) {
    for (const operation of plan.installations) {
      const runner = execute ?? (operation.ecosystem === "npm" ? npmInstall : composerInstall);
      let installed;

      try {
        installed = await runner(operation, { stdio });
      } catch (error) {
        installed = { ...operation, success: false, error: error.message };
      }

      result.installations.push(installed);

      if (!installed.success) result.failed.push({ ...installed, phase: "installation" });
    }
  }

  return result;
}
