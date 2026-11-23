import type { ResolvedSettings } from "../../contracts.js";
import { emptyContribution } from "./shared.js";
import type { ToolDefinition } from "./types.js";

/**
 * Renders `.editorconfig` from the resolved formatting settings, which also drive Prettier.
 */
function renderEditorConfig(settings: ResolvedSettings): string {
  const { formatting } = settings;

  const lines = [
    "# Managed by Configra. Change formatting through the formatting settings in .configra/config.json.",
    "# EditorConfig has no import mechanism, so Configra owns this whole file.",
    "# See https://editorconfig.org",
    "root = true",
    "",
    "[*]",
    "charset = utf-8",
    `end_of_line = ${formatting.endOfLine}`,
    `indent_size = ${formatting.indentSize}`,
    `indent_style = ${formatting.indentStyle}`,
    "insert_final_newline = true",
    `max_line_length = ${formatting.lineWidth}`,
    "trim_trailing_whitespace = true",
    "",
    "[*.md]",
    "trim_trailing_whitespace = false",
  ];

  if (formatting.indentStyle === "tab") {
    // YAML can't be indented with tabs, so keep it on spaces like Prettier does.
    lines.push("", "[*.{yml,yaml}]", "indent_size = 2", "indent_style = space");
  }

  return `${lines.join("\n")}\n`;
}

export const editorconfigTool: ToolDefinition = {
  id: "editorconfig",
  label: "EditorConfig",
  description: "Shared editor settings for indentation, line endings, and whitespace.",
  languages: [],
  available: true,
  checks: () => [],
  render: (settings) => {
    const contribution = emptyContribution();

    contribution.files.push({
      tool: "editorconfig",
      path: ".editorconfig",
      ownership: "file",
      content: renderEditorConfig(settings),
      reason: "EditorConfig settings derived from the formatting settings",
    });

    return contribution;
  },
};
