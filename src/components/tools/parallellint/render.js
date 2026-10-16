import { quote } from "../../../platform/process.js";
import { hook } from "../shared.js";
export default function render(project) {
  const excludes = [
    "node_modules",
    "vendor",
    ".git",
    "dist",
    "build",
    ...project.children.map((child) => child.slice(project.path === "." ? 0 : project.path.length + 1)),
  ];
  return {
    composer: { "php-parallel-lint/php-parallel-lint": "^1.4" },
    scripts: {
      "lint:php:syntax": `vendor/bin/parallel-lint ${excludes.map((item) => `--exclude ${quote(item)}`).join(" ")} .`,
    },
    hooks: [hook("parallel-lint", ["**/*.php"], "vendor/bin/parallel-lint {staged_files}")],
  };
}
