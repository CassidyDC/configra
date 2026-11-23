/**
 * Normalizes prompts, flags, and saved selections into one typed request. Explicit flags override saved
 * values, preset defaults fill omitted values, and an explicit empty list clears a selection. List fields
 * (languages, ui, tools, packages) replace; standards merge by language.
 */

import type {
  CommitMessageMode,
  Diagnostic,
  LanguageId,
  PresetId,
  Selections,
  StandardId,
  ToolId,
  UiId,
} from "../contracts.js";
import {
  commitMessageModes,
  languageIds,
  presetIds,
  projects,
  sharedStandardGroups,
  standardIds,
  supportedStandardCombinations,
  toolIds,
  tools,
  uiIds,
  universalTools,
} from "../components/registry.js";
import { normalizeProjectPath } from "../platform/filesystem.js";
import type { SavedConfig } from "./state/schemas.js";

/**
 * Selection values supplied on the command line or by the wizard, before validation.
 */
export interface SelectionInput {
  project?: string;
  packages?: string[];
  languages?: string[];
  ui?: string[];
  standards?: string[];
  tools?: string[];
  commitMessages?: string;
}

export interface NormalizeResult {
  selections?: Selections;
  diagnostics: Diagnostic[];
}

/**
 * The default tools: the universal set plus the tools for each selected language.
 */
export function defaultTools(languages: readonly LanguageId[]): ToolId[] {
  const selected = new Set<ToolId>(universalTools);

  for (const [id, tool] of Object.entries(tools)) {
    if (tool.languages.some((language) => languages.includes(language))) {
      selected.add(id as ToolId);
    }
  }

  return toolIds.filter((id) => selected.has(id));
}

/**
 * Validates a list of IDs, reports unknown ones, and returns the known IDs in registry order.
 */
function pickIds<T extends string>(
  values: readonly string[],
  allowed: readonly T[],
  label: string,
  diagnostics: Diagnostic[],
): T[] {
  for (const value of values) {
    if (!allowed.includes(value as T)) {
      diagnostics.push({
        code: "SELECTION_UNKNOWN_ID",
        severity: "error",
        message: `Unknown ${label} "${value}". Use ${allowed.join(", ")}.`,
      });
    }
  }

  return allowed.filter((id) => values.includes(id));
}

/**
 * Formats the supported standard combinations for diagnostics.
 */
function supportedCombinationsText(): string {
  return supportedStandardCombinations
    .map((row) =>
      Object.entries(row)
        .map(([language, standard]) => `${language}=${standard}`)
        .join(" with "),
    )
    .join("; ");
}

/**
 * Normalizes and validates one request.
 */
export function normalizeSelections(
  input: SelectionInput,
  saved: SavedConfig | undefined,
  fallbackProject: PresetId,
): NormalizeResult {
  const diagnostics: Diagnostic[] = [];
  const projectValue = input.project ?? saved?.project ?? fallbackProject;

  if (!presetIds.includes(projectValue as PresetId)) {
    diagnostics.push({
      code: "SELECTION_UNKNOWN_ID",
      severity: "error",
      message: `Unknown project preset "${projectValue}". Use ${presetIds.join(", ")}.`,
    });

    return { diagnostics };
  }

  const project = projectValue as PresetId;
  const preset = projects[project];
  const languages = pickIds<LanguageId>(
    input.languages ?? saved?.languages ?? preset.languages,
    languageIds,
    "language",
    diagnostics,
  );
  const ui = pickIds<UiId>(input.ui ?? saved?.ui ?? preset.ui, uiIds, "UI", diagnostics);
  const toolList = pickIds<ToolId>(
    input.tools ?? saved?.tools ?? defaultTools(languages),
    toolIds,
    "tool",
    diagnostics,
  );
  const commitValue = input.commitMessages ?? saved?.commitMessages ?? "plain";

  if (!commitMessageModes.includes(commitValue as CommitMessageMode)) {
    diagnostics.push({
      code: "SELECTION_UNKNOWN_ID",
      severity: "error",
      message: `Unknown commit-message mode "${commitValue}". Use ${commitMessageModes.join(", ")}.`,
    });
  }

  // Standards merge by language: the preset's standard, then saved values, then flags.
  const merged: Partial<Record<LanguageId, StandardId>> = Object.fromEntries(
    languages.map((language) => [language, preset.standard]),
  );
  const explicit = new Set<LanguageId>();

  for (const [language, standard] of Object.entries(saved?.standards ?? {})) {
    merged[language as LanguageId] = standard;
  }

  for (const entry of input.standards ?? []) {
    const match = /^([^=]+)=(.+)$/.exec(entry);

    if (!match) {
      diagnostics.push({
        code: "SELECTION_INVALID_STANDARD",
        severity: "error",
        message: `--standard expects <language>=<id>, such as php=wordpress, not "${entry}".`,
      });

      continue;
    }

    const [, language, standard] = match as unknown as [string, LanguageId, StandardId];

    if (!languageIds.includes(language)) {
      diagnostics.push({
        code: "SELECTION_UNKNOWN_ID",
        severity: "error",
        message: `Unknown language "${language}" in --standard. Use ${languageIds.join(", ")}.`,
      });
    } else if (!standardIds.includes(standard)) {
      diagnostics.push({
        code: "SELECTION_UNKNOWN_ID",
        severity: "error",
        message: `Unknown standard "${standard}" in --standard. Use ${standardIds.join(", ")}.`,
      });
    } else {
      merged[language] = standard;
      explicit.add(language);
    }
  }

  const standards: Partial<Record<LanguageId, StandardId>> = {};

  for (const language of languageIds) {
    const standard = merged[language];

    if (standard && languages.includes(language)) {
      standards[language] = standard;
    } else if (standard && explicit.has(language)) {
      diagnostics.push({
        code: "SELECTION_STANDARD_UNUSED",
        severity: "warning",
        message: `--standard ${language}=${standard} has no effect because ${language} isn't selected.`,
      });
    }
  }

  for (const group of sharedStandardGroups) {
    const used = new Set(group.map((language) => standards[language]).filter(Boolean));

    if (used.size > 1) {
      diagnostics.push({
        code: "SELECTION_UNSUPPORTED_STANDARDS",
        severity: "error",
        message: `${group.join(" and ")} share one ESLint installation, so they must use the same standard. Supported combinations: ${supportedCombinationsText()}.`,
      });
    }
  }

  for (const id of toolList) {
    const tool = tools[id];

    if (tool.languages.length > 0 && !tool.languages.some((language) => languages.includes(language))) {
      diagnostics.push({
        code: "SELECTION_TOOL_NEEDS_LANGUAGE",
        severity: "error",
        message: `${tool.label} needs ${tool.languages.join(" or ")} in the language list.`,
      });
    }

    if (!tool.available) {
      diagnostics.push({
        code: "SELECTION_TOOL_UNAVAILABLE",
        severity: "error",
        message: `${tool.label} (${id}) isn't available in this Configra build yet. Remove it from the tool list.`,
      });
    }
  }

  if (ui.length > 0 && !languages.some((language) => language === "javascript" || language === "typescript")) {
    diagnostics.push({
      code: "SELECTION_UI_NEEDS_LANGUAGE",
      severity: "error",
      message: "React needs javascript or typescript in the language list.",
    });
  }

  const packageValues = input.packages ?? saved?.packages ?? [];
  const packages: string[] = [];

  for (const value of packageValues) {
    const normalized = normalizeProjectPath(value);

    if (normalized === undefined || normalized === ".") {
      diagnostics.push({
        code: "SELECTION_INVALID_PACKAGE",
        severity: "error",
        path: value,
        message: `Package path "${value}" must be a directory or file inside the project, relative to its root.`,
      });
    } else if (!packages.includes(normalized)) {
      packages.push(normalized);
    }
  }

  if (packages.length > 0 && !preset.usesPackages) {
    diagnostics.push({
      code: "SELECTION_PACKAGES_UNSUPPORTED",
      severity: "error",
      message: `The ${project} preset doesn't check selected directories. Use --project wordpress-site or remove --package.`,
    });
  }

  if (commitValue !== "off" && !toolList.includes("lefthook")) {
    diagnostics.push({
      code: "SELECTION_COMMIT_MESSAGES_NEED_LEFTHOOK",
      severity: "warning",
      message: "Commit-message checks run through Lefthook, which isn't selected, so no commit-msg hook is generated.",
    });
  }

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { diagnostics };
  }

  const wordpressPackages = saved?.wordpress?.packages ?? {};

  return {
    diagnostics,
    selections: {
      project,
      packages: packages.sort(),
      languages,
      ui,
      standards,
      tools: toolList,
      commitMessages: commitValue as CommitMessageMode,
      exclusions: { add: saved?.exclusions?.add ?? [], remove: saved?.exclusions?.remove ?? [] },
      formatting: { ...saved?.formatting },
      php: {
        ...(saved?.php?.targetVersion ? { targetVersion: saved.php.targetVersion } : {}),
        ...(saved?.php?.phpstanLevel !== undefined ? { phpstanLevel: saved.php.phpstanLevel } : {}),
        scanDirectories: { remove: saved?.php?.scanDirectories?.remove ?? [] },
      },
      wordpress: {
        ...(saved?.wordpress?.minimumVersion ? { minimumVersion: saved.wordpress.minimumVersion } : {}),
        packages: Object.fromEntries(Object.entries(wordpressPackages).filter(([path]) => packages.includes(path))),
      },
      decisions: { ...saved?.decisions },
    },
  };
}

/**
 * Converts normalized selections to the saved config shape, keeping only settings that carry information.
 */
export function toSavedConfig(selections: Selections, schemaUrl: string): SavedConfig {
  const config: SavedConfig = {
    $schema: schemaUrl,
    version: 1,
    project: selections.project,
    ...(selections.packages.length > 0 || projects[selections.project].usesPackages
      ? { packages: selections.packages }
      : {}),
    languages: selections.languages,
    ui: selections.ui,
    standards: selections.standards,
    tools: selections.tools,
    commitMessages: selections.commitMessages,
  };

  if (selections.exclusions.add.length > 0 || selections.exclusions.remove.length > 0) {
    config.exclusions = {
      ...(selections.exclusions.add.length > 0 ? { add: selections.exclusions.add } : {}),
      ...(selections.exclusions.remove.length > 0 ? { remove: selections.exclusions.remove } : {}),
    };
  }

  if (Object.keys(selections.formatting).length > 0) {
    config.formatting = selections.formatting;
  }

  const php = {
    ...(selections.php.targetVersion ? { targetVersion: selections.php.targetVersion } : {}),
    ...(selections.php.phpstanLevel !== undefined ? { phpstanLevel: selections.php.phpstanLevel } : {}),
    ...(selections.php.scanDirectories.remove.length > 0
      ? { scanDirectories: { remove: selections.php.scanDirectories.remove } }
      : {}),
  };

  if (Object.keys(php).length > 0) {
    config.php = php;
  }

  const wordpress = {
    ...(selections.wordpress.minimumVersion ? { minimumVersion: selections.wordpress.minimumVersion } : {}),
    ...(Object.keys(selections.wordpress.packages).length > 0 ? { packages: selections.wordpress.packages } : {}),
  };

  if (Object.keys(wordpress).length > 0) {
    config.wordpress = wordpress;
  }

  if (Object.keys(selections.decisions).length > 0) {
    config.decisions = Object.fromEntries(Object.entries(selections.decisions).sort(([a], [b]) => a.localeCompare(b)));
  }

  return config;
}
