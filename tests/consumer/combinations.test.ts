/**
 * Clean consumer installs for each supported JavaScript, TypeScript, and React combination. These tests
 * install the shipped dependency ranges from the npm registry, so they need network access. Run them with
 * `npm run test:consumer` whenever a preset or the dependency set changes.
 */

import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../../src/cli/main.js";
import type { OutputDocument } from "../../src/cli/output.js";
import { systemRunner } from "../../src/platform/process.js";
import { tempProject } from "../helpers.js";

const isWindows = process.platform === "win32";

/**
 * Plugins bundled by `@wordpress/eslint-plugin` whose peer ranges stop at ESLint 9, as documented in the
 * README. `npm ls` may report ESLint as invalid for these and nothing else.
 */
const knownPeerWarnings = ["eslint-plugin-react", "eslint-plugin-import", "eslint-plugin-jsx-a11y"];

interface Combination {
  standard: "community" | "wordpress";
  languages: Array<"javascript" | "typescript">;
  react: boolean;
}

const combinations: Combination[] = (["community", "wordpress"] as const).flatMap((standard) =>
  [["javascript"], ["typescript"], ["javascript", "typescript"]].flatMap((languages) =>
    [false, true].map((react) => ({ standard, languages: languages as Combination["languages"], react })),
  ),
);

/**
 * Returns passing sample sources for a combination.
 */
function sources(combination: Combination): Record<string, string> {
  const files: Record<string, string> = { "README.md": "# Consumer\n\nA sample project.\n" };
  const quote = combination.standard === "wordpress" ? "'" : '"';

  if (combination.languages.includes("javascript")) {
    files["src/greeting.js"] = `export const greeting = ${quote}Hello${quote};\n`;
  }

  if (combination.languages.includes("typescript")) {
    files["src/count.ts"] = "export function count(items: string[]): number {\n\treturn items.length;\n}\n";

    if (combination.standard === "community") {
      files["src/count.ts"] = files["src/count.ts"].replace("\t", "  ");
    }
  }

  if (combination.react) {
    const extension = combination.languages.includes("typescript") ? "tsx" : "jsx";
    const body =
      combination.standard === "wordpress"
        ? `export function Title() {\n\treturn <h1>Hello</h1>;\n}\n`
        : `export function Title() {\n  return <h1>Hello</h1>;\n}\n`;

    files[`src/title.${extension}`] = body;
  }

  return files;
}

/**
 * Runs an npm command in the consumer and returns its status and output.
 */
function npm(root: string, ...args: string[]): { status: number | null; output: string } {
  const result = spawnSync("npm", args, { cwd: root, encoding: "utf8", shell: isWindows });

  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe.concurrent("clean consumer installs", () => {
  it.each(combinations)("$standard standard with $languages and React $react", async (combination) => {
    // Configra keeps a manifest's indentation, so start from the style the standard formats with.
    const indent = combination.standard === "wordpress" ? "\t" : 2;
    const root = tempProject({
      "package.json": `${JSON.stringify({ name: "consumer", private: true, type: "module" }, null, indent)}\n`,
      ...sources(combination),
    });

    spawnSync("git", ["init", "-q"], { cwd: root });

    const argv = [
      "init",
      "--json",
      "--install",
      "--languages",
      combination.languages.join(","),
      "--ui",
      combination.react ? "react" : "",
      ...combination.languages.map((language) => `--standard=${language}=${combination.standard}`),
    ];
    let stdout = "";

    const code = await run(argv, {
      stdout: (text) => (stdout += text),
      stderr: () => undefined,
      cwd: root,
      stdinIsTTY: false,
      stdoutIsTTY: false,
      env: {},
      runner: systemRunner,
    });
    const document = JSON.parse(stdout) as OutputDocument;

    expect(code, JSON.stringify(document.diagnostics)).toBe(0);

    // Lifecycle scripts stay off, so installing doesn't activate hooks.
    expect(existsSync(join(root, ".git/hooks/pre-commit"))).toBe(false);

    for (const script of ["lint", "format:check"]) {
      const result = npm(root, "run", script);

      expect(result.status, `${script}: ${result.output}`).toBe(0);
    }

    const listing = npm(root, "ls", "--all");

    // Match npm's `invalid:` markers, not package names such as `character-reference-invalid`.
    const invalid = listing.output.split("\n").filter((line) => /(^|\s)invalid:/.test(line));
    const dependents = invalid.flatMap((line) =>
      [...line.matchAll(/from (\S+?),?(?=\s|$)/g)].map((match) => (match[1] ?? "").split("node_modules/").at(-1) ?? ""),
    );

    if (combination.standard === "community") {
      expect(listing.status, listing.output).toBe(0);
    } else {
      expect(invalid.length).toBeGreaterThan(0);
      expect(
        invalid.every((line) => line.includes("eslint@")),
        invalid.join("\n"),
      ).toBe(true);
      expect(new Set(dependents), invalid.join("\n")).toEqual(new Set(knownPeerWarnings));
    }

    const failing = combination.languages.includes("typescript") ? "src/bad.ts" : "src/bad.js";

    writeFileSync(join(root, failing), "const unused = 1;\n");
    expect(npm(root, "run", "lint").status).not.toBe(0);
  });
});
