/**
 * The PHP tools: native `php -l`, PHP_CodeSniffer, and PHPStan. Composer installs PHP_CodeSniffer and
 * PHPStan, and a generated helper runs them the same way on every platform.
 */

import { readFileSync } from "node:fs";
import type { ManifestFieldContribution, ResolvedCheck, ResolvedSettings, StandardId } from "../../contracts.js";
import { composerDependency, emptyContribution, indentUnit, phpExclusionPatterns } from "./shared.js";
import type { ToolDefinition } from "./types.js";

const phpLintScript = ".configra/scripts/php-lint.mjs";
const phpToolScript = ".configra/scripts/php-tool.mjs";
const installerPlugin = "dealerdirect/phpcodesniffer-composer-installer";

/**
 * The PHP coding standard.
 */
function phpStandard(settings: ResolvedSettings): StandardId {
  return settings.selections.standards.php ?? "wordpress";
}

/**
 * Converts a project path to one relative to `.configra/`, where the managed PHP configs live.
 */
function fromConfigra(path: string): string {
  return path === "." ? ".." : `../${path}`;
}

/**
 * Escapes text for an XML attribute or element.
 */
function xml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/**
 * Converts a version such as `8.1` to PHPStan's version ID, such as 80100.
 */
function phpVersionId(version: string): number {
  const [major = 7, minor = 4] = version.split(".").map(Number);

  return major * 10_000 + minor * 100;
}

/**
 * The generated helper that runs a Composer-installed tool.
 */
function phpToolFile(): ReturnType<typeof emptyContribution>["files"][number] {
  return {
    tool: "phpcs",
    path: phpToolScript,
    ownership: "file",
    content: readFileSync(new URL("./assets/php-tool.mjs", import.meta.url), "utf8"),
    reason: "Runs Composer-installed PHP tools the same way on every platform",
    executable: true,
  };
}

/**
 * Renders the batched `php -l` helper with the selected paths and exclusions.
 */
function renderPhpLintScript(settings: ResolvedSettings): string {
  const template = readFileSync(new URL("./assets/php-lint.mjs", import.meta.url), "utf8");
  const values = `const settings = { paths: ${JSON.stringify(settings.phpPaths)}, excluded: ${JSON.stringify(settings.exclusions)} };`;

  return template.replace(/(\/\/ configra:settings\n)[^\n]*\n/, `$1${values}\n`);
}

/**
 * Renders the Configra-owned PHP_CodeSniffer ruleset. Paths are relative to `.configra/`.
 */
function renderPhpcsRuleset(settings: ResolvedSettings): string {
  const unit = indentUnit(settings.formatting);
  const standard = phpStandard(settings);
  const { wordpress } = settings.selections;

  const lines = [
    '<?xml version="1.0"?>',
    "<!-- Managed by Configra. Put your changes in phpcs.xml.dist. -->",
    '<ruleset name="Configra">',
    `${unit}<description>PHP_CodeSniffer settings Configra manages for the ${standard} standard.</description>`,
    "",
    ...settings.phpPaths.map((path) => `${unit}<file>${xml(fromConfigra(path))}</file>`),
    "",
    ...phpExclusionPatterns(settings).map((pattern) => `${unit}<exclude-pattern>${xml(pattern)}</exclude-pattern>`),
    "",
    `${unit}<arg name="extensions" value="php"/>`,
    `${unit}<arg value="s"/>`,
    "",
  ];

  if (standard === "community") {
    lines.push(`${unit}<rule ref="PSR12"/>`);
  } else {
    const packages = Object.values(wordpress.packages);
    const textDomains = [...new Set(packages.flatMap((entry) => (entry.textDomain ? [entry.textDomain] : [])))];
    const prefixes = [...new Set(packages.flatMap((entry) => (entry.prefix ? [entry.prefix] : [])))];

    const arrayProperty = (rule: string, property: string, values: string[]) => [
      "",
      `${unit}<rule ref="${rule}">`,
      `${unit.repeat(2)}<properties>`,
      `${unit.repeat(3)}<property name="${property}" type="array">`,
      ...values.map((value) => `${unit.repeat(4)}<element value="${xml(value)}"/>`),
      `${unit.repeat(3)}</property>`,
      `${unit.repeat(2)}</properties>`,
      `${unit}</rule>`,
    ];

    if (wordpress.minimumVersion) {
      lines.push(`${unit}<config name="minimum_wp_version" value="${xml(wordpress.minimumVersion)}"/>`, "");
    }

    lines.push(`${unit}<rule ref="WordPress"/>`);

    if (textDomains.length > 0) {
      lines.push(...arrayProperty("WordPress.WP.I18n", "text_domain", textDomains));
    }

    if (prefixes.length > 0) {
      lines.push(...arrayProperty("WordPress.NamingConventions.PrefixAllGlobals", "prefixes", prefixes));
    }
  }

  lines.push("</ruleset>", "");

  return lines.join("\n");
}

/**
 * Renders the project-owned PHP_CodeSniffer entry file, created once.
 */
function renderPhpcsEntry(settings: ResolvedSettings): string {
  const unit = indentUnit(settings.formatting);

  return [
    '<?xml version="1.0"?>',
    "<!--",
    `${unit}PHP_CodeSniffer configuration.`,
    "",
    `${unit}Configra manages .configra/phpcs.xml. Add your own rules and properties after its reference;`,
    `${unit}they override Configra's. For personal settings, create a phpcs.xml that references this file.`,
    "",
    `${unit}See https://github.com/PHPCSStandards/PHP_CodeSniffer/wiki/Annotated-Ruleset`,
    "-->",
    '<ruleset name="Project">',
    `${unit}<rule ref="./.configra/phpcs.xml"/>`,
    "",
    `${unit}<!-- <rule ref="Generic.Files.LineLength">`,
    `${unit}${unit}<exclude-pattern>*/templates/*</exclude-pattern>`,
    `${unit}</rule> -->`,
    "</ruleset>",
    "",
  ].join("\n");
}

/**
 * Renders the Configra-owned PHPStan config. PHPStan resolves relative paths from this file.
 */
function renderPhpstanConfig(settings: ResolvedSettings): string {
  const unit = indentUnit(settings.formatting);
  const list = (values: string[], depth: number) => values.map((value) => `${unit.repeat(depth)}- ${value}`);
  const lines = ["# Managed by Configra. Put your changes in phpstan.neon.dist.", ""];

  if (phpStandard(settings) === "wordpress") {
    lines.push("includes:", ...list(["../vendor/szepeviktor/phpstan-wordpress/extension.neon"], 1), "");
  }

  lines.push(
    "parameters:",
    `${unit}level: ${settings.selections.php.phpstanLevel ?? 5}`,
    `${unit}phpVersion: ${phpVersionId(settings.phpTargetVersion)}`,
    `${unit}tmpDir: ../.cache/phpstan`,
    `${unit}paths:`,
    ...list(settings.phpPaths.map(fromConfigra), 2),
    `${unit}excludePaths:`,
    `${unit.repeat(2)}analyse:`,
    ...list(
      phpExclusionPatterns(settings).map((pattern) => `'${pattern}'`),
      3,
    ),
  );

  if (settings.scanDirectories.length > 0) {
    lines.push(`${unit}scanDirectories:`, ...list(settings.scanDirectories.map(fromConfigra), 2));
  }

  lines.push("");

  return lines.join("\n");
}

/**
 * Renders the project-owned PHPStan entry file, created once.
 */
function renderPhpstanEntry(settings: ResolvedSettings): string {
  const unit = indentUnit(settings.formatting);

  return [
    "# PHPStan configuration.",
    "#",
    "# Configra manages .configra/phpstan.neon. Settings here override its single values, such as the",
    "# level, and add to its lists, such as paths. For personal settings, create a phpstan.neon that",
    "# includes this file. See https://phpstan.org/config-reference",
    "",
    "includes:",
    `${unit}- .configra/phpstan.neon`,
    "",
    "# parameters:",
    `#${unit}level: 6`,
    "",
  ].join("\n");
}

export const phpLintTool: ToolDefinition = {
  id: "php-lint",
  label: "php -l",
  description: "Checks PHP syntax with the native linter.",
  languages: ["php"],
  available: true,
  checks: (): ResolvedCheck[] => [
    {
      id: "php-lint",
      tool: "php-lint",
      script: "lint:php-syntax",
      command: { executable: "node", args: [phpLintScript] },
      hook: "pre-commit",
      extensions: ["php"],
      stagedArgs: [phpLintScript],
      usesStagedFiles: true,
      direct: true,
      aggregate: "lint",
    },
  ],
  render: (settings) => {
    const contribution = emptyContribution();

    contribution.files.push({
      tool: "php-lint",
      path: phpLintScript,
      ownership: "file",
      content: renderPhpLintScript(settings),
      reason: "Batched PHP syntax check for the selected paths",
      executable: true,
    });

    return contribution;
  },
};

export const phpcsTool: ToolDefinition = {
  id: "phpcs",
  label: "PHP_CodeSniffer",
  description: "Checks and fixes PHP coding standards.",
  languages: ["php"],
  available: true,
  checks: (): ResolvedCheck[] => [
    {
      id: "phpcs",
      tool: "phpcs",
      script: "lint:phpcs",
      command: { executable: "node", args: [phpToolScript, "phpcs"] },
      fixCommand: { executable: "node", args: [phpToolScript, "phpcbf"] },
      hook: "pre-commit",
      extensions: ["php"],
      stagedArgs: [phpToolScript, "phpcs"],
      usesStagedFiles: true,
      direct: true,
      aggregate: "lint",
    },
  ],
  render: (settings) => {
    const contribution = emptyContribution();
    const standard = phpStandard(settings);

    contribution.files.push(
      {
        tool: "phpcs",
        path: ".configra/phpcs.xml",
        ownership: "file",
        content: renderPhpcsRuleset(settings),
        reason: `PHP_CodeSniffer rules for the ${standard} standard`,
      },
      {
        tool: "phpcs",
        path: "phpcs.xml.dist",
        ownership: "entry",
        content: renderPhpcsEntry(settings),
        reason: "Project PHP_CodeSniffer entry file that references .configra/phpcs.xml",
        reference: "./.configra/phpcs.xml",
      },
      phpToolFile(),
    );

    const packages =
      standard === "wordpress"
        ? ["squizlabs/php_codesniffer", "wp-coding-standards/wpcs", installerPlugin]
        : ["squizlabs/php_codesniffer"];

    contribution.fields.push(
      ...packages.map((name) => composerDependency("phpcs", name, settings.composerRange(name, standard))),
    );

    if (standard === "wordpress") {
      const permission: ManifestFieldContribution = {
        tool: "phpcs",
        manifest: "composer.json",
        path: ["config", "allow-plugins", installerPlugin],
        value: true,
        reason: "Lets the installer register the WordPress coding standard with PHP_CodeSniffer",
        kind: "permission",
      };

      contribution.fields.push(permission);
    }

    contribution.competing.push({ tool: "phpcs", path: ".phpcs.xml" }, { tool: "phpcs", path: ".phpcs.xml.dist" });

    return contribution;
  },
};

export const phpstanTool: ToolDefinition = {
  id: "phpstan",
  label: "PHPStan",
  description: "Analyses PHP code statically.",
  languages: ["php"],
  available: true,
  checks: (): ResolvedCheck[] => [
    {
      id: "phpstan",
      tool: "phpstan",
      script: "lint:phpstan",
      command: {
        executable: "node",
        args: [phpToolScript, "phpstan", "analyse", "--memory-limit=1G", "--no-progress"],
      },
      hook: "pre-push",
      extensions: ["php"],
      usesStagedFiles: false,
      direct: true,
      aggregate: "lint",
    },
  ],
  render: (settings) => {
    const contribution = emptyContribution();
    const standard = phpStandard(settings);

    contribution.files.push(
      {
        tool: "phpstan",
        path: ".configra/phpstan.neon",
        ownership: "file",
        content: renderPhpstanConfig(settings),
        reason: `PHPStan level ${settings.selections.php.phpstanLevel ?? 5} analysis of the selected paths`,
      },
      {
        tool: "phpstan",
        path: "phpstan.neon.dist",
        ownership: "entry",
        content: renderPhpstanEntry(settings),
        reason: "Project PHPStan entry file that includes .configra/phpstan.neon",
        reference: ".configra/phpstan.neon",
      },
      { ...phpToolFile(), tool: "phpstan" },
    );

    const packages =
      standard === "wordpress" ? ["phpstan/phpstan", "szepeviktor/phpstan-wordpress"] : ["phpstan/phpstan"];

    contribution.fields.push(
      ...packages.map((name) => composerDependency("phpstan", name, settings.composerRange(name, standard))),
    );

    return contribution;
  },
};
