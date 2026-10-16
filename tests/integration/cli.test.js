import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import * as fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { temporary, put, read, readJson } from "../helpers.js";

/**
 * @typedef {import("node:child_process").SpawnSyncReturns<string>} CliProcessResult
 */

/**
 * Absolute executable path used by CLI subprocess integration tests.
 *
 * @constant {string}
 */
const executable = fileURLToPath(new URL("../../bin/cdctool.js", import.meta.url));

/**
 * Run the packaged CLI entry point against an isolated project directory.
 *
 * @param {string} root Absolute fixture project root.
 * @param {...string} args CLI command and options before the fixture directory flag.
 * @returns {CliProcessResult} Captured process output and completion status.
 */
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

for (const layout of ["nested", "workspaces"]) {
  test(`${layout} aggregate command visits each selected package once`, async (t) => {
    const root = await temporary(t);
    const children = ["packages/a", "packages/b", "packages/a/sub"];

    await put(root, "package.json", { name: "root", private: true, workspaces: ["packages/*", "packages/a/sub"] });

    for (const child of [...children, "packages/unselected"])
      await put(root, `${child}/package.json`, { name: child.replaceAll("/", "-") });

    const args = [
      "init",
      "--project",
      "node",
      "--tools",
      "markdownlint",
      "--layout",
      layout,
      "--package",
      children[0],
      "--package",
      children[1],
      "--package",
      children[2],
    ];

    const generated = run(root, ...args);

    assert.equal(generated.status, 0, generated.stderr);
    const log = path.join(root, "visits.jsonl");

    for (const owner of [".", ...children]) {
      const manifest = await readJson(root, path.posix.join(owner, "package.json"));

      manifest.scripts["lint:markdown"] = "node record.cjs";
      await put(root, path.posix.join(owner, "package.json"), manifest);
      await put(
        root,
        path.posix.join(owner, "record.cjs"),
        `require('node:fs').appendFileSync(${JSON.stringify(log)}, JSON.stringify(${JSON.stringify(owner)}) + '\\n');\n`,
      );
    }

    const aggregate = spawnSync("npm", ["run", "lint"], { cwd: root, encoding: "utf8" });

    assert.equal(aggregate.status, 0, aggregate.stderr + aggregate.stdout);

    const visits = (await read(root, "visits.jsonl"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.deepEqual(visits.sort(), [".", ...children].sort());
  });
}

test("root-local ESLint skips selected child files", async (t) => {
  const root = await temporary(t);

  await put(root, "child/package.json", { name: "child" });
  const generated = run(root, "init", "--tools", "eslint", "--layout", "nested", "--package", "child");

  assert.equal(generated.status, 0, generated.stderr);
  await fs.symlink(fileURLToPath(new URL("../../node_modules", import.meta.url)), path.join(root, "node_modules"));
  await put(root, "root.js", "export const value = 1;\n");
  await put(root, "child/failing.js", "missingGlobal();\n");
  const eslint = fileURLToPath(new URL("../../node_modules/eslint/bin/eslint.js", import.meta.url));
  const local = spawnSync(process.execPath, [eslint, "."], { cwd: root, encoding: "utf8" });

  assert.equal(local.status, 0, local.stderr + local.stdout);
  const child = spawnSync(process.execPath, [eslint, "."], { cwd: path.join(root, "child"), encoding: "utf8" });

  assert.equal(child.status, 1);
  assert.match(child.stdout, /missingGlobal/);
});

test("JSON application output distinguishes the plan from its result", async (t) => {
  const root = await temporary(t);
  const result = run(root, "init", "--json", "--tools", "editorconfig");

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);

  assert(output.changes.length > 0);
  assert.equal(output.result.generated, true);
  assert.equal(output.result.applied.length, output.changes.length);
});

test("real process failures remain machine-readable after successful generation", async (t) => {
  for (const [project, tool, command] of [
    ["node", "eslint", "npm"],
    ["php", "phpcs", "composer"],
  ]) {
    const root = await temporary(t);
    const commands = await temporary(t);

    await put(
      commands,
      command,
      `#!${process.execPath}\nconsole.log('simulated ${command} failure'); process.exitCode = 7;\n`,
    );

    await fs.chmod(path.join(commands, command), 0o755);

    const result = spawnSync(
      process.execPath,
      [executable, "init", "--cwd", root, "--project", project, "--tools", tool, "--install", "--json"],
      { encoding: "utf8", env: { ...process.env, PATH: commands + path.delimiter + process.env.PATH } },
    );

    assert.equal(result.status, 1, result.stderr);
    const output = JSON.parse(result.stdout);

    assert.equal(output.result.generated, true);
    assert.equal(output.result.failed[0].phase, "installation");
    assert.equal(output.result.installations[0].code, 7);
    assert.match(result.stderr, new RegExp(`simulated ${command} failure`));
    assert(await read(root, ".cassidydc-toolset-state.json"));
  }
});
