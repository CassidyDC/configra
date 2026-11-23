import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  batches,
  collectFiles,
  isExcluded,
  lint,
  MAX_COMMAND_LENGTH,
} from "../../src/components/tools/assets/php-lint.mjs";
import { exitCode } from "../../src/components/tools/assets/php-tool.mjs";
import { parseHeaders, suggestPrefix } from "../../src/generator/wordpress.js";
import { tempProject } from "../helpers.js";

const isWindows = process.platform === "win32";
const originalPath = process.env.PATH;

afterEach(() => {
  process.env.PATH = originalPath;
});

/**
 * Puts a fake `php` first on PATH that reports the given version ID and logs each `-l` call's files.
 */
function fakePhp(versionId: number): string {
  const bin = tempProject();
  const log = join(bin, "calls.log");

  writeFileSync(
    join(bin, "php"),
    [
      "#!/bin/sh",
      `if [ "$1" = "-r" ]; then printf ${versionId}; exit 0; fi`,
      "shift 5",
      `echo "$*" >> ${JSON.stringify(log)}`,
      'for file in "$@"; do echo "No syntax errors detected in $file"; done',
    ].join("\n"),
  );
  chmodSync(join(bin, "php"), 0o755);
  process.env.PATH = `${bin}${delimiter}${originalPath ?? ""}`;

  return log;
}

describe("php-lint helper", () => {
  it("matches exclusions in .gitignore syntax", () => {
    const excluded = ["vendor/", "dev/archive/", "*.min.php"];

    expect(isExcluded("wp-content/plugins/shop/vendor/autoload.php", excluded)).toBe(true);
    expect(isExcluded("dev/archive/old.php", excluded)).toBe(true);
    expect(isExcluded("src/dev/archive/old.php", excluded)).toBe(false);
    expect(isExcluded("lib/app.min.php", excluded)).toBe(true);
    expect(isExcluded("lib/app.php", excluded)).toBe(false);
  });

  it("collects PHP files from directories and files, skipping exclusions", () => {
    const root = tempProject({
      "plugin/a.php": "",
      "plugin/inc/b.php": "",
      "plugin/vendor/c.php": "",
      "plugin/readme.txt": "",
      "loader.php": "",
    });

    expect(collectFiles(["plugin", "loader.php", "missing"], ["vendor/"], root)).toEqual([
      "plugin/a.php",
      "plugin/inc/b.php",
      "loader.php",
    ]);
  });

  it("splits long file lists into batches under the command-line limit", () => {
    const files = Array.from({ length: 5000 }, (_, index) => `wp-content/plugins/shop/includes/file-${index}.php`);
    const groups = batches(files, 40);

    expect(groups.length).toBeGreaterThan(1);
    expect(groups.flat()).toEqual(files);

    for (const group of groups) {
      expect(40 + group.reduce((total, file) => total + file.length + 3, 0)).toBeLessThanOrEqual(MAX_COMMAND_LENGTH);
    }

    expect(batches(["a.php", "b.php", "c.php"], 0, 10)).toEqual([["a.php"], ["b.php"], ["c.php"]]);
  });

  it.skipIf(isWindows)("lints in one batch on PHP 8.3 and one file at a time before it", () => {
    const files = ["a.php", "b.php", "c.php"];
    const batched = fakePhp(80_300);

    expect(lint(files)).toBe(0);
    expect(readFileSync(batched, "utf8").trim().split("\n")).toEqual(["a.php b.php c.php"]);

    const single = fakePhp(80_200);

    expect(lint(files)).toBe(0);
    expect(readFileSync(single, "utf8").trim().split("\n")).toEqual(files);
  });
});

describe("php-tool helper", () => {
  it("maps fixed phpcbf runs and empty PHPStan path sets to success", () => {
    expect(exitCode("phpcbf", 1, "")).toBe(0);
    expect(exitCode("phpcbf", 2, "")).toBe(2);
    expect(exitCode("phpstan", 1, " [ERROR] No files found to analyse.")).toBe(0);
    expect(exitCode("phpstan", 1, " [ERROR] Found 1 error")).toBe(1);
    expect(exitCode("phpcs", 2, "")).toBe(2);
  });
});

describe("WordPress headers", () => {
  it("reads plugin and theme headers like get_file_data", () => {
    expect(
      parseHeaders("<?php\n/**\n * Plugin Name: Shop\n * Requires PHP: 8.1\n * Text Domain:  shop \n */\n"),
    ).toEqual({ name: "Shop", requiresPhp: "8.1", textDomain: "shop" });
    expect(parseHeaders("/*\nTheme Name: Brand\nRequires at least: 6.5 */\n")).toEqual({
      name: "Brand",
      requiresWordPress: "6.5",
    });
  });

  it("suggests prefixes that start with a letter", () => {
    expect(suggestPrefix("wp-content/plugins/my-shop")).toBe("my_shop");
    expect(suggestPrefix("wp-content/mu-plugins/Loader.php")).toBe("loader");
    expect(suggestPrefix("wp-content/plugins/2fa")).toBe("p_2fa");
  });
});
