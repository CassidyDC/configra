/**
 * @file Prettier options derived from resolved standards and shared formatting choices.
 */

/**
 * @typedef {import("../../../contracts.js").PackageContext} PackageContext
 * @typedef {import("prettier").Config} PrettierConfig
 * @typedef {import("../../../contracts.js").Formatting} Formatting
 * @typedef {import("prettier").Options} PrettierOptions
 */

// WordPress baseline mirrors @wordpress/prettier-config; resolved formatting wins.

/**
 * Combine the documented WordPress baseline with resolved global and language formatting.
 *
 * @param {PackageContext} project Resolved standards and formatting choices.
 * @returns {PrettierConfig} Formatter options shared by generation and generated configuration.
 */
export function options(project) {
  // prettier-ignore

  /**
   * Translate shared formatting choices into native Prettier options.
   *
   * @param {Formatting} format Effective formatting choices.
   * @returns {PrettierOptions} Core indentation, line-ending, and width options.
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
