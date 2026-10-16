/**
 * Git Hook Integration Tests
 * @file Lefthook integration coverage for staged-file routing and package ownership.
 */

import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { temporary, put, read, generate } from "../helpers.js";

test("Lefthook routes real staged paths once to their owning packages", async (t) => {
  const root = await temporary(t);
  const initialized = spawnSync("git", ["init", "-q"], { cwd: root, encoding: "utf8" });

  assert.equal(initialized.status, 0, initialized.stderr);
  const children = ["plugins/a", "plugins/a/sub", "plugins/b"];

  for (const child of children) await put(root, child + "/package.json", { name: child.replaceAll("/", "-") });

  await generate(root, {
    project: "node",
    tools: ["eslint", "lefthook"],
    layout: "nested",
    packages: children.map((path) => ({ path })),
  });

  const expected = ["root file.js", "plugins/a/child.js", "plugins/a/sub/deep.js", "plugins/b/child.js"];

  for (const name of expected) await put(root, name, "// staged\n");

  const log = path.join(root, "checks.jsonl");

  for (const owner of [".", ...children]) {
    const executable = path.posix.join(owner, "node_modules/.bin/eslint");

    await put(
      root,
      executable,
      `#!/usr/bin/env node\nrequire('node:fs').appendFileSync(${JSON.stringify(log)}, JSON.stringify({ cwd: process.cwd(), files: process.argv.slice(2) }) + '\\n');\n`,
    );

    await fs.chmod(path.join(root, executable), 0o755);
  }

  const staged = spawnSync("git", ["add", "--", ...expected], { cwd: root, encoding: "utf8" });

  assert.equal(staged.status, 0, staged.stderr);
  const lefthook = fileURLToPath(new URL("../../node_modules/.bin/lefthook", import.meta.url));
  const checked = spawnSync(lefthook, ["run", "pre-commit", "--force"], { cwd: root, encoding: "utf8" });

  assert.equal(checked.status, 0, checked.stderr + checked.stdout);

  const checks = (await read(root, "checks.jsonl"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  const actual = checks.flatMap((check) =>
    check.files.map((file) => path.relative(root, path.resolve(check.cwd, file))),
  );

  assert.deepEqual(actual.sort(), expected.sort());
  assert.equal(checks.length, 4);
});
