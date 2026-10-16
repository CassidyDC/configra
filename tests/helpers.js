import * as fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { normalizeRequest, resolve } from "../src/generator/resolve.js";
import { packageGraph } from "../src/generator/package-graph.js";
import { plan } from "../src/generator/plan.js";
import { apply } from "../src/generator/apply.js";

export async function temporary(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "cdctool-test-")));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
export async function put(root, name, content) {
  await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
  await fs.writeFile(
    path.join(root, name),
    typeof content === "string" ? content : JSON.stringify(content, null, 2) + "\n",
  );
}
export const read = (root, name) => fs.readFile(path.join(root, name), "utf8");
export const readJson = async (root, name) => JSON.parse(await read(root, name));
export async function proposal(root, input = {}) {
  const request = normalizeRequest(input);
  return plan(resolve(request, await packageGraph(root, request)));
}
export async function generate(root, input = {}, options = {}) {
  const planned = await proposal(root, input);
  return { planned, result: await apply(planned, options) };
}
