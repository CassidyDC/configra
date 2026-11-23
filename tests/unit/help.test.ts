import { describe, expect, it } from "vitest";
import { commandHelp, overviewHelp } from "../../src/cli/help.js";
import { acceptsOption, commands, options } from "../../src/cli/options.js";
import { runCli, tempProject } from "../helpers.js";

describe("help output", () => {
  it("lists every option each command accepts, with its accepted values", () => {
    for (const command of commands) {
      const help = commandHelp(command.name);

      for (const option of options.filter((candidate) => acceptsOption(candidate, command.name))) {
        expect(help).toContain(`--${option.name}`);

        for (const value of option.values ?? []) {
          expect(help).toContain(value);
        }
      }

      expect(help).toContain("Exit codes:");
      expect(help).toContain("Examples:");
      expect(help).toContain("Save config only");
    }
  });

  it("shows only shared options in the overview", () => {
    const help = overviewHelp("1.2.3");

    expect(help).toContain("Configra 1.2.3");
    expect(help).toContain("--cwd");
    expect(help).not.toContain("--dry-run");
  });

  it("works outside a project for bare configra, both aliases, and command help", async () => {
    const outside = tempProject();

    for (const argv of [[], ["--help"], ["-h"], ["init", "--help"], ["update", "-h"]]) {
      const result = await runCli(argv, outside);

      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/Usage: configra/);
      expect(result.stderr).toBe("");
    }
  });
});
