import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { temporary, put, read } from "../helpers.js";

/**
 * Absolute repository root used to pack the distributable npm artifact.
 *
 * @constant {string}
 */
const repository = fileURLToPath(new URL("../../", import.meta.url));

test("packed npm artifact runs independently and locates module-relative templates", async (t) => {
  const destination = await temporary(t);
  const cache = path.join(destination, "cache");
  const pack = spawnSync(
    "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", destination, "--cache", cache],
    { cwd: repository, encoding: "utf8" },
  );
  assert.equal(pack.status, 0, pack.stderr);
  const packed = JSON.parse(pack.stdout);
  const artifact = Array.isArray(packed) ? packed[0] : Object.values(packed)[0];
  assert(artifact.files.some((entry) => entry.path === "bin/cdctool.js"));
  assert(artifact.files.some((entry) => entry.path === "src/components/tools/webpack/templates/webpack.config.mjs"));
  assert(!artifact.files.some((entry) => entry.path.startsWith("docs/reference/")));
  const dependencyPack = spawnSync(
    "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", destination, "--cache", cache],
    { cwd: path.join(repository, "node_modules/prettier"), encoding: "utf8" },
  );
  assert.equal(dependencyPack.status, 0, dependencyPack.stderr);
  const dependencies = JSON.parse(dependencyPack.stdout);
  const prettier = Array.isArray(dependencies) ? dependencies[0] : Object.values(dependencies)[0];
  const consumer = await temporary(t);
  await put(consumer, "package.json", { name: "packed-consumer", private: true });
  const install = spawnSync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--offline",
      "--no-audit",
      "--no-fund",
      "--cache",
      cache,
      path.join(destination, artifact.filename),
      path.join(destination, prettier.filename),
    ],
    { cwd: consumer, encoding: "utf8" },
  );
  assert.equal(install.status, 0, install.stderr);
  const executable = path.join(consumer, "node_modules/@cassidydc/cassidydc-toolset/bin/cdctool.js");
  const project = await temporary(t);
  const generate = spawnSync(
    process.execPath,
    [
      executable,
      "init",
      "--cwd",
      project,
      "--project",
      "node",
      "--tools",
      "webpack",
      "--capabilities",
      "typescript,react",
    ],
    { cwd: consumer, encoding: "utf8" },
  );
  assert.equal(generate.status, 0, generate.stderr);
  assert.match(await read(project, "webpack.config.mjs"), /src\/index\.tsx/);
  assert(!(await read(project, "webpack.config.mjs")).includes("__PRESETS__"));
});
