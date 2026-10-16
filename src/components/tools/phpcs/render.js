import { xml, hook } from "../shared.js";

/**
 * @typedef {import("../../../contracts.js").PackageContext} PackageContext
 * @typedef {import("../../../contracts.js").ToolContribution} ToolContribution
 */

/**
 * Render the selected PHP coding standard and its Composer requirements.
 *
 * @param {PackageContext} project Resolved settings and package ownership.
 * @returns {ToolContribution} Proposed configuration and tool requirements.
 */
export default function render(project) {
  const standard = project.standards.php.settings.ruleset;
  const excludes = project.excludes
    .map((item) => `  <exclude-pattern>${xml(item.replaceAll("**/", "*/"))}</exclude-pattern>`)
    .join("\n");
  const composer = { "squizlabs/php_codesniffer": "^3.13" };
  const composerSettings = {};

  if (standard === "WordPress") {
    composer["wp-coding-standards/wpcs"] = "^3.0";
    composer["dealerdirect/phpcodesniffer-composer-installer"] = "^1.0";
    composerSettings["config"] = { "allow-plugins": { "dealerdirect/phpcodesniffer-composer-installer": true } };
  }

  return {
    files: {
      "phpcs.xml.dist": `<?xml version="1.0"?>\n<ruleset name="Project">\n  <file>.</file>\n  <arg name="extensions" value="php"/>\n${excludes}\n  <rule ref="${xml(standard)}"/>\n</ruleset>\n`,
    },
    composer,
    composerSettings,
    scripts: { "lint:php:style": "vendor/bin/phpcs" },
    hooks: [hook("phpcs", ["**/*.php"], "vendor/bin/phpcs {staged_files}")],
  };
}
