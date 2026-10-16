import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import * as fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { temporary, put, read, readJson } from "../helpers.js";

const executable = fileURLToPath(new URL("../../bin/cdctool.js", import.meta.url));
const run = (root, ...args) => spawnSync(process.execPath, [executable, ...args, "--cwd", root], { encoding: "utf8" });

test("CLI init, saved update, and dry run are reproducible", async (t) => {
  const root = await temporary(t);
  let result = run(root, "init", "--project", "wordpress-plugin", "--dry-run", "--json", "--install");
  assert.equal(result.status, 0, result.stderr);
  assert(JSON.parse(result.stdout).changes.length > 0);
  assert.deepEqual(await fs.readdir(root), []);
  result = run(root, "init", "--project", "wordpress-plugin");
  assert.equal(result.status, 0, result.stderr);
  result = run(root, "update", "--dry-run", "--json");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).changes.length, 0);
});

test("config and argument selections produce equivalent requests", async (t) => {
  const root = await temporary(t);
  await put(root, "selections.json", {
    project: "wordpress-plugin",
    languages: ["javascript", "php"],
    standards: { javascript: "community" },
    capabilities: ["react", "typescript"],
    tools: ["editorconfig", "eslint"],
  });
  const config = run(root, "init", "--config", "selections.json", "--dry-run", "--json");
  const flags = run(
    root,
    "init",
    "--project",
    "wordpress-plugin",
    "--languages",
    "javascript,php",
    "--standard",
    "javascript=community",
    "--capabilities",
    "react,typescript",
    "--tools",
    "editorconfig,eslint",
    "--dry-run",
    "--json",
  );
  assert.equal(config.status, 0, config.stderr);
  assert.equal(flags.status, 0, flags.stderr);
  assert.deepEqual(JSON.parse(config.stdout).request, JSON.parse(flags.stdout).request);
});

test("CLI conflicts return failure without writes; explicit force resolves them", async (t) => {
  const root = await temporary(t);
  await put(root, ".editorconfig", "custom\n");
  assert.equal(run(root, "init").status, 1);
  assert.deepEqual(await fs.readdir(root), [".editorconfig"]);
  assert.equal(run(root, "init", "--dry-run").status, 2);
  assert.equal(run(root, "init", "--force").status, 0);
  assert.match(await read(root, ".editorconfig"), /root = true/);
});

test("invalid CLI selections and missing update state have readable errors", async (t) => {
  const root = await temporary(t);
  for (const args of [
    ["update"],
    ["init", "--project", "bogus"],
    ["init", "--standard", "invalid"],
    ["init", "--interactive"],
    ["init", "--unknown"],
  ]) {
    const result = run(root, ...args);
    assert.equal(result.status, 1);
    assert(result.stderr.trim());
    assert(!result.stderr.includes("at file:"));
  }
  assert.deepEqual(await fs.readdir(root), []);
});

test("generated ESLint configuration executes in CommonJS and ESM consumers", async (t) => {
  for (const type of ["commonjs", "module"]) {
    const root = await temporary(t);
    await put(root, "package.json", { name: "consumer", type });
    const result = run(root, "init", "--project", "node", "--tools", "eslint,editorconfig");
    assert.equal(result.status, 0, result.stderr);
    await fs.symlink(fileURLToPath(new URL("../../node_modules", import.meta.url)), path.join(root, "node_modules"));
    await put(root, "example.js", type === "module" ? "export const value = 1;\n" : "module.exports = 1;\n");
    const lint = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("../../node_modules/eslint/bin/eslint.js", import.meta.url)), "example.js"],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(lint.status, 0, lint.stderr + lint.stdout);
    assert.equal((await readJson(root, "package.json")).type, type);
  }
});
