import type { UiId } from "../../contracts.js";

/**
 * A UI framework that adds file scopes and lint settings to its languages.
 */
export interface UiDefinition {
  id: UiId;
  label: string;
}

export const uis: Record<UiId, UiDefinition> = {
  react: { id: "react", label: "React" },
};
