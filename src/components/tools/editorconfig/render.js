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
  ];
  const extensions = { javascript: "{js,mjs,cjs,jsx,ts,mts,cts,tsx}", css: "css", php: "php", python: "py" };
  for (const language of project.languages) {
    const format = project.languageFormatting[language];
    lines.push(
      "",
      `[* .${extensions[language]}]`.replace("* .", "*."),
      `indent_style = ${format.indentStyle}`,
      `indent_size = ${format.indentSize}`,
    );
  }
  lines.push("", "[*.md]", "trim_trailing_whitespace = false", "");
  return { files: { ".editorconfig": lines.join("\n") } };
}
