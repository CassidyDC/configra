import * as fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { normalizeRequest, resolve } from "../src/generator/resolve.js";
import { packageGraph } from "../src/generator/package-graph.js";
import { plan } from "../src/generator/plan.js";
import { apply } from "../src/generator/apply.js";

/**
 * Create a canonical temporary project and register cleanup with the test context.
 *
 * @param {import("node:test").TestContext} t Owning test context.
 * @returns {Promise<string>} Canonical absolute temporary directory.
 */
export async function temporary(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "cdctool-test-")));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
/**
 * Create a fixture file, serializing non-string content as JSON.
 *
 * @param {string} root Absolute fixture root.
 * @param {string} name Fixture-relative filename.
 * @param {unknown} content Literal text or a JSON-serializable value.
 * @returns {Promise<void>} Completes after the fixture has been written.
 */
export async function put(root, name, content) {
  await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
  await fs.writeFile(
    path.join(root, name),
    typeof content === "string" ? content : JSON.stringify(content, null, 2) + "\n",
  );
}
/**
 * Read a fixture file as UTF-8 text.
 *
 * @param {string} root Absolute fixture root.
 * @param {string} name Fixture-relative filename.
 * @returns {Promise<string>} File content.
 */
export const read = (root, name) => fs.readFile(path.join(root, name), "utf8");
/**
 * Read and parse a fixture JSON file.
 *
 * @param {string} root Absolute fixture root.
 * @param {string} name Fixture-relative filename.
 * @returns {Promise<import("../src/contracts.js").JsonValue>} Parsed fixture value.
 */
export const readJson = async (root, name) => JSON.parse(await read(root, name));
/**
 * Build a complete generation proposal for an isolated fixture project.
 *
 * @param {string} root Absolute fixture project root.
 * @param {import("../src/contracts.js").ProjectInput} [input={}] Project selections.
 * @returns {Promise<import("../src/contracts.js").GenerationPlan>} Proposal without applying writes.
 */
export async function proposal(root, input = {}) {
  const request = normalizeRequest(input);
  return plan(resolve(request, await packageGraph(root, request)));
}
/**
 * Plan and apply generation to an isolated fixture project.
 *
 * @param {string} root Absolute fixture project root.
 * @param {import("../src/contracts.js").ProjectInput} [input={}] Project selections.
 * @param {import("../src/contracts.js").ApplyOptions} [options={}] Application controls and adapter overrides.
 * @returns {Promise<{planned: import("../src/contracts.js").GenerationPlan, result: import("../src/contracts.js").ApplyResult}>} Proposal and application result.
 */
export async function generate(root, input = {}, options = {}) {
  const planned = await proposal(root, input);
  return { planned, result: await apply(planned, options) };
}
