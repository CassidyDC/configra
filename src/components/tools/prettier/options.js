// WordPress baseline mirrors @wordpress/prettier-config; resolved formatting wins.
export function options(project) {
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
