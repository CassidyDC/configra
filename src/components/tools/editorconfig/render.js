/**
 * @typedef {import("../../../contracts.js").PackageContext} PackageContext
 * @typedef {import("../../../contracts.js").ToolContribution} ToolContribution
 */

/**
 * Render editor settings from shared and language-specific formatting choices.
 *
 * @param {PackageContext} project Resolved settings and package ownership.
 * @returns {ToolContribution} Proposed configuration and tool requirements.
 */
export default function render(project) {
  const lines = [
    "root = true",
    "",
    "[*]",
    "charset = utf-8",
    `end_of_line = ${project.formatting.endOfLine}`,
    "insert_final_newline = true",
    "trim_trailing_whitespace = true",
    `indent_style = ${project.formatting.indentStyle}`,
    `indent_size = ${project.formatting.indentSize}`,
    `max_line_length = ${project.formatting.printWidth}`,
  ];
  const extensions = { javascript: "{js,mjs,cjs,jsx,ts,mts,cts,tsx}", css: "css", php: "php", python: "py" };
  for (const language of project.languages) {
    const format = project.languageFormatting[language];
    lines.push(
      "",
      `[*.${extensions[language]}]`,
      `indent_style = ${format.indentStyle}`,
      `indent_size = ${format.indentSize}`,
    );
  }
  lines.push("", "[*.md]", "trim_trailing_whitespace = false", "");
  return { files: { ".editorconfig": lines.join("\n") } };
}
