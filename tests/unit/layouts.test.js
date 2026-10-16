/**
 * @file Layout coverage for package graphs, workspace delegation, hooks, and dependency ownership.
 */

import { load as yaml } from "js-yaml";
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import path from "node:path";
import { temporary, put, read, readJson, generate, proposal } from "../helpers.js";
import { packageGraph } from "../../src/generator/package-graph.js";

for (const project of ["wordpress-plugin", "wordpress-theme"]) {
  for (const layout of ["single", "nested", "workspaces"]) {
    test(`${project} works in ${layout} layout`, async (t) => {
      const root = await temporary(t);
      const child = "packages/example";

      await put(root, "package.json", {
        name: "root",
        private: true,
        workspaces: ["packages/*"],
        scripts: { test: "echo keep" },
      });

      await put(root, child + "/package.json", { name: "example" });
      const selection =
        layout === "single" ? { project } : { project: "wordpress-site", layout, packages: [{ path: child, project }] };

      await generate(root, selection);
      const prefix = layout === "single" ? "" : child + "/";

      assert.match(await read(root, prefix + "phpcs.xml.dist"), /WordPress/);
      const manifest = await readJson(root, "package.json");

      assert.deepEqual(manifest.workspaces, ["packages/*"]);
      assert.equal(manifest.scripts.test, "echo keep");

      if (layout !== "single") {
        assert.match(await read(root, "eslint.config.mjs"), /packages\/example\/\*\*/);
        assert.match(await read(root, ".prettierignore"), /packages\/example\/\*\*/);
        assert(!manifest.scripts["lint:local"].includes("--workspace"));
        assert.match(manifest.scripts.lint, layout === "nested" ? /--prefix/ : /--workspace/);
        assert.equal((await readJson(root, child + "/package.json")).scripts.lint, "npm run lint:local");
      }

      assert.equal((await proposal(root, selection)).changes.length, 0);
    });
  }
}

test("workspace registration is required and discovery never selects packages automatically", async (t) => {
  const root = await temporary(t);

  await put(root, "packages/example/package.json", { name: "child" });
  const graph = await packageGraph(root, { layout: "single", packages: [] });

  assert(graph.candidates.some((item) => item.path === "packages/example"));
  assert.equal(graph.packages.length, 1);
  await assert.rejects(
    proposal(root, { layout: "workspaces", packages: [{ path: "packages/example" }] }),
    /not a registered npm workspace/,
  );
});

test("nested package graph tracks nearest selected parents", async (t) => {
  const root = await temporary(t);

  for (const child of ["packages/a", "packages/a/sub", "packages/b"]) await put(root, child + "/package.json", {});

  const graph = await packageGraph(root, {
    layout: "nested",
    packages: [{ path: "packages/a" }, { path: "packages/b" }, { path: "packages/a/sub" }],
  });
  assert.equal(graph.packages.find((item) => item.path === "packages/a/sub").parent, "packages/a");
});

test("root hooks route staged files by package ownership", async (t) => {
  const root = await temporary(t);

  await fs.mkdir(path.join(root, ".git"));
  await put(root, "plugins/child/package.json", {});
  await generate(root, {
    project: "wordpress-site",
    layout: "nested",
    packages: [{ path: "plugins/child", project: "wordpress-plugin" }],
  });

  const hooks = yaml(await read(root, "lefthook.yml"))["pre-commit"].commands;

  assert(hooks[".:eslint"].exclude.includes("plugins/child/**"));
  assert.equal(hooks["plugins/child:eslint"].root, "plugins/child/");
  assert(hooks["plugins/child:eslint"].glob[0].startsWith("plugins/child/"));
  await assert.rejects(read(root, "plugins/child/lefthook.yml"), { code: "ENOENT" });
});

test("Git boundary is distinct from package boundary", async (t) => {
  const root = await temporary(t);
  await fs.mkdir(path.join(root, ".git"));
  await put(root, "child/package.json", {});
  const child = path.join(root, "child");
  const planned = await proposal(child);
  assert(planned.diagnostics.some((message) => message.includes("Git root")));
  assert(!planned.changes.some((item) => item.path === "lefthook.yml"));
  await fs.mkdir(path.join(child, ".git"));
  await assert.rejects(proposal(root, { layout: "nested", packages: [{ path: "child" }] }), /crosses a Git boundary/);
});

test("local checks exclude independent Git repositories and analysis caches", async (t) => {
  const root = await temporary(t);

  await put(root, "foreign/.git/HEAD", "ref: refs/heads/main\n");
  await put(root, "foreign/package.json", { name: "foreign" });
  const planned = await proposal(root, { project: "wordpress-site" });

  for (const name of ["eslint.config.mjs", ".prettierignore", "phpcs.xml.dist", "phpstan.neon.dist"]) {
    assert(planned.changes.find((item) => item.path === name).content.includes("foreign/"), name);
  }

  const manifest = JSON.parse(planned.changes.find((item) => item.path === "package.json").content);

  assert.match(manifest.scripts["lint:php:syntax"], /--exclude 'foreign'/);
  assert(planned.changes.find((item) => item.path === "phpstan.neon.dist").content.includes(".phpstan-cache"));
});

test("npm installation commands stay scoped to selected package owners", async (t) => {
  const root = await temporary(t);
  await put(root, "package.json", { name: "root", workspaces: ["packages/*"] });
  await put(root, "packages/selected/package.json", { name: "selected" });
  const planned = await proposal(root, { layout: "workspaces", packages: [{ path: "packages/selected" }] });
  assert.deepEqual(planned.installations[0].args, ["install", "--workspaces=false"]);
  assert.deepEqual(planned.installations[1].args, ["install", "--workspace=selected"]);
  assert(planned.installations.every((operation) => operation.cwd === root));
});

test("workspace registration respects exclusions and later explicit inclusion", async (t) => {
  const root = await temporary(t);
  await put(root, "package.json", { name: "root", workspaces: ["./packages/*", "!packages/skip"] });
  await put(root, "packages/skip/package.json", { name: "skip" });
  const selection = { layout: "workspaces", packages: [{ path: "packages/skip" }] };
  await assert.rejects(proposal(root, selection), /not a registered npm workspace/);
  await put(root, "package.json", { name: "root", workspaces: ["./packages/*", "!packages/skip", "packages/skip"] });
  assert.equal((await proposal(root, selection)).conflicts.length, 0);
});
