import { readJson } from "../../platform/filesystem.js";
import { generate } from "./generate.js";

/**
 * @typedef {import("../../contracts.js").ProjectInput} ProjectInput
 * @typedef {import("../../contracts.js").CommandOptions} CommandOptions
 * @typedef {import("../../contracts.js").CliIO} CliIO
 */

/**
 * Merge explicit overrides with saved selections and run the generation workflow.
 *
 * @param {string} root Existing absolute project directory.
 * @param {ProjectInput} selections Input selections or update overrides.
 * @param {CommandOptions} options Non-persisted workflow controls.
 * @param {CliIO} io Output callbacks.
 * @returns {Promise<number>} CLI completion status.
 * @throws {Error} If saved selections are absent or invalid.
 */
export async function update(root, selections, options, io) {
  const saved = await readJson(root, ".cassidydc-toolset.json");
  if (!saved) throw new Error("No saved selections; run cdctool init first");
  return generate(
    root,
    {
      ...saved,
      ...selections,
      ...(saved.standards || selections.standards
        ? { standards: { ...saved.standards, ...selections.standards } }
        : {}),
    },
    options,
    io,
  );
}
