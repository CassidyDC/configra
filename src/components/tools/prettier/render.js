import { json, hook } from "../shared.js";

export default function render(project) {
  const options = (format) => ({
    useTabs: format.indentStyle === "tab",
    tabWidth: format.indentSize,
    endOfLine: format.endOfLine,
    printWidth: format.printWidth,
  });
  const wordpress = project.standards.javascript?.id === "wordpress";
  const extensions = { javascript: "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", css: "**/*.css" };
  const config = {
    ...options(project.formatting),
    overrides: project.languages
      .filter((language) => extensions[language])
      .map((language) => ({ files: extensions[language], options: options(project.languageFormatting[language]) })),
  };
  const npm = { prettier: "^3.0.0" };
  if (wordpress) npm["@wordpress/prettier-config"] = "^4.0.0";
  const source = `${wordpress ? 'import wordpress from "@wordpress/prettier-config";\n\n' : ""}export default { ${wordpress ? "...wordpress," : ""} ...${json(config).trim()} };\n`;
  return {
    files: {
      "prettier.config.mjs": source,
      ".prettierignore":
        [...project.excludes, ".cassidydc-toolset-state.json", "package-lock.json", "composer.lock"].join("\n") + "\n",
    },
    npm,
    scripts: { "format:check": "prettier . --check", format: "prettier . --write" },
    hooks: [
      hook(
        "prettier",
        ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,css,html,json,jsonc,md,yml,yaml}"],
        "npx --no-install prettier --check {staged_files}",
      ),
    ],
  };
}
