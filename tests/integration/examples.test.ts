import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseCliArgs, type ParsedArgs } from "../../src/cli/args.js";
import { planWorkflow } from "../../src/cli/commands/workflow.js";
import { readVersion } from "../../src/cli/version.js";
import { fakeRunner, tempProject } from "../helpers.js";

const examplesRoot = fileURLToPath(new URL("../../examples/", import.meta.url));
const update = process.env.UPDATE_EXAMPLES === "1";

/**
 * Representative selections. Each example's output is the plan for a fresh, empty project.
 */
const examples: Array<{ name: string; description: string; selections: Record<string, unknown> }> = [
  { name: "node", description: "The node preset defaults.", selections: { version: 1, project: "node" } },
  {
    name: "node-typescript-react",
    description: "TypeScript and React with the community standard and Conventional Commits.",
    selections: {
      version: 1,
      project: "node",
      languages: ["typescript"],
      ui: ["react"],
      commitMessages: "conventional",
    },
  },
  {
    name: "node-wordpress-javascript",
    description: "JavaScript with the WordPress standard and WordPress formatting.",
    selections: { version: 1, project: "node", standards: { javascript: "wordpress" } },
  },
];

/**
 * Renders one example's files: its selections, its generated files, and its JSON plan.
 */
function renderExample(example: (typeof examples)[number]): Map<string, string> {
  const caller = tempProject({ "selections.json": `${JSON.stringify(example.selections, null, 2)}\n` });
  const target = join(caller, "project");

  mkdirSync(target);

  const parsed = parseCliArgs(["init", "--dry-run", "--config", "selections.json", "--cwd", "project"]);
  const result = planWorkflow("init", parsed.args as ParsedArgs, {
    cwd: caller,
    version: readVersion(),
    runner: fakeRunner,
    interactive: false,
  });
  const files = new Map<string, string>();
  const { discovery: _discovery, ...document } = result.document;

  files.set("selections.json", `${JSON.stringify(example.selections, null, 2)}\n`);
  files.set("plan.json", `${JSON.stringify(document, null, 2)}\n`);

  for (const write of result.plan?.writes ?? []) {
    if (write.content !== null) {
      files.set(`output/${write.path}`, write.content);
    }
  }

  return files;
}

/**
 * Lists the files under a directory as POSIX relative paths.
 */
function listFiles(root: string): string[] {
  try {
    return readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) =>
        join(entry.parentPath, entry.name)
          .slice(root.length + 1)
          .split("\\")
          .join("/"),
      )
      .sort();
  } catch {
    return [];
  }
}

describe("published examples", () => {
  it.each(examples)("$name matches the generated output", (example) => {
    const directory = join(examplesRoot, example.name);
    const expected = renderExample(example);

    if (update) {
      rmSync(directory, { recursive: true, force: true });

      for (const [path, content] of expected) {
        mkdirSync(dirname(join(directory, path)), { recursive: true });
        writeFileSync(join(directory, path), content);
      }
    }

    expect(listFiles(directory)).toEqual([...expected.keys()].sort());

    for (const [path, content] of expected) {
      expect(
        readFileSync(join(directory, path), "utf8"),
        `${example.name}/${path} is out of date; run npm run examples:update`,
      ).toBe(content);
    }
  });
});
