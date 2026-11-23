import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { systemRunner, type ProcessRunner } from "../../src/platform/process.js";
import { fakeRunner, recordingRunner, runJson, tempProject } from "../helpers.js";

const repoModules = fileURLToPath(new URL("../../node_modules/", import.meta.url));
const installCommand = "npm install --ignore-scripts --no-audit --no-fund";
const activateCommand = "npx --no -- lefthook install";

/**
 * Runs Git in a directory and fails the test when it exits with an error.
 */
function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });

  expect(result.status, result.stderr).toBe(0);

  return result.stdout;
}

/**
 * Creates a Git repository with a committer identity.
 */
function gitRepository(root: string): void {
  git(root, "init", "-q");
  git(root, "config", "user.email", "test@example.com");
  git(root, "config", "user.name", "Test");
  git(root, "config", "core.autocrlf", "false");
}

/**
 * Returns the codes of a document's diagnostics.
 */
function codes(document: { diagnostics: Array<{ code: string }> }): string[] {
  return document.diagnostics.map((diagnostic) => diagnostic.code);
}

/**
 * Lists every file under a directory with its content, skipping Git data and dependencies.
 */
function snapshotTree(root: string): Record<string, string> {
  const files: Record<string, string> = {};

  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    const path = join(entry.parentPath, entry.name)
      .slice(root.length + 1)
      .split("\\")
      .join("/");

    if (entry.isFile() && !path.startsWith(".git/") && !path.startsWith("node_modules")) {
      files[path] = readFileSync(join(root, path), "utf8");
    }
  }

  return files;
}

describe("dependency installation", () => {
  it("installs with lifecycle scripts disabled after writing the files", async () => {
    const root = tempProject();
    const runner = recordingRunner();
    const { code, document } = await runJson(["init", "--install"], root, runner);

    expect(code).toBe(0);
    expect(runner.calls).toEqual([installCommand]);
    expect(document.phases?.map((phase) => [phase.phase, phase.status])).toEqual([
      ["apply", "done"],
      ["install", "done"],
    ]);
    expect(document.commands[0]).toMatchObject({ phase: "install", cwd: ".", approved: true });
  });

  it("keeps the files after a failed install and succeeds on a retry with no file changes", async () => {
    const root = tempProject();
    const failing = recordingRunner([1]);

    gitRepository(root);

    const failed = await runJson(["init", "--install", "--install-hooks"], root, {
      ...failing,
      run: fakeRunner.run,
    });

    expect(failed.code).toBe(1);
    expect(existsSync(join(root, ".configra/state.json"))).toBe(true);
    expect(codes(failed.document)).toContain("INSTALL_FAILED");
    expect(failed.document.diagnostics.find((item) => item.code === "INSTALL_FAILED")?.message).toContain(
      "configra update --install --install-hooks",
    );
    expect(failed.document.phases?.map((phase) => [phase.phase, phase.status])).toEqual([
      ["apply", "done"],
      ["install", "failed"],
      ["activate-hooks", "skipped"],
    ]);
    expect(failing.calls).toEqual([installCommand]);

    const retrying = recordingRunner();
    const retry = await runJson(["update", "--install"], root, retrying);

    expect(retry.code).toBe(0);
    expect(retry.document.changes).toEqual([]);
    expect(retry.document.phases?.map((phase) => [phase.phase, phase.status])).toEqual([
      ["apply", "skipped"],
      ["install", "done"],
    ]);
    expect(retrying.calls).toEqual([installCommand]);
  });

  it("generates files for other package managers but won't install with npm", async () => {
    const root = tempProject({ "package.json": '{\n  "name": "app"\n}\n', "yarn.lock": "" });
    const runner = recordingRunner();
    const blocked = await runJson(["init", "--install"], root, runner);

    expect(blocked.code).toBe(1);
    expect(codes(blocked.document)).toContain("INSTALL_PACKAGE_MANAGER_UNSUPPORTED");
    expect(existsSync(join(root, ".configra"))).toBe(false);
    expect(runner.calls).toEqual([]);

    const generated = await runJson(["init"], root, runner);

    expect(generated.code).toBe(0);
    expect(generated.document.diagnostics).toContainEqual(
      expect.objectContaining({ code: "INSTALL_PACKAGE_MANAGER_UNSUPPORTED", severity: "warning" }),
    );
  });

  it("stops before writing when npm would install in an enclosing workspace root", async () => {
    const workspace = tempProject({
      "package.json": '{\n  "name": "workspace",\n  "private": true,\n  "workspaces": ["packages/*"]\n}\n',
      "packages/app/package.json": '{\n  "name": "app"\n}\n',
    });
    const app = join(workspace, "packages/app");
    const preview = await runJson(["init", "--dry-run"], app);

    expect(preview.document.commands[0]).toMatchObject({ phase: "install", cwd: "../.." });

    const { code, document } = await runJson(["init", "--install"], app, recordingRunner());

    expect(code).toBe(1);
    expect(codes(document)).toContain("INSTALL_OUTSIDE_SCOPE");
    expect(existsSync(join(app, ".configra"))).toBe(false);
  });
});

describe("hook activation preflight", () => {
  it("needs a repository, its root, and no other hook manager", async () => {
    const plain = tempProject();

    expect(
      codes((await runJson(["init", "--install-hooks", "--install"], plain, recordingRunner())).document),
    ).toContain("HOOKS_NO_REPOSITORY");

    const repository = tempProject();

    gitRepository(repository);
    mkdirSync(join(repository, "app"));

    expect(
      codes(
        (await runJson(["init", "--install-hooks", "--install"], join(repository, "app"), recordingRunner())).document,
      ),
    ).toContain("HOOKS_NOT_GIT_ROOT");

    git(repository, "config", "core.hooksPath", ".husky/_");

    expect(
      codes((await runJson(["init", "--install-hooks", "--install"], repository, recordingRunner())).document),
    ).toContain("HOOKS_PATH_CUSTOM");

    git(repository, "config", "--unset", "core.hooksPath");
    writeFileSync(join(repository, ".git/hooks/pre-commit"), "#!/bin/sh\nexit 0\n");

    expect(
      codes((await runJson(["init", "--install-hooks", "--install"], repository, recordingRunner())).document),
    ).toContain("HOOKS_EXISTING");
    expect(existsSync(join(repository, ".configra"))).toBe(false);
  });

  it("needs Lefthook installed or an approved install that provides it", async () => {
    const root = tempProject();

    gitRepository(root);

    const missing = await runJson(["init", "--install-hooks"], root, recordingRunner());

    expect(missing.code).toBe(1);
    expect(codes(missing.document)).toContain("HOOKS_LEFTHOOK_MISSING");

    const runner = recordingRunner();
    const { code } = await runJson(["init", "--install", "--install-hooks"], root, runner);

    expect(code).toBe(0);
    expect(runner.calls).toEqual([installCommand, activateCommand]);
  });

  it("reports problems as warnings in a dry run", async () => {
    const { code, document } = await runJson(["init", "--dry-run", "--install-hooks"], tempProject());

    expect(code).toBe(0);
    expect(document.diagnostics).toContainEqual(
      expect.objectContaining({ code: "HOOKS_NO_REPOSITORY", severity: "warning" }),
    );
  });
});

describe("replaying saved selections", () => {
  it("finds nothing to change in a differently named clone that committed the generated files", async () => {
    const original = tempProject({ "src/index.js": 'export const greeting = "Hello";\n' }, "original");

    gitRepository(original);
    expect((await runJson(["init", "--languages", "javascript,typescript"], original)).code).toBe(0);
    git(original, "add", "-A");
    git(original, "commit", "-q", "-m", "Set up the tooling");

    const clone = join(tempProject({}, "parent"), "renamed-checkout");

    git(original, "clone", "-q", original, clone);

    const rerun = await runJson(["update", "--dry-run", "--exit-code"], clone);

    expect(rerun.document.changes).toEqual([]);
    expect(rerun.code).toBe(0);
  });

  it("regenerates the same files from committed selections alone", async () => {
    const committed = {
      "package.json": '{\n  "name": "app",\n  "private": true\n}\n',
      "src/index.js": 'export const greeting = "Hello";\n',
    };
    const original = tempProject(committed, "original");

    expect((await runJson(["init", "--ui", "react", "--commit-messages", "conventional"], original)).code).toBe(0);

    const replay = tempProject(committed, "another-name");

    mkdirSync(join(replay, ".configra"));
    cpSync(join(original, ".configra/config.json"), join(replay, ".configra/config.json"));

    const replayed = await runJson(["update"], replay);

    expect(replayed.code, JSON.stringify(replayed.document.diagnostics)).toBe(0);
    expect(snapshotTree(replay)).toEqual(snapshotTree(original));
  });
});

describe("activated hooks in a generated project", () => {
  /**
   * Runs Git without failing, for commits the hooks may reject.
   */
  function tryGit(cwd: string, ...args: string[]): SpawnSyncReturns<string> {
    return spawnSync("git", args, { cwd, encoding: "utf8" });
  }

  it("stays inactive until activation, then checks staged content and commit messages", async () => {
    const root = tempProject({
      "package.json": '{\n  "name": "hooks-app",\n  "private": true,\n  "type": "module"\n}\n',
      "src/index.js": 'export const greeting = "Hello";\n',
    });

    gitRepository(root);
    symlinkSync(repoModules, join(root, "node_modules"), "junction");

    expect((await runJson(["init"], root)).code).toBe(0);
    expect(existsSync(join(root, ".git/hooks/pre-commit"))).toBe(false);

    const runner: ProcessRunner = { run: fakeRunner.run, stream: systemRunner.stream };
    const activated = await runJson(["update", "--install-hooks"], root, runner);

    expect(activated.code, JSON.stringify(activated.document.diagnostics)).toBe(0);
    expect(existsSync(join(root, ".git/hooks/pre-commit"))).toBe(true);
    expect(existsSync(join(root, ".git/hooks/commit-msg"))).toBe(true);

    const tracked = Object.keys(snapshotTree(root));

    git(root, "add", "--", ...tracked);
    git(root, "commit", "-q", "-m", "Set up the tooling");

    // A staged lint error fails the commit.
    writeFileSync(join(root, "src/index.js"), "const unused = 1;\n");
    git(root, "add", "src/index.js");
    expect(tryGit(root, "commit", "-q", "-m", "Add an unused constant").status).not.toBe(0);

    // Good staged content passes even when the unstaged part would fail, and the unstaged part survives.
    writeFileSync(join(root, "src/index.js"), 'export const greeting = "Hi";\n');
    git(root, "add", "src/index.js");
    writeFileSync(join(root, "src/index.js"), "const unused = 1;\n");

    const partial = tryGit(root, "commit", "-q", "-m", "Shorten the greeting");

    expect(partial.status, partial.stderr + partial.stdout).toBe(0);
    expect(readFileSync(join(root, "src/index.js"), "utf8")).toBe("const unused = 1;\n");
    expect(git(root, "show", "HEAD:src/index.js")).toBe('export const greeting = "Hi";\n');

    // The plain commit-message rules reject a lowercase subject and accept a sentence-case one.
    writeFileSync(join(root, "README.md"), "# Hooks app\n");
    git(root, "add", "README.md");
    expect(tryGit(root, "commit", "-q", "-m", "add a readme").status).not.toBe(0);
    expect(tryGit(root, "commit", "-q", "-m", "feat: add a readme").status).not.toBe(0);
    expect(tryGit(root, "commit", "-q", "-m", "Add a readme").status).toBe(0);

    // Deselecting Lefthook offers to remove the installed hooks, which keep passing without their config.
    const deselect = ["update", "--tools=editorconfig,gitignore,prettier,markdownlint,eslint"];
    const preview = await runJson([...deselect, "--dry-run"], root);

    expect(preview.document.diagnostics).toContainEqual(
      expect.objectContaining({ code: "HOOKS_CLEANUP", severity: "warning" }),
    );
    expect((await runJson(deselect, root)).code).toBe(0);
    expect(existsSync(join(root, "lefthook.yml"))).toBe(false);
    writeFileSync(join(root, "NOTES.md"), "# Notes\n");
    git(root, "add", "NOTES.md");
    expect(tryGit(root, "commit", "-q", "-m", "add notes without hooks").status).toBe(0);
  });
});
