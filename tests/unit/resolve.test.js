import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRequest, resolve } from "../../src/generator/resolve.js";
import { temporary, put } from "../helpers.js";
import { packageGraph } from "../../src/generator/package-graph.js";

/**
 * Create selected child manifests and resolve a request against its discovered package graph.
 *
 * @param {import("node:test").TestContext} t Owning test context.
 * @param {import("../../src/contracts.js").ProjectInput} input Selections under test.
 * @returns {Promise<import("../../src/contracts.js").ResolvedProject>} Effective settings for assertions.
 */
async function resolved(t, input) {
  const root = await temporary(t);
  const request = normalizeRequest(input);
  for (const child of request.packages)
    await put(root, child.path + "/package.json", { name: child.path.replaceAll("/", "-") });
  return resolve(request, await packageGraph(root, request));
}

test("WordPress environment supports community standards by language", async (t) => {
  const result = await resolved(t, {
    project: "wordpress-plugin",
    standards: { javascript: "community", php: "community" },
  });
  assert.equal(result.packages[0].environment, "wordpress");
  assert.equal(result.packages[0].standards.javascript.baseline, "ESLint recommended");
  assert.equal(result.packages[0].standards.css.id, "wordpress");
  assert.equal(result.packages[0].languageFormatting.php.indentSize, 4);
  assert.equal(result.packages[0].languageFormatting.php.indentStyle, "space");
});

test("child selections inherit standards and support language-specific overrides", async (t) => {
  const result = await resolved(t, {
    project: "wordpress-site",
    layout: "nested",
    standards: { javascript: "community" },
    packages: [
      { path: "plugins/example", project: "wordpress-plugin", standards: { php: "community" } },
      { path: "plugins/example/packages/nested", project: "php", languages: ["php"] },
    ],
  });
  assert.equal(result.packages[1].standards.javascript.id, "community");
  assert.equal(result.packages[1].standards.php.id, "community");
  assert.equal(result.packages[2].standards.php.id, "community");
  assert.deepEqual(result.packages[2].languages, ["php"]);
  assert(!result.packages[2].tools.includes("eslint"));
});

test("capabilities compose without selecting a bundler", async (t) => {
  const result = await resolved(t, { project: "wordpress-theme", capabilities: ["react", "typescript"] });
  assert.deepEqual(result.packages[0].capabilities, ["react", "typescript"]);
  assert(!result.packages[0].tools.includes("webpack"));
});

test("unsupported selections and inconsistent formatting are rejected", async (t) => {
  for (const input of [
    { project: "unknown" },
    { languages: ["javascript"], standards: { php: "wordpress" } },
    { project: "python", capabilities: ["react"] },
    { languages: ["css"], tools: ["eslint"] },
    { project: "php", formatting: { indentSize: 2 } },
    { project: "python", standards: { python: "wordpress" } },
  ])
    await assert.rejects(resolved(t, input));
  assert.throws(() => normalizeRequest({ packages: ["../escape"], layout: "nested" }));
  assert.throws(() => normalizeRequest({ packages: ["child"] }));
  assert.throws(() => normalizeRequest({ version: 2 }));
});

test("a different child project keeps its default tool integrations", async (t) => {
  const result = await resolved(t, {
    project: "node",
    layout: "nested",
    packages: [{ path: "plugin", project: "wordpress-plugin" }],
  });
  assert(result.packages[1].tools.includes("phpcs"));
  assert(result.packages[1].tools.includes("stylelint"));
  const explicit = await resolved(t, {
    project: "node",
    tools: ["editorconfig"],
    layout: "nested",
    packages: [{ path: "plugin", project: "wordpress-plugin" }],
  });
  assert.deepEqual(explicit.packages[1].tools, ["editorconfig"]);
});

test("child formatting overrides merge with inherited explicit choices", async (t) => {
  const result = await resolved(t, {
    project: "node",
    layout: "nested",
    formatting: { printWidth: 120 },
    packages: [{ path: "child", formatting: { indentSize: 4 } }],
  });
  assert.equal(result.packages[1].formatting.printWidth, 120);
  assert.equal(result.packages[1].formatting.indentSize, 4);
});

test("invalid selection shapes and incompatible WordPress PHP formatting are rejected", async (t) => {
  for (const input of [
    { languages: [] },
    { standards: "community" },
    { formatting: [] },
    { formatting: { unknown: true } },
    { project: "wordpress-plugin", formatting: { indentStyle: "space" } },
  ])
    await assert.rejects(resolved(t, input));
  assert.throws(() => normalizeRequest({ typo: true }), /Unknown selection/);
});
