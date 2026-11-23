import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Value } from "typebox/value";
import { describe, expect, it } from "vitest";
import { run } from "../../src/cli/main.js";
import type { OutputDocument } from "../../src/cli/output.js";
import { orderWrites, runFiles, type ApplyHooks } from "../../src/generator/apply.js";
import { outputSchema } from "../../src/generator/state/schemas.js";
import { fakeRunner, runJson, tempProject } from "../helpers.js";

const isWindows = process.platform === "win32";
const repoModules = fileURLToPath(new URL("../../node_modules/", import.meta.url));

/**
 * Runs the CLI in JSON mode with apply hooks and returns the parsed document.
 */
async function runWithHooks(
  argv: string[],
  cwd: string,
  applyHooks: ApplyHooks,
): Promise<{ code: number; document: OutputDocument }> {
  let stdout = "";

  const code = await run([...argv, "--json"], {
    stdout: (text) => (stdout += text),
    stderr: () => undefined,
    cwd,
    stdinIsTTY: false,
    stdoutIsTTY: false,
    env: {},
    runner: fakeRunner,
    applyHooks,
  });

  return { code, document: JSON.parse(stdout) as OutputDocument };
}

/**
 * Lists every file under a directory as sorted POSIX paths, skipping `.git` and `node_modules`.
 */
function listTree(root: string): string[] {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() || entry.isSymbolicLink())
    .map((entry) =>
      join(entry.parentPath, entry.name)
        .slice(root.length + 1)
        .split("\\")
        .join("/"),
    )
    .filter((path) => !path.startsWith(".git/") && !path.startsWith("node_modules"))
    .sort();
}

/**
 * Reads a project file.
 */
function read(root: string, path: string): string {
  return readFileSync(join(root, path), "utf8");
}

/**
 * Initializes a Git repository so the lock and marker live in the Git directory.
 */
function gitInit(root: string): void {
  const result = spawnSync("git", ["init", "--quiet"], { cwd: root, encoding: "utf8" });

  expect(result.status, result.stderr).toBe(0);
}

/**
 * Expects a rerun to find nothing to change.
 */
async function expectUpToDate(root: string): Promise<void> {
  const rerun = await runJson(["update", "--dry-run", "--exit-code"], root);

  expect(rerun.document.changes).toEqual([]);
  expect(rerun.document.conflicts).toEqual([]);
  expect(rerun.code).toBe(0);
}

describe("applying a plan", () => {
  it("creates a fresh project and reruns without changes", async () => {
    const root = tempProject();
    const preview = await runJson(["init", "--dry-run"], root);
    const { code, document } = await runJson(["init"], root);

    expect(code).toBe(0);
    expect(Value.Check(outputSchema, document)).toBe(true);
    expect(document.phases).toEqual([{ phase: "apply", status: "done", message: expect.any(String) }]);
    expect(listTree(root)).toEqual(preview.document.changes.map((change) => change.path).sort());
    expect(JSON.parse(read(root, "package.json"))).toMatchObject({ private: true, type: "module" });
    expect(existsSync(join(root, ".configra/tmp"))).toBe(false);

    await expectUpToDate(root);

    const update = await runJson(["update"], root);

    expect(update.code).toBe(0);
    expect(update.document.phases?.[0]).toMatchObject({ phase: "apply", status: "skipped" });
  });

  it.skipIf(isWindows)("makes the commit-message script executable and preserves existing modes", async () => {
    const root = tempProject({ "package.json": '{\n  "name": "app",\n  "private": true\n}\n' });

    chmodSync(join(root, "package.json"), 0o600);

    expect((await runJson(["init"], root)).code).toBe(0);
    expect(statSync(join(root, "package.json")).mode & 0o777).toBe(0o600);
    expect(statSync(join(root, ".configra/scripts/commit-msg.mjs")).mode & 0o111).not.toBe(0);
  });

  it("removes owned files and fields the selections no longer need", async () => {
    const root = tempProject();

    await runJson(["init"], root);

    const { code, document } = await runJson(["update", "--tools", "editorconfig,gitignore,eslint,lefthook"], root);
    const manifest = JSON.parse(read(root, "package.json")) as Record<string, Record<string, string>>;

    expect(code).toBe(0);
    expect(existsSync(join(root, ".configra/prettier.mjs"))).toBe(false);
    expect(existsSync(join(root, ".prettierignore"))).toBe(false);
    expect(manifest.devDependencies?.prettier).toBeUndefined();
    expect(manifest.scripts?.["format:check"]).toBeUndefined();
    expect(document.diagnostics.map((diagnostic) => diagnostic.code)).toContain("ENTRY_ORPHANED");
    expect(existsSync(join(root, "prettier.config.js"))).toBe(true);

    await expectUpToDate(root);
  });

  it("settles in one run when new owned lines land after existing ones", async () => {
    const root = tempProject();

    await runJson(["init"], root);

    const config = JSON.parse(read(root, ".configra/config.json")) as Record<string, unknown>;

    // Extra exclusions sort before lockfile lines in .prettierignore but are appended to the file.
    writeFileSync(
      join(root, ".configra/config.json"),
      `${JSON.stringify({ ...config, exclusions: { add: ["generated/"] } }, null, 2)}\n`,
    );
    expect((await runJson(["update"], root)).code).toBe(0);
    expect(read(root, ".prettierignore").trimEnd().endsWith("generated/")).toBe(true);

    await expectUpToDate(root);
  });
});

describe("conflict decisions", () => {
  const existing = {
    "package.json": '{\n  "name": "app",\n  "scripts": {\n    "lint": "eslint ."\n  }\n}\n',
    ".gitignore": "node_modules/\n.env\n",
  };

  it("exits with code 2 and writes nothing while conflicts need decisions", async () => {
    const root = tempProject(existing);
    const { code, document } = await runJson(["init"], root);

    expect(code).toBe(2);
    expect(document.status).toBe("conflicts");
    expect(document.diagnostics.map((diagnostic) => diagnostic.code)).toContain("APPLY_CONFLICTS_UNRESOLVED");
    expect(listTree(root)).toEqual([".gitignore", "package.json"]);
    expect(read(root, "package.json")).toBe(existing["package.json"]);
  });

  it("adopts an existing project, keeps retained content, and respects the decision on reruns", async () => {
    const root = tempProject(existing);

    expect((await runJson(["init", "--on-conflict", "retain"], root)).code).toBe(0);

    const manifest = JSON.parse(read(root, "package.json")) as { scripts: Record<string, string> };
    const config = JSON.parse(read(root, ".configra/config.json")) as { decisions?: Record<string, string> };
    const state = JSON.parse(read(root, ".configra/state.json")) as { files: Record<string, { lines?: string[] }> };

    expect(manifest.scripts.lint).toBe("eslint .");
    expect(manifest.scripts["lint:js"]).toBeDefined();
    expect(config.decisions).toEqual({ "package.json#/scripts/lint": "retain" });
    expect(read(root, ".gitignore").startsWith("node_modules/\n.env\n")).toBe(true);
    expect(state.files[".gitignore"]?.lines).not.toContain("node_modules/");

    const rerun = await runJson(["update", "--dry-run", "--exit-code"], root);

    expect(rerun.document.changes).toEqual([]);
    expect(rerun.document.conflicts).toEqual([
      expect.objectContaining({ id: "package.json#/scripts/lint", decision: "retain" }),
    ]);
    expect((await runJson(["update"], root)).code).toBe(0);
  });

  it("replaces retained content on a later run and drops the saved decision", async () => {
    const root = tempProject(existing);

    await runJson(["init", "--on-conflict", "retain"], root);

    expect((await runJson(["update", "--on-conflict", "replace"], root)).code).toBe(0);

    const manifest = JSON.parse(read(root, "package.json")) as { scripts: Record<string, string> };
    const config = JSON.parse(read(root, ".configra/config.json")) as { decisions?: Record<string, string> };

    expect(manifest.scripts.lint).toBe("npm run lint:md && npm run lint:js");
    expect(config.decisions).toBeUndefined();

    await expectUpToDate(root);
  });

  it("reports an edited owned file as a conflict on the next run", async () => {
    const root = tempProject();

    await runJson(["init"], root);
    writeFileSync(join(root, ".editorconfig"), `${read(root, ".editorconfig")}\n[*.txt]\nindent_size = 8\n`);

    const blocked = await runJson(["update", "--commit-messages", "conventional"], root);

    expect(blocked.code).toBe(2);
    expect(blocked.document.conflicts).toEqual([
      expect.objectContaining({ id: ".editorconfig", kind: "edited-owned" }),
    ]);

    expect((await runJson(["update", "--commit-messages", "conventional", "--on-conflict", "retain"], root)).code).toBe(
      0,
    );
    expect(read(root, ".editorconfig")).toContain("[*.txt]");
    expect(read(root, ".configra/scripts/commit-msg.mjs")).toBeDefined();
    expect(read(root, "lefthook.yml")).toContain("--mode conventional");
  });
});

describe("interrupted and concurrent runs", () => {
  it("finishes cleanly after a failure at each write boundary, including the final state write", async () => {
    const reference = tempProject({}, "reference");
    const preview = await runJson(["init", "--dry-run"], reference);
    const paths = orderWrites(preview.document.changes.map((change) => ({ path: change.path, content: "" }))).map(
      (write) => write.path,
    );

    expect(paths.at(-1)).toBe(".configra/state.json");
    expect(paths.at(-2)).toBe(".configra/config.json");

    for (const [index, failing] of paths.entries()) {
      const root = tempProject();
      const failed = await runWithHooks(["init"], root, {
        beforeWrite: (path) => {
          if (path === failing) {
            throw new Error("injected failure");
          }
        },
      });

      expect(failed.code, failing).toBe(1);
      expect(failed.document.diagnostics.map((diagnostic) => diagnostic.code)).toContain("APPLY_WRITE_FAILED");
      expect(listTree(root).filter((path) => !path.startsWith(".configra/tmp/"))).toEqual(paths.slice(0, index).sort());

      const configWritten = paths.slice(0, index).includes(".configra/config.json");

      expect(failed.document.phases?.[0]?.message).toContain(
        index === 0 ? "Wrote 0" : configWritten ? "configra update" : "same command",
      );

      const retry = await runJson([configWritten ? "update" : "init"], root);

      expect(retry.code, `${failing}: ${JSON.stringify(retry.document.conflicts)}`).toBe(0);
      expect(retry.document.conflicts).toEqual([]);
      expect(retry.document.diagnostics.map((diagnostic) => diagnostic.code)).toContain("APPLY_PENDING_RUN");

      await expectUpToDate(root);
    }
  });

  it("reports files edited after an interrupted run as conflicts instead of adopting them", async () => {
    const root = tempProject();

    await runWithHooks(["init"], root, {
      beforeWrite: (path) => {
        if (path === ".configra/state.json") {
          throw new Error("injected failure");
        }
      },
    });
    writeFileSync(join(root, ".editorconfig"), "root = true\n");

    const { code, document } = await runJson(["update"], root);

    expect(code).toBe(2);
    expect(document.conflicts.map((conflict) => conflict.id)).toEqual([".editorconfig"]);
  });

  it("refuses to run while another run holds the lock and replaces a stale lock", async () => {
    const root = tempProject();
    const files = runFiles(root, fakeRunner);

    mkdirSync(files.directory, { recursive: true });
    writeFileSync(files.lock, JSON.stringify({ pid: process.pid, host: hostname() }));

    const locked = await runJson(["init"], root);

    expect(locked.code).toBe(1);
    expect(locked.document.diagnostics.map((diagnostic) => diagnostic.code)).toContain("APPLY_LOCKED");
    expect(existsSync(join(root, "package.json"))).toBe(false);

    writeFileSync(files.lock, JSON.stringify({ pid: 2 ** 22 + 12_345, host: hostname() }));

    expect((await runJson(["init"], root)).code).toBe(0);
    expect(existsSync(files.lock)).toBe(false);
  });

  it("keeps the lock and marker in the Git directory inside a repository", async () => {
    const root = tempProject();

    gitInit(root);

    const files = runFiles(root, fakeRunner);

    expect(files.directory).toBe(join(root, ".git", "configra"));
    expect((await runJson(["init"], root)).code).toBe(0);
    expect(existsSync(join(root, ".configra/tmp"))).toBe(false);
  });

  it("stops when the project changes after planning", async () => {
    const root = tempProject({ "package.json": '{\n  "name": "app"\n}\n' });
    const { code, document } = await runWithHooks(["init"], root, {
      afterPlanCheck: () => writeFileSync(join(root, "package.json"), '{\n  "name": "changed"\n}\n'),
    });

    expect(code).toBe(1);
    expect(document.diagnostics.map((diagnostic) => diagnostic.code)).toContain("APPLY_PROJECT_CHANGED");
    expect(listTree(root)).toEqual(["package.json"]);
  });

  it.skipIf(isWindows)("won't write through a symlink created after planning", async () => {
    const root = tempProject();
    const outside = tempProject({}, "outside");

    gitInit(root);

    const { code, document } = await runWithHooks(["init"], root, {
      afterPlanCheck: () => symlinkSync(outside, join(root, ".configra")),
    });

    expect(code).toBe(1);
    expect(document.diagnostics.map((diagnostic) => diagnostic.code)).toContain("APPLY_UNSAFE_PATH");
    expect(readdirSync(outside)).toEqual([]);
  });

  it("won't write into a Git repository created inside the project after planning", async () => {
    const root = tempProject();

    gitInit(root);

    const { code, document } = await runWithHooks(["init"], root, {
      afterPlanCheck: () => mkdirSync(join(root, ".configra/.git"), { recursive: true }),
    });

    expect(code).toBe(1);
    expect(document.diagnostics.map((diagnostic) => diagnostic.code)).toContain("APPLY_UNSAFE_PATH");
    expect(listTree(root)).toEqual([]);
  });
});

describe("line endings", () => {
  it("treats a CRLF checkout of generated files as unchanged and keeps CRLF on updates", async () => {
    const root = tempProject();

    await runJson(["init"], root);

    for (const path of listTree(root)) {
      writeFileSync(join(root, path), read(root, path).replaceAll("\n", "\r\n"));
    }

    await expectUpToDate(root);

    expect((await runJson(["update", "--commit-messages", "conventional"], root)).code).toBe(0);
    expect(read(root, "lefthook.yml")).toContain("--mode conventional {1}\r\n");
    expect(read(root, "lefthook.yml").replaceAll("\r\n", "")).not.toContain("\n");
  });
});

describe("generated configuration in ESM and CommonJS consumers", () => {
  /**
   * Runs a package script's tool from the repository's own installed tools.
   */
  function runTool(root: string, executable: string, args: string[]): { status: number | null; output: string } {
    const result = spawnSync(join(root, "node_modules", ".bin", executable), args, {
      cwd: root,
      encoding: "utf8",
      shell: isWindows,
    });

    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  }

  for (const [label, manifest, extension] of [
    ["ESM", { name: "esm-app", private: true, type: "module" }, "js"],
    ["CommonJS", { name: "cjs-app", private: true, type: "commonjs" }, "mjs"],
  ] as const) {
    it(`loads the generated entry files in a ${label} package and passes its own checks`, async () => {
      const root = tempProject({
        "package.json": `${JSON.stringify(manifest, null, 2)}\n`,
        "src/index.js":
          label === "ESM" ? 'export const greeting = "Hello";\n' : 'module.exports = { greeting: "Hello" };\n',
        "README.md": "# App\n\nA small app.\n",
      });

      expect((await runJson(["init"], root)).code).toBe(0);
      expect(existsSync(join(root, `eslint.config.${extension}`))).toBe(true);
      expect(existsSync(join(root, `prettier.config.${extension}`))).toBe(true);
      expect(JSON.parse(read(root, "package.json"))).toMatchObject({ type: manifest.type });

      symlinkSync(repoModules, join(root, "node_modules"), "junction");

      for (const [executable, args] of [
        ["prettier", ["--check", "."]],
        ["eslint", ["."]],
        ["markdownlint-cli2", ["**/*.md"]],
      ] as const) {
        const result = runTool(root, executable, [...args]);

        expect(result.status, `${executable}: ${result.output}`).toBe(0);
      }

      writeFileSync(join(root, "src/index.js"), "const unused = 1\n");

      expect(runTool(root, "eslint", ["."]).status).toBe(1);
      expect(runTool(root, "prettier", ["--check", "."]).status).toBe(1);
    });
  }
});
