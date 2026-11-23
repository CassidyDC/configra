import type { ResolvedSettings } from "../../contracts.js";
import { emptyContribution } from "./shared.js";
import type { ToolDefinition } from "./types.js";

/**
 * Lists the ignore lines the selected tools need. WordPress core and uploads are never ignored by default.
 */
function ignoreLines(settings: ResolvedSettings): string[] {
  const { tools } = settings.selections;
  const lines = ["node_modules/", ".configra/tmp/"];

  if (tools.includes("eslint") || tools.includes("phpcs") || tools.includes("phpstan")) {
    lines.push(".cache/");
  }

  if (tools.includes("phpcs") || tools.includes("phpstan")) {
    lines.push("vendor/");
  }

  if (tools.includes("lefthook")) {
    lines.push("lefthook-local.yml");
  }

  // Anchor the personal override files to the root, so `.configra/phpcs.xml` and `.configra/phpstan.neon`
  // stay tracked.
  if (tools.includes("phpcs")) {
    lines.push("/phpcs.xml");
  }

  if (tools.includes("phpstan")) {
    lines.push("/phpstan.neon");
  }

  return lines;
}

export const gitignoreTool: ToolDefinition = {
  id: "gitignore",
  label: ".gitignore",
  description: "Ignore rules for dependencies, caches, and personal override files.",
  languages: [],
  available: true,
  checks: () => [],
  render: (settings) => {
    const contribution = emptyContribution();

    contribution.lines.push({
      tool: "gitignore",
      path: ".gitignore",
      lines: ignoreLines(settings),
      reason: "Ignore dependencies, tool caches, and personal override files",
    });

    return contribution;
  },
};
