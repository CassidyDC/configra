import { describe, expect, it } from "vitest";
import { defaultTools, normalizeSelections } from "../../src/generator/normalize.js";

describe("normalizeSelections", () => {
  it("fills preset defaults", () => {
    const { selections, diagnostics } = normalizeSelections({}, undefined, "node");

    expect(diagnostics).toEqual([]);
    expect(selections).toMatchObject({
      project: "node",
      languages: ["javascript"],
      ui: [],
      standards: { javascript: "community" },
      tools: ["editorconfig", "gitignore", "prettier", "markdownlint", "eslint", "lefthook"],
      commitMessages: "plain",
    });
  });

  it("lets flags override saved values and saved values override defaults", () => {
    const { selections } = normalizeSelections(
      { languages: ["typescript"], commitMessages: "conventional" },
      { version: 1, project: "node", languages: ["javascript"], ui: ["react"], commitMessages: "off" },
      "node",
    );

    expect(selections?.languages).toEqual(["typescript"]);
    expect(selections?.ui).toEqual(["react"]);
    expect(selections?.commitMessages).toBe("conventional");
  });

  it("clears a list with an explicit empty value", () => {
    const { selections } = normalizeSelections({ ui: [] }, { version: 1, project: "node", ui: ["react"] }, "node");

    expect(selections?.ui).toEqual([]);
  });

  it("merges standards by language", () => {
    const { selections } = normalizeSelections(
      { languages: ["javascript", "typescript"], standards: ["javascript=wordpress", "typescript=wordpress"] },
      undefined,
      "node",
    );

    expect(selections?.standards).toEqual({ javascript: "wordpress", typescript: "wordpress" });
  });

  it("rejects JavaScript and TypeScript on different standards and lists the supported combinations", () => {
    const { selections, diagnostics } = normalizeSelections(
      { languages: ["javascript", "typescript"], standards: ["typescript=wordpress"] },
      undefined,
      "node",
    );

    expect(selections).toBeUndefined();
    expect(diagnostics[0]?.code).toBe("SELECTION_UNSUPPORTED_STANDARDS");
    expect(diagnostics[0]?.message).toContain("javascript=community with typescript=community");
  });

  it("rejects a tool whose language isn't selected", () => {
    const { diagnostics } = normalizeSelections({ languages: [], tools: ["eslint"] }, undefined, "node");

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("SELECTION_TOOL_NEEDS_LANGUAGE");
  });

  it("rejects React without a script language", () => {
    const { diagnostics } = normalizeSelections({ languages: [], ui: ["react"], tools: [] }, undefined, "node");

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("SELECTION_UI_NEEDS_LANGUAGE");
  });

  it("rejects selected packages outside the WordPress preset and paths outside the project", () => {
    const node = normalizeSelections({ packages: ["plugins/a"] }, undefined, "node");
    const escaping = normalizeSelections({ packages: ["../elsewhere"] }, undefined, "node");

    expect(node.diagnostics.map((diagnostic) => diagnostic.code)).toContain("SELECTION_PACKAGES_UNSUPPORTED");
    expect(escaping.diagnostics.map((diagnostic) => diagnostic.code)).toContain("SELECTION_INVALID_PACKAGE");
  });

  it("derives default tools from the languages", () => {
    expect(defaultTools(["typescript"])).toContain("eslint");
    expect(defaultTools(["css", "php"])).toEqual([
      "editorconfig",
      "gitignore",
      "prettier",
      "markdownlint",
      "stylelint",
      "php-lint",
      "phpcs",
      "phpstan",
      "lefthook",
    ]);
  });
});
