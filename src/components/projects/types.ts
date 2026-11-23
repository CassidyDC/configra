import type { LanguageId, PresetId, StandardId, UiId } from "../../contracts.js";

/**
 * A project preset and the defaults it provides.
 */
export interface ProjectDefinition {
  id: PresetId;
  label: string;
  description: string;
  languages: LanguageId[];
  ui: UiId[];
  standard: StandardId;

  /** The global variables community JavaScript rules assume. */
  globals: "node" | "browser";

  /** Whether the preset checks selected plugin and theme directories. */
  usesPackages: boolean;
}
