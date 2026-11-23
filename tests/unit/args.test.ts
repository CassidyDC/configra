import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../../src/cli/args.js";

describe("parseCliArgs", () => {
  it("parses a command with list, repeatable, and boolean options", () => {
    const result = parseCliArgs([
      "init",
      "--project",
      "wordpress-site",
      "--package",
      "wp-content/plugins/a",
      "--package",
      "wp-content/themes/b",
      "--languages",
      "javascript, typescript",
      "--standard",
      "php=community",
      "--dry-run",
    ]);

    expect(result.ok).toBe(true);
    expect(result.args).toMatchObject({
      command: "init",
      project: "wordpress-site",
      packages: ["wp-content/plugins/a", "wp-content/themes/b"],
      languages: ["javascript", "typescript"],
      standards: ["php=community"],
      dryRun: true,
      hasSelectionFlags: true,
    });
  });

  it("treats an empty list value as an explicit empty list", () => {
    const result = parseCliArgs(["update", "--ui="]);

    expect(result.ok).toBe(true);
    expect(result.args.ui).toEqual([]);
  });

  it("rejects unknown options and commands with stable codes", () => {
    const unknownOption = parseCliArgs(["init", "--nope"]);
    const unknownCommand = parseCliArgs(["deploy"]);

    expect(unknownOption.ok).toBe(false);
    expect(!unknownOption.ok && unknownOption.diagnostics[0]?.code).toBe("ARG_UNKNOWN_OPTION");
    expect(!unknownCommand.ok && unknownCommand.diagnostics[0]?.code).toBe("ARG_UNKNOWN_COMMAND");
  });

  it("rejects command options without a command", () => {
    const result = parseCliArgs(["--dry-run"]);

    expect(!result.ok && result.diagnostics[0]?.code).toBe("ARG_OPTION_NOT_SUPPORTED");
  });

  it("rejects --interactive with --dry-run or --json", () => {
    for (const flag of ["--dry-run", "--json"]) {
      const result = parseCliArgs(["init", "--interactive", flag]);

      expect(!result.ok && result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("ARG_CONFLICT");
    }
  });

  it("requires --dry-run for --exit-code", () => {
    const result = parseCliArgs(["update", "--exit-code"]);

    expect(!result.ok && result.diagnostics[0]?.code).toBe("ARG_REQUIRES");
  });

  it("validates single-value options against the registry", () => {
    const result = parseCliArgs(["init", "--project", "rails"]);

    expect(!result.ok && result.diagnostics[0]?.message).toContain("node, wordpress-site");
  });
});
