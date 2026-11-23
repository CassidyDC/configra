/**
 * Clean consumer installs for a WordPress site with npm and Composer. These tests install the shipped
 * dependency ranges from the npm registry and Packagist, so they need network access, PHP, and Composer.
 * Run them with `npm run test:consumer`.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../../src/cli/main.js";
import type { OutputDocument } from "../../src/cli/output.js";
import { systemRunner } from "../../src/platform/process.js";
import { tempProject } from "../helpers.js";

const isWindows = process.platform === "win32";
const hasPhp = spawnSync("php", ["--version"], { shell: isWindows }).status === 0;
const hasComposer = spawnSync("composer", ["--version"], { shell: isWindows }).status === 0;

const plugin = "wp-content/plugins/shop";
const theme = "wp-content/themes/brand";

const site = {
  "wp-config.php": "<?php\n",
  "wp-includes/js/core.js": "var   x=1;;\n",
  "readme.html": "<p>core\n",
  [`${plugin}/shop.php`]: [
    "<?php",
    "/**",
    " * Plugin Name: Shop",
    " * Requires PHP: 7.4",
    " * Text Domain: shop",
    " *",
    " * @package Shop",
    " */",
    "",
    "/**",
    " * Returns the greeting.",
    " *",
    " * @return string",
    " */",
    "function shop_greeting() {",
    "\treturn __( 'Hello', 'shop' );",
    "}",
    "",
  ].join("\n"),
  [`${theme}/style.css`]: "/*\nTheme Name: Brand\nText Domain: brand\n*/\n\nbody {\n\tcolor: #000;\n}\n",
  [`${theme}/main.js`]: "const greeting = 'Hello';\n\nexport default greeting;\n",
  "wp-content/plugins/other/broken.php": "<?php function (\n",
};

/**
 * Runs a command in the project and returns its status and output.
 */
function exec(root: string, command: string, ...args: string[]): { status: number | null; output: string } {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", shell: isWindows });

  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

/**
 * Runs Configra in-process with real executables and returns its JSON document.
 */
async function configra(root: string, ...argv: string[]): Promise<OutputDocument> {
  let stdout = "";

  await run([...argv, "--json"], {
    stdout: (text) => (stdout += text),
    stderr: () => undefined,
    cwd: root,
    stdinIsTTY: false,
    stdoutIsTTY: false,
    env: {},
    runner: systemRunner,
  });

  return JSON.parse(stdout) as OutputDocument;
}

/**
 * Writes a project file.
 */
function write(root: string, path: string, content: string): void {
  writeFileSync(join(root, path), content);
}

// CI sets CONFIGRA_EXPECT_PHP so a missing toolchain fails instead of skipping the tests.
const skip = (!hasPhp || !hasComposer) && process.env.CONFIGRA_EXPECT_PHP !== "1";

describe.skipIf(skip)("WordPress site consumer installs", () => {
  it("installs npm and Composer tools and runs every check on the selected directories only", async () => {
    const root = tempProject(site);

    const document = await configra(
      root,
      "init",
      "--project",
      "wordpress-site",
      "--package",
      plugin,
      "--package",
      theme,
      "--install",
    );

    expect(document.exitCode, JSON.stringify(document.diagnostics)).toBe(0);
    expect(document.phases?.map((phase) => phase.status)).toEqual(["done", "done", "done"]);

    // Core files and the unselected plugin would fail these checks if they were in scope.
    for (const script of ["lint", "format:check"]) {
      const result = exec(root, "npm", "run", script);

      expect(result.status, `${script}: ${result.output}`).toBe(0);
    }

    const failures: Array<[string, string, string]> = [
      ["lint:php-syntax", `${plugin}/syntax.php`, "<?php function broken( {\n"],
      ["lint:phpcs", `${plugin}/style.php`, '<?php\nfunction no_prefix() { echo $_GET["x"]; }\n'],
      [
        "lint:phpstan",
        `${plugin}/undefined.php`,
        "<?php\n/**\n * Calls a missing function.\n *\n * @package Shop\n */\n\nshop_missing();\n",
      ],
      ["lint:css", `${theme}/bad.css`, "a {\n\tcolour: red;\n}\n"],
      ["lint:js", `${theme}/bad.js`, "const unused = 1;\n"],
    ];

    for (const [script, path, content] of failures) {
      write(root, path, content);
      expect(exec(root, "npm", "run", script).status, script).not.toBe(0);
      rmSync(join(root, path));
    }

    // A fresh clone without Configra runs the same checks after installing the declared tools, which
    // also proves the generated .gitignore keeps every file the checks need.
    const checkout = join(tempProject(), "checkout");

    for (const args of [
      ["init", "-q"],
      ["add", "-A"],
      ["-c", "user.name=T", "-c", "user.email=t@e.com", "commit", "-qm", "Set up"],
    ]) {
      expect(exec(root, "git", ...args).status).toBe(0);
    }

    expect(exec(root, "git", "clone", "-q", ".", checkout).status).toBe(0);
    expect(exec(checkout, "npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund").status).toBe(0);
    expect(exec(checkout, "composer", "install", "--no-scripts", "--no-interaction").status).toBe(0);
    expect(exec(checkout, "npm", "run", "lint").status).toBe(0);
  });

  it("installs the community CSS and PHP standards", async () => {
    const root = tempProject({
      "wp-config.php": "<?php\n",
      [`${plugin}/src/Greeter.php`]: [
        "<?php",
        "",
        "namespace Shop;",
        "",
        "class Greeter",
        "{",
        "    public function greet(): string",
        "    {",
        "        return 'Hello';",
        "    }",
        "}",
        "",
      ].join("\n"),
      [`${plugin}/style.css`]: "a {\n\tcolor: #000;\n}\n",
    });

    const document = await configra(
      root,
      "init",
      "--project",
      "wordpress-site",
      "--package",
      plugin,
      "--languages",
      "css,php",
      "--standard",
      "css=community",
      "--standard",
      "php=community",
      "--install",
    );

    expect(document.exitCode, JSON.stringify(document.diagnostics)).toBe(0);

    for (const script of ["lint:css", "lint:php-syntax", "lint:phpcs", "lint:phpstan"]) {
      const result = exec(root, "npm", "run", script);

      expect(result.status, `${script}: ${result.output}`).toBe(0);
    }

    write(root, `${plugin}/src/bad.php`, "<?php\nfunction badName( ){ return 1 ;}\n");
    expect(exec(root, "npm", "run", "lint:phpcs").status).not.toBe(0);
    write(root, `${plugin}/bad.css`, "a {\n\tcolour: red;\n}\n");
    expect(exec(root, "npm", "run", "lint:css").status).not.toBe(0);
  });

  it("keeps unrelated locked versions, skips lifecycle scripts, and respects plugin settings", async () => {
    const root = tempProject({ ...site });

    // Lock an older psr/log, then widen the constraint so a full update would upgrade it.
    const composer = (log: string) => ({
      require: { "psr/log": log },
      scripts: { "post-update-cmd": "php -r \"touch('lifecycle-ran');\"" },
      config: { "allow-plugins": { "composer/installers": true, "php-http/discovery": false } },
    });

    write(root, "composer.json", `${JSON.stringify(composer("1.1.4"), null, "\t")}\n`);
    expect(exec(root, "composer", "update", "--no-scripts", "--no-interaction").status).toBe(0);
    write(root, "composer.json", `${JSON.stringify(composer("^1.1 || ^2 || ^3"), null, "\t")}\n`);

    const document = await configra(root, "init", "--project", "wordpress-site", "--package", plugin, "--install");

    expect(document.exitCode, JSON.stringify(document.diagnostics)).toBe(0);

    const lock = JSON.parse(readFileSync(join(root, "composer.lock"), "utf8")) as {
      packages: Array<{ name: string; version: string }>;
    };
    const manifest = JSON.parse(readFileSync(join(root, "composer.json"), "utf8")) as {
      config: { "allow-plugins": Record<string, boolean> };
    };

    expect(lock.packages.find((entry) => entry.name === "psr/log")?.version).toBe("1.1.4");
    expect(existsSync(join(root, "lifecycle-ran"))).toBe(false);
    expect(manifest.config["allow-plugins"]).toEqual({
      "composer/installers": true,
      "php-http/discovery": false,
      "dealerdirect/phpcodesniffer-composer-installer": true,
    });
    expect(exec(root, "npm", "run", "lint:phpcs").status).toBe(0);
  });
});
