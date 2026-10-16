import { json } from "../shared.js";
export default function render(project) {
  const wordpress = project.environment === "wordpress";
  const composer = { "phpstan/phpstan": "^2.0" };
  if (wordpress) composer["szepeviktor/phpstan-wordpress"] = "^2.0";
  return {
    files: {
      "phpstan.neon.dist": `${wordpress ? "includes:\n    - vendor/szepeviktor/phpstan-wordpress/extension.neon\n" : ""}parameters:\n    level: 5\n    paths:\n        - .\n    tmpDir: .phpstan-cache\n    excludePaths:\n        analyseAndScan:\n${project.excludes.map((item) => `            - ${json(item.replaceAll("**/", "*/").replace(/\/\*\*$/, "/*")).trim()}`).join("\n")}\n`,
    },
    composer,
    scripts: { "lint:php:types": "vendor/bin/phpstan analyse --no-progress" },
  };
}
