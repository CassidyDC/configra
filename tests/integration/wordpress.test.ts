import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { accept, recordingRunner, runJson, runTerminal, tempProject } from "../helpers.js";

const plugin = (name: string, headers = "") => `<?php\n/**\n * Plugin Name: ${name}\n${headers} */\n`;

/** A full site checkout with core, two plugins, a single-file must-use plugin, and a theme. */
const fullSite = {
  "wp-config.php": "<?php\n",
  "wp-includes/version.php": "<?php\n",
  "wp-includes/js/core.js": "var x = 1\n",
  "readme.html": "<html></html>\n",
  "wp-content/plugins/shop/shop.php": plugin(
    "Shop",
    " * Requires PHP: 8.1\n * Requires at least: 6.5\n * Text Domain: shop-text\n",
  ),
  "wp-content/plugins/other/other.php": plugin("Other"),
  "wp-content/mu-plugins/loader.php": plugin("Loader"),
  "wp-content/themes/brand/style.css": "/*\nTheme Name: Brand\nRequires PHP: 7.4\n*/\n",
  "wp-content/themes/brand/functions.php": "<?php\n",
};

/** A wp-content project without core. */
const contentProject = {
  "plugins/shop/shop.php": plugin("Shop"),
  "plugins/other/other.php": plugin("Other"),
  "themes/brand/style.css": "/*\nTheme Name: Brand\n*/\n",
};

const site = ["init", "--project", "wordpress-site"];

/**
 * Reads a project file.
 */
function read(root: string, path: string): string {
  return readFileSync(join(root, path), "utf8");
}

/**
 * Returns a diagnostic code list.
 */
function codes(document: { diagnostics: Array<{ code: string }> }): string[] {
  return document.diagnostics.map((diagnostic) => diagnostic.code);
}

describe("WordPress site checks", () => {
  it("checks only the selected plugin and theme in a full site", async () => {
    const root = tempProject(fullSite);
    const packages = ["--package", "wp-content/plugins/shop", "--package", "wp-content/themes/brand"];
    const { code, document } = await runJson([...site, ...packages], root);

    expect(code, JSON.stringify(document.diagnostics)).toBe(0);

    const phpcs = read(root, ".configra/phpcs.xml");
    const phpstan = read(root, ".configra/phpstan.neon");
    const scripts = (JSON.parse(read(root, "package.json")) as { scripts: Record<string, string> }).scripts;
    const lefthook = read(root, "lefthook.yml");

    expect(phpcs).toContain("<file>../wp-content/plugins/shop</file>");
    expect(phpcs).toContain("<file>../wp-content/themes/brand</file>");
    expect(phpcs).not.toContain("other");
    expect(phpstan).toMatch(/paths:\n\t\t- \.\.\/wp-content\/plugins\/shop\n\t\t- \.\.\/wp-content\/themes\/brand\n/);
    expect(phpstan).toMatch(/scanDirectories:\n\t\t- \.\.\/wp-content\/plugins\/other\n/);

    for (const script of Object.values(scripts)) {
      expect(script).not.toMatch(/wp-includes|wp-admin|plugins\/other/);
    }

    expect(scripts["lint:js"]).toContain('"wp-content/plugins/shop/**/*.{js,mjs,cjs}"');
    expect(scripts["format:check"]).not.toContain(" .");
    expect(lefthook).toContain('- "wp-content/plugins/shop/**/*.php"');
    expect(lefthook).toMatch(/pre-push:\n {2}commands:\n {4}phpstan:/);
    expect(lefthook).not.toContain("wp-includes");

    // The personal override files are ignored, but the managed configs they share a name with are not.
    spawnSync("git", ["init", "-q"], { cwd: root });

    const ignored = spawnSync(
      "git",
      ["check-ignore", "phpcs.xml", "phpstan.neon", ".configra/phpcs.xml", ".configra/phpstan.neon"],
      { cwd: root, encoding: "utf8" },
    );

    expect(ignored.stdout.split(/\r?\n/).filter(Boolean)).toEqual(["phpcs.xml", "phpstan.neon"]);
  });

  it("finds plugins and themes at the root of a wp-content project", async () => {
    const root = tempProject(contentProject);
    const preview = await runJson(["init", "--dry-run"], root);

    expect(codes(preview.document)).toContain("INIT_WORDPRESS_DETECTED");
    expect(preview.document.discovery?.wordpress).toEqual({
      kind: "wp-content",
      candidates: ["plugins/other", "plugins/shop", "themes/brand"],
    });

    expect((await runJson([...site, "--package", "plugins/shop"], root)).code).toBe(0);
    expect(read(root, ".configra/phpstan.neon")).toContain("- ../plugins/other\n");
  });

  it("checks a selected single-file must-use plugin directly", async () => {
    const root = tempProject(fullSite);

    expect((await runJson([...site, "--package", "wp-content/mu-plugins/loader.php"], root)).code).toBe(0);
    expect(read(root, ".configra/phpcs.xml")).toContain("<file>../wp-content/mu-plugins/loader.php</file>");
    expect(read(root, "lefthook.yml")).toContain('- "wp-content/mu-plugins/loader.php"');
  });

  it("needs a selected directory for the PHP tools", async () => {
    const { code, document } = await runJson([...site, "--dry-run"], tempProject(fullSite));

    expect(code).toBe(1);
    expect(codes(document)).toContain("SELECTION_PHP_NEEDS_PACKAGE");

    const rootOnly = await runJson(
      [...site, "--dry-run", "--languages", "javascript", "--tools", "prettier"],
      tempProject(fullSite),
    );

    expect(rootOnly.code).toBe(0);
  });

  it("saves versions, text domains, and prefixes from the headers and keeps them on reruns", async () => {
    const root = tempProject(fullSite);
    const packages = ["--package", "wp-content/plugins/shop", "--package", "wp-content/themes/brand"];
    const { document } = await runJson([...site, ...packages], root);

    expect(codes(document)).toContain("SELECTION_PHP_VERSIONS_DIFFER");

    const config = JSON.parse(read(root, ".configra/config.json")) as Record<string, unknown>;

    expect(config.php).toEqual({ targetVersion: "7.4" });
    expect(config.wordpress).toEqual({
      minimumVersion: "6.5",
      packages: {
        "wp-content/plugins/shop": { textDomain: "shop-text", prefix: "shop" },
        "wp-content/themes/brand": { textDomain: "brand", prefix: "brand" },
      },
    });
    expect(read(root, ".configra/phpstan.neon")).toContain("phpVersion: 70400");
    expect(read(root, ".configra/phpcs.xml")).toContain('<config name="minimum_wp_version" value="6.5"/>');

    // A header change doesn't move saved values, so another checkout plans the same files.
    writeFileSync(join(root, "wp-content/plugins/shop/shop.php"), plugin("Shop", " * Text Domain: renamed\n"));

    const rerun = await runJson(["update", "--dry-run", "--exit-code"], root);

    expect(rerun.document.changes).toEqual([]);
  });

  it("drops a deselected directory from every check without touching its files", async () => {
    const root = tempProject(fullSite);
    const theme = join(root, "wp-content/themes/brand");
    const before = readdirSync(theme).map((name) => [name, read(theme, name)]);

    await runJson([...site, "--package", "wp-content/plugins/shop", "--package", "wp-content/themes/brand"], root);

    const { code, document } = await runJson(["update", "--package", "wp-content/plugins/shop"], root);

    expect(code, JSON.stringify(document.diagnostics)).toBe(0);
    expect(read(root, ".configra/phpcs.xml")).not.toContain("themes/brand</file>");
    expect(read(root, ".configra/phpstan.neon")).toContain(
      "scanDirectories:\n\t\t- ../wp-content/plugins/other\n\t\t- ../wp-content/themes/brand\n",
    );
    expect(JSON.parse(read(root, ".configra/config.json")).wordpress.packages).not.toHaveProperty(
      "wp-content/themes/brand",
    );
    expect(readdirSync(theme).map((name) => [name, read(theme, name)])).toEqual(before);
  });
});

describe("composer.json", () => {
  const packages = ["--package", "wp-content/plugins/shop"];

  it("reuses a compatible production requirement and asks about an incompatible one", async () => {
    const compatible = tempProject({
      ...fullSite,
      "composer.json": '{\n\t"require": {\n\t\t"phpstan/phpstan": "^2.3.9"\n\t}\n}\n',
    });

    expect((await runJson([...site, ...packages], compatible)).code).toBe(0);

    const manifest = JSON.parse(read(compatible, "composer.json")) as Record<string, Record<string, string>>;

    expect(manifest.require).toEqual({ "phpstan/phpstan": "^2.3.9" });
    expect(manifest["require-dev"]).not.toHaveProperty("phpstan/phpstan");

    const incompatible = tempProject({
      ...fullSite,
      "composer.json": '{\n\t"require": {\n\t\t"phpstan/phpstan": "^1.12"\n\t}\n}\n',
    });

    const { code, document } = await runJson([...site, ...packages], incompatible);

    expect(code).toBe(2);
    expect(document.conflicts.map((conflict) => conflict.id)).toContain("composer.json#/require/phpstan~1phpstan");
  });

  it("keeps a plugin denial and stops an install that would leave the standard unregistered", async () => {
    const denied = {
      ...fullSite,
      "composer.json":
        '{\n\t"config": {\n\t\t"allow-plugins": {\n\t\t\t"dealerdirect/phpcodesniffer-composer-installer": false\n\t\t}\n\t}\n}\n',
    };

    const root = tempProject(denied);
    const preview = await runJson([...site, ...packages, "--dry-run"], root);

    expect(codes(preview.document)).toContain("PLAN_COMPOSER_PLUGIN_DENIED");

    const install = await runJson([...site, ...packages, "--install"], root, recordingRunner());

    expect(install.code).toBe(1);
    expect(codes(install.document)).toContain("INSTALL_COMPOSER_PLUGIN_DENIED");
    expect(read(root, "composer.json")).toBe(denied["composer.json"]);

    // A blanket allowance already covers the installer, so no entry is added.
    const allowed = tempProject({
      ...fullSite,
      "composer.json": '{\n\t"config": {\n\t\t"allow-plugins": true\n\t}\n}\n',
    });

    await runJson([...site, ...packages], allowed);
    expect(JSON.parse(read(allowed, "composer.json")).config).toEqual({ "allow-plugins": true });
  });

  it("updates only the managed packages when a lockfile exists and installs npm first", async () => {
    const root = tempProject({ ...fullSite, "composer.lock": "{}\n" });
    const runner = recordingRunner();
    const { code, document } = await runJson([...site, ...packages, "--install"], root, runner);

    expect(code, JSON.stringify(document.diagnostics)).toBe(0);
    expect(runner.calls).toEqual([
      "npm install --ignore-scripts --no-audit --no-fund",
      "composer update dealerdirect/phpcodesniffer-composer-installer phpstan/phpstan squizlabs/php_codesniffer szepeviktor/phpstan-wordpress wp-coding-standards/wpcs --with-dependencies --minimal-changes --no-scripts --no-interaction --no-progress",
    ]);
    expect(document.phases?.map((phase) => [phase.phase, phase.manager, phase.status])).toEqual([
      ["apply", undefined, "done"],
      ["install", "npm", "done"],
      ["install", "composer", "done"],
    ]);
  });

  it("removes the last managed requirement and reconciles it on a later install", async () => {
    const root = tempProject({ ...fullSite, "composer.lock": "{}\n" });

    await runJson([...site, ...packages], root);

    const jsOnly = ["update", "--languages", "javascript", "--tools", "editorconfig,gitignore,prettier,eslint"];
    const removed = await runJson(jsOnly, root);

    expect(removed.code, JSON.stringify(removed.document.diagnostics)).toBe(0);
    expect(removed.document.dependencies.composer.remove).toContain("phpstan/phpstan");
    expect(removed.document.commands.find((command) => command.manager === "composer")?.args).toContain(
      "phpstan/phpstan",
    );
    expect(JSON.parse(read(root, "composer.json"))["require-dev"] ?? {}).toEqual({});
  });
});

describe("WordPress setup wizard", () => {
  it("suggests the site's directories and asks to confirm text domains and prefixes", async () => {
    const root = tempProject(fullSite);

    const run = await runTerminal(["init"], root, [
      accept,
      ["wp-content/plugins/shop"],
      accept,
      false,
      "shop-text",
      "shop_",
      "generate",
    ]);

    expect(run.code, run.stdout + run.stderr).toBe(0);
    expect(run.asked).toEqual([
      "What kind of project is this?",
      "Which plugin and theme directories should the checks cover?",
      "Use the WordPress site defaults?",
      "Use these text domains and prefixes for the WordPress checks?",
      "Text domain for wp-content/plugins/shop",
      "Prefix for global functions, classes, and hooks in wp-content/plugins/shop",
      "What should Configra do?",
    ]);
    expect(JSON.parse(read(root, ".configra/config.json")).wordpress.packages).toEqual({
      "wp-content/plugins/shop": { textDomain: "shop-text", prefix: "shop_" },
    });
  });

  it("says why it can't continue when the PHP checks have no directory to cover", async () => {
    const root = tempProject(fullSite);
    const run = await runTerminal(["init"], root, [
      accept,
      [],
      accept,
      "packages",
      ["wp-content/plugins/shop"],
      accept,
      "save",
    ]);

    expect(run.code, run.stdout + run.stderr).toBe(0);
    expect(run.asked[3]).toBe(
      [
        "Configra can't continue with these answers:",
        '- php -l, PHP_CodeSniffer, PHPStan check only selected plugin and theme directories. Select one under "Plugin and theme directories", or remove the PHP tools under "Tools".',
        "Which answer do you want to change?",
      ].join("\n"),
    );
    expect(JSON.parse(read(root, ".configra/config.json")).packages).toEqual(["wp-content/plugins/shop"]);
  });

  it("asks where the plugins and themes are when the layout is ambiguous", async () => {
    const root = tempProject({ "wp-config.php": "<?php\n", ...contentProject });
    const run = await runTerminal(["init"], root, [accept, "root", ["plugins/shop"], accept, accept, "save"]);

    expect(run.code, run.stdout + run.stderr).toBe(0);
    expect(run.asked[1]).toBe("Where are the site's plugins and themes?");
    expect(JSON.parse(read(root, ".configra/config.json")).packages).toEqual(["plugins/shop"]);
  });
});
