import { quote } from "../../../platform/process.js";
import { hook } from "../shared.js";
export default function render(project) {
  const excludes = project.excludes.map((pattern) => pattern.replace(/^\*\*\//, "").replace(/\/\*\*$/, ""));
  return {
    composer: { "php-parallel-lint/php-parallel-lint": "^1.4" },
    scripts: {
      "lint:php:syntax": `vendor/bin/parallel-lint ${excludes.map((item) => `--exclude ${quote(item)}`).join(" ")} .`,
    },
    hooks: [hook("parallel-lint", ["**/*.php"], "vendor/bin/parallel-lint {staged_files}")],
  };
}
