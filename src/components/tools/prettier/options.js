// WordPress baseline mirrors @wordpress/prettier-config; resolved formatting wins.
/**
 * Combine the documented WordPress baseline with resolved global and language formatting.
 *
 * @param {import("../../../contracts.js").PackageContext} project Resolved standards and formatting choices.
 * @returns {import("prettier").Config} Formatter options shared by generation and generated configuration.
 */
export function options(project) {
  /**
   * Translate shared formatting choices into native Prettier options.
   *
   * @param {import("../../../contracts.js").Formatting} format Effective formatting choices.
   * @returns {import("prettier").Options} Core indentation, line-ending, and width options.
   */
  const base = (format) => ({
    useTabs: format.indentStyle === "tab",
    tabWidth: format.indentSize,
    endOfLine: format.endOfLine,
    printWidth: format.printWidth,
  });
  const wordpress = project.standards.javascript?.id === "wordpress";
  const extensions = { javascript: "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", css: "**/*.css" };
  return {
    ...(wordpress
      ? {
          singleQuote: true,
          trailingComma: "es5",
          bracketSameLine: false,
          bracketSpacing: true,
          semi: true,
          arrowParens: "always",
        }
      : {}),
    ...base(project.formatting),
    overrides: project.languages
      .filter((language) => extensions[language])
      .map((language) => ({
        files: extensions[language],
        options: {
          ...base(project.languageFormatting[language]),
          ...(language === "css" ? { singleQuote: false } : {}),
        },
      })),
  };
}
