/**
 * Resolves project defaults, language and UI selections, formatting, and file scopes once per plan.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { FormatSettings, LanguageId, ModuleType, ResolvedSettings, Selections, StandardId } from "../contracts.js";
import { composerRanges, npmRanges } from "../components/dependency-ranges.js";
import { languages, projects } from "../components/registry.js";
import type { Snapshot } from "../platform/filesystem.js";
import { hasTypeDependentScripts, readJson, wordpressCandidates } from "./discover.js";
import { defaultPhpTargetVersion } from "./wordpress.js";

/** Directories and files every generated check skips unless the selections remove them. */
export const defaultExclusions = [
  "node_modules/",
  "vendor/",
  "build/",
  "dist/",
  ".configra/",
  ".cache/",
  "*.min.js",
  "*.min.css",
];

/** Formatting defaults for each standard. The WordPress values match `@wordpress/prettier-config`. */
export const formattingDefaults: Record<StandardId, FormatSettings> = {
  community: {
    indentStyle: "space",
    indentSize: 2,
    lineWidth: 80,
    endOfLine: "lf",
    quoteStyle: "double",
    semicolons: true,
    trailingCommas: "all",
    bracketSpacing: true,
  },
  wordpress: {
    indentStyle: "tab",
    indentSize: 4,
    lineWidth: 80,
    endOfLine: "lf",
    quoteStyle: "single",
    semicolons: true,
    trailingCommas: "es5",
    bracketSpacing: true,
  },
};

/**
 * Finds the nearest `package.json` above the project and returns its explicit module type.
 */
function enclosingModuleType(root: string): ModuleType | undefined {
  let current = dirname(root);

  for (;;) {
    try {
      const manifest = JSON.parse(readFileSync(join(current, "package.json"), "utf8")) as { type?: unknown };

      return manifest.type === "module" || manifest.type === "commonjs" ? manifest.type : undefined;
    } catch {
      // No readable manifest here; keep looking upward.
    }

    const parent = dirname(current);

    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
}

/**
 * Decides the module type of the planned root manifest. Existing manifests keep their type. A fresh
 * project with no JavaScript and no enclosing module setting defaults to ESM. A manifest added to
 * existing code carries forward the enclosing package's explicit type, or stays unset.
 */
export function planModuleType(snapshot: Snapshot, pending?: ReadonlySet<string>): ModuleType | undefined {
  const manifest = readJson(snapshot, "package.json");

  if (manifest) {
    return manifest.type === "module" || manifest.type === "commonjs" ? manifest.type : undefined;
  }

  const enclosing = enclosingModuleType(snapshot.root);

  if (enclosing) {
    return enclosing;
  }

  return hasTypeDependentScripts(snapshot, pending) ? undefined : "module";
}

/**
 * Returns the standard that decides formatting: the JavaScript standard when scripts are selected, then
 * CSS, then PHP, then the preset's standard.
 */
function formattingStandard(selections: Selections): StandardId {
  const { standards } = selections;

  return (
    standards.javascript ??
    standards.typescript ??
    standards.css ??
    standards.php ??
    projects[selections.project].standard
  );
}

/**
 * Resolves every shared setting for a plan.
 */
export function resolveSettings(
  selections: Selections,
  snapshot: Snapshot,
  pending?: ReadonlySet<string>,
): ResolvedSettings {
  const moduleType = planModuleType(snapshot, pending);
  const standard = formattingStandard(selections);
  const extensions: Partial<Record<LanguageId, string[]>> = {};

  for (const language of selections.languages) {
    const definition = languages[language];
    const uiExtensions = selections.ui.flatMap((ui) => definition.uiExtensions[ui] ?? []);

    extensions[language] = [...definition.extensions, ...uiExtensions];
  }

  const exclusions = [
    ...defaultExclusions.filter((entry) => !selections.exclusions.remove.includes(entry)),
    ...selections.exclusions.add.filter((entry) => !defaultExclusions.includes(entry)),
  ];

  const project = projects[selections.project];

  // Selected single files, such as a must-use plugin, are checked directly instead of through a prefix.
  const scopeFiles = project.usesPackages ? selections.packages.filter((path) => path.endsWith(".php")) : [];
  const directories = project.usesPackages ? selections.packages.filter((path) => !path.endsWith(".php")) : [];

  const scopePrefixes = !project.usesPackages
    ? ["**/"]
    : selections.packages.length === 0
      ? [""]
      : directories.map((path) => `${path}/**/`);

  // PHPStan scans the unselected siblings of the selected directories, whichever layout the site uses.
  const contentBases = [
    ...new Set(
      selections.packages
        .map((path) => /^(.*?)(?:plugins|mu-plugins|themes)\/[^/]+$/.exec(path)?.[1])
        .filter((base): base is string => base !== undefined),
    ),
  ];

  const scanDirectories = contentBases
    .flatMap((base) => wordpressCandidates(snapshot, base))
    .filter(
      (path) =>
        !path.endsWith(".php") &&
        !selections.packages.includes(path) &&
        !selections.php.scanDirectories.remove.includes(path),
    )
    .sort();

  return {
    selections,
    globals: project.globals,
    moduleType,
    configExtension: moduleType === "module" ? ".js" : ".mjs",
    formatting: { ...formattingDefaults[standard], ...selections.formatting },
    formattingStandard: standard,
    extensions,
    exclusions,
    scopeFiles,
    phpPaths: project.usesPackages ? selections.packages : ["."],
    phpTargetVersion: selections.php.targetVersion ?? defaultPhpTargetVersion,
    scanDirectories,
    scopePrefixes,
    npmRange: (name, rangeStandard) => {
      const set: Record<string, string> = npmRanges[rangeStandard ?? standard];
      const range = set[name] ?? (npmRanges.community as Record<string, string>)[name];

      if (!range) {
        throw new Error(`No shipped npm range for ${name}`);
      }

      return range;
    },
    composerRange: (name, rangeStandard) => {
      const set: Record<string, string> = composerRanges[rangeStandard ?? standard];
      const range = set[name] ?? (composerRanges.community as Record<string, string>)[name];

      if (!range) {
        throw new Error(`No shipped Composer range for ${name}`);
      }

      return range;
    },
  };
}
