import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderDependencyRanges } from "../../dev/scripts/generate-dependency-ranges.js";

describe("shipped dependency ranges", () => {
  it("match the dependency-set fixture manifests", () => {
    const generated = readFileSync(new URL("../../src/components/dependency-ranges.ts", import.meta.url), "utf8");

    expect(generated).toBe(renderDependencyRanges());
  });
});
