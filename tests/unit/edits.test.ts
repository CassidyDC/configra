import { describe, expect, it } from "vitest";
import { deleteAt, editLines, fromPointer, serializeJson, setAt, toPointer } from "../../src/generator/edits.js";

describe("JSON edits", () => {
  it("round-trips JSON Pointers for scoped package names", () => {
    const pointer = toPointer(["devDependencies", "@eslint/js"]);

    expect(pointer).toBe("/devDependencies/@eslint~1js");
    expect(fromPointer(pointer)).toEqual(["devDependencies", "@eslint/js"]);
  });

  it("inserts dependencies in sorted position and keeps other key order", () => {
    const updated = setAt(
      { name: "x", devDependencies: { a: "1", c: "1" }, scripts: {} },
      ["devDependencies", "b"],
      "2",
    );

    expect(Object.keys(updated)).toEqual(["name", "devDependencies", "scripts"]);
    expect(Object.keys(updated.devDependencies as object)).toEqual(["a", "b", "c"]);
  });

  it("drops parent objects a removal leaves empty", () => {
    expect(deleteAt({ scripts: { lint: "x" }, name: "y" }, ["scripts", "lint"])).toEqual({ name: "y" });
  });

  it("keeps the original indentation and line endings", () => {
    expect(serializeJson({ a: 1 }, '{\r\n\t"b": 2\r\n}\r\n')).toBe('{\r\n\t"a": 1\r\n}\r\n');
  });
});

describe("line edits", () => {
  it("appends new lines in one group and removes only the listed lines", () => {
    expect(editLines("dist/\n# mine\n", ["node_modules/"], ["dist/"])).toBe("# mine\n\nnode_modules/\n");
  });

  it("preserves CRLF line endings", () => {
    expect(editLines("a\r\n", ["b"], [])).toBe("a\r\n\r\nb\r\n");
  });
});
