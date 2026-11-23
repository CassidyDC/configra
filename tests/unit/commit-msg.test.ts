import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkSubject, readSubject } from "../../src/components/tools/assets/commit-msg.mjs";
import { tempProject } from "../helpers.js";

const script = fileURLToPath(new URL("../../src/components/tools/assets/commit-msg.mjs", import.meta.url));

describe("commit-message subjects", () => {
  it.each([
    ["Add the init command", true],
    ["Support README and API docs for WordPress", true],
    ["add the init command", false],
    ["feat: add the init command", false],
    ["Fix: the init command", false],
    ["Add the init command.", false],
    [`Add ${"x".repeat(70)}`, false],
  ])("plain mode: %j passes is %s", (subject, passes) => {
    expect(checkSubject(subject, "plain").length === 0).toBe(passes);
  });

  it.each([
    ["feat(cli): add the init command", true],
    ["feat!: drop Node.js 22", true],
    ["fix: handle empty staged sets", true],
    ["Add the init command", false],
    ["feat: add the init command.", false],
    ["feature: add the init command", false],
  ])("conventional mode: %j passes is %s", (subject, passes) => {
    expect(checkSubject(subject, "conventional").length === 0).toBe(passes);
  });

  it.each([
    "Merge branch 'main' into topic",
    'Revert "Add the init command"',
    "fixup! add x",
    "squash! add x",
    "amend! add x",
  ])("skips %j in both modes", (subject) => {
    expect(checkSubject(subject, "plain")).toEqual([]);
    expect(checkSubject(subject, "conventional")).toEqual([]);
  });

  it("ignores comment lines and the verbose-commit diff", () => {
    const message = [
      "# Please enter the commit message",
      "",
      "Add the init command",
      "",
      "# ------------------------ >8 ------------------------",
      "diff --git a b",
    ].join("\n");

    expect(readSubject(message)).toBe("Add the init command");
    expect(readSubject("# only comments\n")).toBe("");
  });

  it("exits with a message when run as a hook", () => {
    const dir = tempProject();
    const good = join(dir, "good");
    const bad = join(dir, "bad");

    writeFileSync(good, "Add the init command\n");
    writeFileSync(bad, "feat: add the init command\n");

    expect(spawnSync(process.execPath, [script, "--mode", "plain", good]).status).toBe(0);

    const failed = spawnSync(process.execPath, [script, "--mode", "plain", bad], { encoding: "utf8" });

    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain("type prefix");
  });
});
