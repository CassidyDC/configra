import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Value } from "typebox/value";
import { describe, expect, it } from "vitest";
import { parseCliArgs, type ParsedArgs } from "../../src/cli/args.js";
import { planWorkflow } from "../../src/cli/commands/workflow.js";
import { readVersion } from "../../src/cli/version.js";
import type { Plan } from "../../src/generator/plan.js";
import { outputSchema } from "../../src/generator/state/schemas.js";
import { fakeRunner, runCli, runJson, tempProject } from "../helpers.js";

/**
 * Plans in-process and returns the internal plan, including file contents.
 */
function planFor(argv: string[], root: string): Plan {
  const parsed = parseCliArgs(argv);

  expect(parsed.ok).toBe(true);

  const result = planWorkflow((parsed.args as ParsedArgs).command ?? "init", parsed.args as ParsedArgs, {
    cwd: root,
    version: readVersion(),
    runner: fakeRunner,
    interactive: false,
  });

  expect(result.document.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);

  return result.plan as Plan;
}

/**
 * Returns the planned content of one file.
 */
function contentOf(plan: Plan, path: string): string {
  const write = plan.writes.find((candidate) => candidate.path === path);

  expect(write, `${path} is planned`).toBeDefined();

  return write?.content ?? "";
}

/**
 * Writes a plan's files to disk, standing in for the apply phase.
 */
function applyWrites(root: string, plan: Plan): void {
  for (const write of plan.writes) {
    const target = join(root, write.path);

    if (write.content === null) {
      rmSync(target, { force: true });
    } else {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, write.content);
    }
  }
}

/**
 * Lists every file under a directory, for read-only checks.
 */
function listTree(root: string): string[] {
  return readdirSync(root, { recursive: true, encoding: "utf8" }).sort();
}

describe("dry-run planning", () => {
  it("plans a fresh Node.js project as one valid JSON document without prompting or writing", async () => {
    const root = tempProject();
    const { code, document, stderr } = await runJson(["init", "--dry-run"], root);

    expect(code).toBe(0);
    expect(stderr).toBe("");
    expect(Value.Check(outputSchema, document)).toBe(true);
    expect(document.status).toBe("changes");
    expect(document.changes.map((change) => change.path)).toEqual([
      ".configra/config.json",
      ".configra/eslint.js",
      ".configra/markdownlint-cli2.js",
      ".configra/prettier.js",
      ".configra/scripts/commit-msg.js",
      ".configra/state.json",
      ".editorconfig",
      ".gitignore",
      ".markdownlint-cli2.mjs",
      ".prettierignore",
      "eslint.config.js",
      "lefthook-project.yml",
      "lefthook.yml",
      "package.json",
      "prettier.config.js",
    ]);
    expect(listTree(root)).toEqual([]);
  });

  it.each([
    { languages: "javascript", ui: "", ts: false, react: false },
    { languages: "typescript", ui: "", ts: true, react: false },
    { languages: "javascript,typescript", ui: "", ts: true, react: false },
    { languages: "javascript", ui: "react", ts: false, react: true },
    { languages: "typescript", ui: "react", ts: true, react: true },
    { languages: "javascript,typescript", ui: "react", ts: true, react: true },
  ])("covers $languages with ui=$ui", ({ languages, ui, ts, react }) => {
    const plan = planFor(["init", "--dry-run", `--languages=${languages}`, `--ui=${ui}`], tempProject());
    const eslint = contentOf(plan, ".configra/eslint.js");
    const dependencies = Object.keys(plan.dependencies.npm.add);

    expect(eslint.includes('import tseslint from "typescript-eslint";')).toBe(ts);
    expect(eslint.includes("eslintReact.configs")).toBe(react);
    expect(eslint.includes("disable-conflict-eslint-plugin-react-hooks")).toBe(react);
    expect(dependencies.includes("typescript-eslint")).toBe(ts);
    expect(dependencies.includes("@eslint-react/eslint-plugin")).toBe(react);
    expect(dependencies.includes("typescript")).toBe(ts || react);

    if (react && languages.includes("javascript")) {
      expect(eslint).toContain('"**/*.{js,mjs,cjs,jsx}"');
    }

    if (react && ts) {
      expect(eslint).toContain('"**/*.{ts,mts,cts,tsx}"');
    }
  });

  it("uses the WordPress JavaScript standard with WordPress formatting and no Prettier rule", () => {
    const plan = planFor(["init", "--dry-run", "--standard", "javascript=wordpress"], tempProject());

    expect(contentOf(plan, ".configra/eslint.js")).toContain("wordpress.configs.recommended");
    expect(contentOf(plan, ".configra/eslint.js")).toContain('"prettier/prettier": "off"');
    expect(contentOf(plan, ".configra/prettier.js")).toContain("...wordpress");
    expect(contentOf(plan, ".editorconfig")).toContain("indent_style = tab");
    expect(plan.dependencies.npm.add).toMatchObject({
      "@wordpress/eslint-plugin": expect.any(String),
      "@wordpress/prettier-config": expect.any(String),
    });
    expect(plan.dependencies.npm.add).not.toHaveProperty("@eslint/js");
  });

  it("produces identical plans for the same project in differently named checkouts", async () => {
    const files = {
      "package.json": '{\n  "name": "demo",\n  "type": "module"\n}\n',
      "src/index.ts": "export const a = 1;\n",
      ".configra/config.json": JSON.stringify({
        version: 1,
        project: "node",
        languages: ["typescript"],
        ui: ["react"],
      }),
    };

    const first = tempProject(files, "alpha");
    const second = tempProject(files, "beta-checkout");
    const a = await runJson(["update", "--dry-run"], first);
    const b = await runJson(["update", "--dry-run"], second);

    expect(a.document).toEqual(b.document);
    expect(planFor(["update", "--dry-run"], first).writes).toEqual(planFor(["update", "--dry-run"], second).writes);
  });

  it("rejects unsupported standard combinations with one JSON error document", async () => {
    const { code, document } = await runJson(
      ["init", "--dry-run", "--languages=javascript,typescript", "--standard", "typescript=wordpress"],
      tempProject(),
    );

    expect(code).toBe(1);
    expect(document.status).toBe("error");
    expect(document.diagnostics[0]?.code).toBe("SELECTION_UNSUPPORTED_STANDARDS");
    expect(Value.Check(outputSchema, document)).toBe(true);
  });

  it("prints argument errors as one JSON document in JSON mode", async () => {
    const result = await runCli(["init", "--bogus", "--json"], tempProject());
    const document = JSON.parse(result.stdout) as { diagnostics: Array<{ code: string }> };

    expect(result.code).toBe(1);
    expect(document.diagnostics[0]?.code).toBe("ARG_UNKNOWN_OPTION");
    expect(result.stderr).toBe("");
  });

  it("exits with code 3 for pending changes with --exit-code and 0 once the plan is applied", async () => {
    const root = tempProject();

    expect((await runCli(["init", "--dry-run", "--exit-code"], root)).code).toBe(3);

    applyWrites(root, planFor(["init", "--dry-run"], root));

    const rerun = await runJson(["update", "--dry-run", "--exit-code"], root);

    expect(rerun.document.changes).toEqual([]);
    expect(rerun.document.conflicts).toEqual([]);
    expect(rerun.code).toBe(0);
  });

  it("stops init when a saved config exists and update when it doesn't", async () => {
    const configured = tempProject({ ".configra/config.json": '{"version":1,"project":"node"}' });

    expect((await runJson(["init", "--dry-run"], configured)).document.diagnostics[0]?.code).toBe("INIT_CONFIG_EXISTS");
    expect((await runJson(["update", "--dry-run"], tempProject())).document.diagnostics[0]?.code).toBe(
      "UPDATE_CONFIG_MISSING",
    );
  });

  it("reports unsupported and invalid config versions before planning", async () => {
    const future = tempProject({ ".configra/config.json": '{"version":2,"project":"node"}' });
    const invalid = tempProject({ ".configra/config.json": '{"version":1,"project":"node","tools":["nope"]}' });

    expect((await runJson(["update", "--dry-run"], future)).document.diagnostics[0]?.code).toBe(
      "CONFIG_UNSUPPORTED_VERSION",
    );
    expect((await runJson(["update", "--dry-run"], invalid)).document.diagnostics[0]?.code).toBe("CONFIG_INVALID");
  });

  it("reads --config relative to the caller and targets --cwd", async () => {
    const caller = tempProject({
      "selections.json": JSON.stringify({ version: 1, project: "node", languages: ["typescript"] }),
    });

    mkdirSync(join(caller, "app"));

    const { document } = await runJson(["init", "--dry-run", "--config", "selections.json", "--cwd", "app"], caller);

    expect(document.selections?.languages).toEqual(["typescript"]);
    expect(document.changes.some((change) => change.path === ".configra/config.json")).toBe(true);
  });

  it("suggests the WordPress preset when it detects a site", async () => {
    const { document } = await runJson(["init", "--dry-run"], tempProject({ "wp-config.php": "<?php\n" }));

    expect(document.diagnostics[0]?.code).toBe("INIT_WORDPRESS_DETECTED");
  });
});

describe("module types", () => {
  it("defaults a fresh project to ESM with .js entry files", () => {
    const plan = planFor(["init", "--dry-run"], tempProject());

    expect(JSON.parse(contentOf(plan, "package.json")) as object).toMatchObject({
      private: true,
      type: "module",
      engines: { node: ">=24.15" },
    });
    expect(plan.writes.some((write) => write.path === "eslint.config.js")).toBe(true);
  });

  it("uses .mjs JavaScript files and leaves the type unset when adding a manifest to existing scripts", () => {
    const plan = planFor(["init", "--dry-run"], tempProject({ "index.js": "module.exports = 1;\n" }));

    expect(JSON.parse(contentOf(plan, "package.json")) as object).not.toHaveProperty("type");
    expect(plan.writes.map((write) => write.path)).toEqual(
      expect.arrayContaining(["eslint.config.mjs", ".configra/eslint.mjs", ".configra/scripts/commit-msg.mjs"]),
    );
    expect(contentOf(plan, "eslint.config.mjs")).toContain('import configra from "./.configra/eslint.mjs";');
    expect(contentOf(plan, "lefthook.yml")).toContain("node .configra/scripts/commit-msg.mjs");
  });

  it("keeps an existing CommonJS manifest's type and publishable engines", () => {
    const manifest = '{\n  "name": "lib",\n  "type": "commonjs",\n  "engines": { "node": ">=20" }\n}\n';
    const result = planFor(["init", "--dry-run"], tempProject({ "package.json": manifest }));
    const planned = JSON.parse(contentOf(result, "package.json")) as Record<string, unknown>;

    expect(planned.type).toBe("commonjs");
    expect(planned.engines).toEqual({ node: ">=20" });
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("PLAN_ENGINES_BELOW_MINIMUM");
    expect(result.writes.map((write) => write.path)).toEqual(
      expect.arrayContaining(["prettier.config.mjs", ".configra/prettier.mjs"]),
    );
  });
});

describe("conflicts with existing content", () => {
  it("reports competing configuration and replaces it with --on-conflict replace", async () => {
    const root = tempProject({ ".eslintrc.json": "{}\n" });
    const pending = await runJson(["init", "--dry-run"], root);

    expect(pending.document.status).toBe("conflicts");
    expect(pending.document.conflicts).toMatchObject([{ id: ".eslintrc.json", kind: "competing-config" }]);

    const replaced = await runJson(["init", "--dry-run", "--on-conflict", "replace"], root);

    expect(replaced.document.conflicts[0]?.decision).toBe("replace");
    expect(replaced.document.changes).toContainEqual(
      expect.objectContaining({ path: ".eslintrc.json", action: "delete" }),
    );
  });

  it("reuses compatible dependencies and reports incompatible ones and colliding scripts", () => {
    const manifest = JSON.stringify({
      name: "app",
      type: "module",
      scripts: { lint: "my-lint" },
      dependencies: { prettier: "^3.10.2" },
      devDependencies: { eslint: "^9.0.0" },
    });

    const parsed = parseCliArgs(["init", "--dry-run"]);
    const result = planWorkflow("init", parsed.args as ParsedArgs, {
      cwd: tempProject({ "package.json": manifest }),
      version: readVersion(),
      runner: fakeRunner,
      interactive: false,
    });
    const ids = result.document.conflicts.map((conflict) => conflict.id);

    expect(ids).toEqual(["package.json#/devDependencies/eslint", "package.json#/scripts/lint"]);
    expect(result.document.dependencies.npm.add).not.toHaveProperty("prettier");
  });

  it("retains existing content and records the decision in saved selections", () => {
    const plan = planFor(
      ["init", "--dry-run", "--on-conflict", "retain"],
      tempProject({ ".editorconfig": "root = true\n" }),
    );

    expect(plan.config.decisions).toEqual({ ".editorconfig": "retain" });
    expect(plan.writes.some((write) => write.path === ".editorconfig")).toBe(false);
  });

  it("leaves matching pre-existing lines alone and keeps them unowned", () => {
    const plan = planFor(["init", "--dry-run"], tempProject({ ".gitignore": "node_modules/\n.env\n" }));
    const gitignore = contentOf(plan, ".gitignore");

    expect(gitignore.startsWith("node_modules/\n.env\n\n")).toBe(true);
    expect(plan.state.files[".gitignore"]).toEqual({
      kind: "lines",
      lines: [".configra/tmp/", ".cache/", "lefthook-local.yml"],
    });
  });
});

describe("text preview", () => {
  it("shows changes, scripts, hooks, commands, and discovery without color when piped", async () => {
    const result = await runCli(["init", "--dry-run"], tempProject());

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("create  .editorconfig");
    expect(result.stdout).toContain("+ devDependencies.eslint");
    expect(result.stdout).toContain("+ node_modules/");
    expect(result.stdout).toContain("lint:fix");
    expect(result.stdout).toContain("pass --install to run");
    expect(result.stdout).toContain("Discovery");
    expect(result.stdout).not.toContain("\u001B[");
    expect(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).toBeTruthy();
  });
});
