import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  accept,
  canceled,
  recordingRunner,
  type Answer,
  runCli,
  runJson,
  runTerminal,
  tempProject,
} from "../helpers.js";

const existing = {
  "package.json": '{\n  "name": "app",\n  "scripts": {\n    "lint": "eslint ."\n  }\n}\n',
};

/**
 * Lists a project's files with their content, skipping Git data.
 */
function tree(root: string): Record<string, string> {
  const files: Record<string, string> = {};

  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    const path = join(entry.parentPath, entry.name)
      .slice(root.length + 1)
      .split("\\")
      .join("/");

    if (entry.isFile() && !path.startsWith(".git/")) {
      files[path] = readFileSync(join(root, path), "utf8");
    }
  }

  return files;
}

/**
 * Reads a saved config.
 */
function savedConfig(root: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, ".configra/config.json"), "utf8")) as Record<string, unknown>;
}

describe("terminal approval for flag runs", () => {
  it("previews, asks for approval, and writes nothing when declined", async () => {
    const root = tempProject();
    const declined = await runTerminal(["init", "--languages", "javascript"], root, [false]);

    expect(declined.code).toBe(130);
    expect(declined.asked).toEqual(["Apply these changes?"]);
    expect(declined.stdout).toContain("create  .configra/config.json");
    expect(declined.stdout).toContain("Canceled. Configra wrote nothing.");
    expect(tree(root)).toEqual({});

    const approved = await runTerminal(["init", "--languages", "javascript"], root, [true]);

    expect(approved.code).toBe(0);
    expect(approved.stdout).toContain("Result");
    expect(existsSync(join(root, ".configra/state.json"))).toBe(true);
  });

  it("approves with --yes without prompting", async () => {
    const root = tempProject();

    expect((await runCli(["init", "--languages", "javascript", "--yes"], root, true)).code).toBe(0);
    expect(existsSync(join(root, ".configra/state.json"))).toBe(true);
  });

  it("asks about each conflict, previews the result, and saves a retain decision", async () => {
    const root = tempProject(existing);
    const run = await runTerminal(["init", "--languages", "javascript"], root, ["retain", true]);

    expect(run.code).toBe(0);
    expect(run.asked[0]).toContain("scripts.lint in package.json is already");
    expect(run.stdout).toContain("-> retain");
    expect(savedConfig(root).decisions).toEqual({ "package.json#/scripts/lint": "retain" });
    expect(JSON.parse(readFileSync(join(root, "package.json"), "utf8"))).toMatchObject({
      scripts: { lint: "eslint ." },
    });
  });

  it("leaves conflicts to --on-conflict when --yes skips the prompts", async () => {
    const root = tempProject(existing);
    const run = await runCli(["init", "--languages", "javascript", "--yes"], root, true);

    expect(run.code).toBe(2);
    expect(run.stdout + run.stderr).toContain("APPLY_CONFLICTS_UNRESOLVED");
    expect(tree(root)).toEqual(existing);
  });

  it("leaves the project untouched when a conflict prompt is canceled", async () => {
    const root = tempProject(existing);
    const run = await runTerminal(["init", "--languages", "javascript"], root, [canceled]);

    expect(run.code).toBe(130);
    expect(tree(root)).toEqual(existing);
  });

  it("needs a terminal for --interactive", async () => {
    const { code, stderr } = await runCli(["init", "--interactive"], tempProject());

    expect(code).toBe(1);
    expect(stderr).toContain("ARG_INTERACTIVE_NO_TERMINAL");
  });
});

describe("setup wizard", () => {
  it("generates the same files as the equivalent flag run when the defaults are accepted", async () => {
    const wizard = tempProject({ "src/index.js": "export const value = 1;\n" });
    const run = await runTerminal(["init"], wizard, [accept, accept, "generate"]);

    expect(run.code, run.stdout + run.stderr).toBe(0);
    expect(run.asked).toEqual([
      "What kind of project is this?",
      "Use the Node.js defaults?",
      "What should Configra do?",
    ]);
    expect(run.notes.some((note) => note.startsWith("Proposed .configra/config.json"))).toBe(true);
    expect(run.notes.some((note) => note.includes("without activating it"))).toBe(true);

    const flags = tempProject({ "src/index.js": "export const value = 1;\n" });

    expect((await runJson(["init", "--project", "node"], flags)).code).toBe(0);
    expect(tree(wizard)).toEqual(tree(flags));
  });

  it("writes just .configra/config.json for Save config only", async () => {
    const root = tempProject(existing);
    const run = await runTerminal(["init"], root, [accept, accept, "save"]);

    expect(run.code).toBe(0);
    expect(Object.keys(tree(root)).sort()).toEqual([".configra/config.json", "package.json"]);
    expect(run.notes.at(-1)).toContain("configra update");
  });

  it("leaves the project untouched when canceled at any step", async () => {
    const scripts: Answer[][] = [
      [canceled],
      [accept, canceled],
      [accept, accept, "cancel"],
      [accept, accept, canceled],
    ];

    for (const answers of scripts) {
      const root = tempProject(existing);
      const run = await runTerminal(["init"], root, answers);

      expect(run.code).toBe(130);
      expect(tree(root)).toEqual(existing);
    }
  });

  it("customizes every selection", async () => {
    const root = tempProject();

    const run = await runTerminal(["init"], root, [
      accept,
      "customize",
      ["typescript"],
      ["react"],
      "community",
      accept,
      "conventional",
      "generate",
    ]);

    expect(run.code, run.stdout + run.stderr).toBe(0);
    expect(run.asked.slice(2)).toEqual([
      expect.stringContaining("Which languages"),
      "Which UI frameworks does the project use?",
      "Which coding standard should TypeScript use?",
      "Which tools should Configra set up?",
      "How should the commit-msg hook check commit subjects?",
      "What should Configra do?",
    ]);
    expect(savedConfig(root)).toMatchObject({
      languages: ["typescript"],
      ui: ["react"],
      commitMessages: "conventional",
    });
  });

  it("revisits an answer from the preview", async () => {
    const root = tempProject();

    const run = await runTerminal(["init"], root, [
      accept,
      accept,
      "change",
      "languages",
      ["javascript", "typescript"],
      accept,
      accept,
      "generate",
    ]);

    expect(run.code, run.stdout + run.stderr).toBe(0);
    expect(savedConfig(root)).toMatchObject({ languages: ["javascript", "typescript"] });
  });

  it("asks about conflicts for the chosen outcome and approves the updated preview", async () => {
    const root = tempProject(existing);
    const run = await runTerminal(["init"], root, [accept, accept, "generate", "replace", true]);

    expect(run.code, run.stdout + run.stderr).toBe(0);
    expect(run.asked.slice(3)).toEqual([expect.stringContaining("scripts.lint"), "Apply these changes?"]);
    expect(JSON.parse(readFileSync(join(root, "package.json"), "utf8"))).toMatchObject({
      scripts: { lint: "npm run lint:md && npm run lint:js" },
    });
  });

  it("installs and activates hooks only with approval", async () => {
    const root = tempProject();

    spawnSync("git", ["init", "-q"], { cwd: root });

    const runner = recordingRunner();
    const run = await runTerminal(["init"], root, [accept, accept, "install", true], runner);

    expect(run.code, run.stdout + run.stderr).toBe(0);
    expect(run.asked.at(-1)).toContain("Activate the Git hooks");
    expect(runner.calls).toEqual(["npm install --ignore-scripts --no-audit --no-fund", "npx --no -- lefthook install"]);

    const declined = tempProject();

    spawnSync("git", ["init", "-q"], { cwd: declined });

    const installOnly = recordingRunner();

    expect((await runTerminal(["init"], declined, [accept, accept, "install", false], installOnly)).code).toBe(0);
    expect(installOnly.calls).toEqual(["npm install --ignore-scripts --no-audit --no-fund"]);

    // Without an install, Lefthook is missing, so the wizard explains instead of asking.
    const missing = tempProject();

    spawnSync("git", ["init", "-q"], { cwd: missing });

    const generated = await runTerminal(["init"], missing, [accept, accept, "generate"], recordingRunner());

    expect(generated.notes.some((note) => note.includes("Lefthook isn't installed"))).toBe(true);
  });

  it("starts update --interactive from the saved selections", async () => {
    const root = tempProject();

    expect((await runJson(["init", "--languages", "typescript"], root)).code).toBe(0);

    const before = tree(root);
    const run = await runTerminal(["update", "--interactive"], root, [accept, accept, "generate"]);

    expect(run.code, run.stdout + run.stderr).toBe(0);
    expect(run.stdout).toContain("No changes. Everything is up to date.");
    expect(tree(root)).toEqual(before);
  });

  it("opens only for init without saved selections or selection flags", async () => {
    const root = tempProject();

    // A selection flag skips the wizard, so the run asks only for approval.
    expect((await runTerminal(["init", "--commit-messages", "off"], root, [false])).asked).toEqual([
      "Apply these changes?",
    ]);
  });
});
