import type { Contribution, LanguageId, ResolvedCheck, ResolvedSettings, ToolId } from "../../contracts.js";

/**
 * A tool Configra can configure, with its renderer.
 */
export interface ToolDefinition {
  id: ToolId;
  label: string;
  description: string;

  /** The tool needs at least one of these languages. Universal tools leave this empty. */
  languages: LanguageId[];

  /** False while the tool's renderer hasn't shipped in this build. */
  available: boolean;

  /** Read-only checks the tool contributes to scripts and hooks. */
  checks: (settings: ResolvedSettings) => ResolvedCheck[];

  /** Files, lines, and manifest fields the tool contributes, given every resolved check. */
  render: (settings: ResolvedSettings, checks: ResolvedCheck[]) => Contribution;
}
