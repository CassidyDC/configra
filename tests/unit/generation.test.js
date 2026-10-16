import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import path from "node:path";
import { apply } from "../../src/generator/apply.js";
import { temporary, put, read, readJson, proposal, generate } from "../helpers.js";

/**
 * Shared standalone WordPress plugin selection used by generation tests.
 *
 * @type {import("../../src/contracts.js").ProjectInput}
 */
const plugin = { project: "wordpress-plugin" };

test("standalone plugin generates self-contained files and repeat generation has no changes", async (t) => {
  const root = await temporary(t);
  const { result } = await generate(root, plugin);
  assert(result.generated);
  assert.match(await read(root, "phpcs.xml.dist"), /ref="WordPress"/);
  assert.match(await read(root, "eslint.config.mjs"), /wordpress.configs.recommended/);
  assert.equal((await readJson(root, "package.json")).devDependencies["@wordpress/eslint-plugin"], "^27.1.0");
  assert.equal((await proposal(root, plugin)).changes.length, 0);
});

test("planning and conflicts make no project writes", async (t) => {
  const root = await temporary(t);
  await put(root, ".editorconfig", "# custom editor settings\n");
  const planned = await proposal(root, plugin);
  assert(planned.conflicts.some((item) => item.path === ".editorconfig"));
  await assert.rejects(apply(planned), /Unresolved conflicts/);
  assert.deepEqual(await fs.readdir(root), [".editorconfig"]);
});

test("updates preserve edited files and unrelated manifest content", async (t) => {
  const root = await temporary(t);
  await fs.cp(new URL("../fixtures/wordpress-plugin/", import.meta.url), root, { recursive: true });
  await generate(root, plugin);
  const manifest = await readJson(root, "package.json");
  assert.equal(manifest.version, "1.2.3");
  assert.equal(manifest.scripts.test, "echo keep-test");
  assert.deepEqual(manifest.custom, { keep: true });
  assert.equal(manifest.dependencies["existing-package"], "^1.0.0");
  await fs.appendFile(path.join(root, "eslint.config.mjs"), "// user override\n");
  const planned = await proposal(root, { ...plugin, standards: { javascript: "community" } });
  assert(planned.conflicts.some((item) => item.path === "eslint.config.mjs"));
  await assert.rejects(apply(planned));
  assert.match(await read(root, "eslint.config.mjs"), /user override/);
  await apply(planned, { force: true });
  assert.equal((await readJson(root, "package.json")).scripts.test, "echo keep-test");
});

test("modified and deleted generated scripts require resolution", async (t) => {
  const root = await temporary(t);
  await generate(root, plugin);
  const manifest = await readJson(root, "package.json");
  manifest.scripts["lint:js"] = "echo custom";
  delete manifest.scripts["lint:css"];
  await put(root, "package.json", manifest);
  const planned = await proposal(root, plugin);
  assert(planned.conflicts.some((item) => item.reason.includes("lint:js")));
  assert(planned.conflicts.some((item) => item.reason.includes("lint:css")));
});

test("gitignore and VS Code contributions preserve unrelated entries", async (t) => {
  const root = await temporary(t);
  await put(root, ".gitignore", "# mine\nlogs/\nnode_modules/\n");
  await put(root, ".vscode/settings.json", { "editor.fontSize": 16, "[javascript]": { "editor.wordWrap": "on" } });
  await put(root, ".vscode/extensions.json", { recommendations: ["custom.extension", "editorconfig.editorconfig"] });
  await generate(root, plugin);
  assert.match(await read(root, ".gitignore"), /^# mine\nlogs\/\nnode_modules\//);
  assert.equal((await readJson(root, ".vscode/settings.json"))["[javascript]"]["editor.wordWrap"], "on");
  const planned = await proposal(root, plugin);
  assert.equal(planned.changes.length, 0);
  await generate(root, { ...plugin, tools: [] });
  assert.match(await read(root, ".gitignore"), /node_modules/);
  assert.deepEqual((await readJson(root, ".vscode/extensions.json")).recommendations, [
    "custom.extension",
    "editorconfig.editorconfig",
  ]);
});

test("application rejects files changed since planning before any writes", async (t) => {
  const root = await temporary(t);
  const planned = await proposal(root, plugin);
  await put(root, "package.json", { name: "concurrently-created" });
  await assert.rejects(apply(planned), /Project changed after planning/);
  assert.deepEqual(await fs.readdir(root), ["package.json"]);
});

test("symbolic links cannot escape the selected boundary", async (t) => {
  const root = await temporary(t);
  const outside = await temporary(t);
  await fs.symlink(outside, path.join(root, ".vscode"));
  await assert.rejects(proposal(root, plugin), /symbolic link/);
  assert.deepEqual(await fs.readdir(outside), []);
});

test("installation failure is separate from successful generation", async (t) => {
  const root = await temporary(t);
  const planned = await proposal(root, plugin);
  const result = await apply(planned, {
    install: true,
    execute: async (operation) => ({ ...operation, success: false, code: 7 }),
  });
  assert(result.generated);
  assert.equal(result.failed[0].phase, "installation");
  assert.equal(result.installations.length, 2);
  assert(await read(root, ".cassidydc-toolset-state.json"));
});

test("unrequested installations never execute", async (t) => {
  const root = await temporary(t);
  let called = false;
  const result = await apply(await proposal(root), {
    execute: () => {
      called = true;
    },
  });
  assert(result.generated);
  assert.equal(called, false);
});

test("deselection removes unchanged generated output while preserving user data", async (t) => {
  const root = await temporary(t);
  await generate(root, plugin);
  await generate(root, { ...plugin, tools: ["editorconfig"] });
  await assert.rejects(read(root, "eslint.config.mjs"), { code: "ENOENT" });
  assert.equal((await readJson(root, "package.json")).name, path.basename(root).toLowerCase());
  assert.deepEqual((await readJson(root, "package.json")).scripts, {});
});

test("new output already matches the generated formatter configuration", async (t) => {
  const { check, resolveConfig } = await import("prettier");
  for (const selection of [
    { project: "node" },
    { ...plugin, standards: { javascript: "community", php: "community" } },
  ]) {
    const root = await temporary(t);
    const { planned } = await generate(root, selection);
    for (const change of planned.changes.filter(
      (item) => /\.(?:[cm]?js|jsonc?|ya?ml)$/.test(item.path) && item.path !== ".cassidydc-toolset-state.json",
    )) {
      const filename = path.join(root, change.path);
      assert(
        await check(await read(root, change.path), { ...(await resolveConfig(filename)), filepath: filename }),
        change.path,
      );
    }
  }
});

test("a write failure reports partial progress without recording successful state", async (t) => {
  const root = await temporary(t);
  const planned = await proposal(root, { tools: ["editorconfig"] });
  const { write } = await import("../../src/platform/filesystem.js");
  const second = planned.changes[1].path;
  let writes = 0;
  const result = await apply(planned, {
    writeFile: async (...args) => {
      if (++writes === 2) throw new Error("Simulated disk failure");
      return write(...args);
    },
  });
  assert.equal(result.generated, false);
  assert.deepEqual(result.applied, [".editorconfig"]);
  assert.equal(result.failed[0].path, second);
  await assert.rejects(read(root, ".cassidydc-toolset-state.json"), { code: "ENOENT" });
});

test("competing active configuration is reported before explicit replacement", async (t) => {
  const root = await temporary(t);
  await put(root, "eslint.config.js", "export default [];\n");
  const planned = await proposal(root, { tools: ["eslint"] });
  assert(planned.conflicts.some((item) => item.path === "eslint.config.js"));
  await assert.rejects(apply(planned));
  assert.deepEqual(await fs.readdir(root), ["eslint.config.js"]);
  await apply(planned, { force: true });
  await assert.rejects(read(root, "eslint.config.js"), { code: "ENOENT" });
  assert.match(await read(root, "eslint.config.mjs"), /defineConfig/);
  assert.equal((await proposal(root, { tools: ["eslint"] })).changes.length, 0);
});
