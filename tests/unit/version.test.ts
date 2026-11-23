import { describe, expect, it } from "vitest";
import { run } from "../../src/cli/main.js";
import manifest from "../../package.json" with { type: "json" };

describe("configra --version", () => {
  it("prints the package version", async () => {
    let output = "";
    const code = await run(["--version"], { stdout: (text) => (output += text), stderr: () => {} });

    expect(code).toBe(0);
    expect(output).toBe(`${manifest.version}\n`);
  });
});
