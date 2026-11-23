/**
 * Combines tool contributions against the captured snapshot and ownership state into a deterministic plan
 * of file changes, conflicts, dependency changes, and the next ownership state.
 */

import semver from "semver";
import type {
  ChangeDetail,
  Conflict,
  ConflictAction,
  Contribution,
  Diagnostic,
  FileContribution,
  JsonObject,
  JsonValue,
  ManifestFieldContribution,
  PlannedChange,
  ResolvedCheck,
  ResolvedSettings,
  Selections,
} from "../contracts.js";
import { tools } from "../components/registry.js";
import { renderCommand } from "../components/tools/shared.js";
import { textHash, type Snapshot } from "../platform/filesystem.js";
import {
  deleteAt,
  editLines,
  fromPointer,
  getAt,
  jsonEqual,
  serializeJson,
  setAt,
  sortKeys,
  splitLines,
  toPointer,
} from "./edits.js";
import { toSavedConfig } from "./normalize.js";
import type { OwnershipState, SavedConfig, StateEntry } from "./state/schemas.js";

export const configPath = ".configra/config.json";

export const statePath = ".configra/state.json";

/**
 * A file write the apply phase performs. Null content deletes the file.
 */
export interface FileWrite {
  path: string;
  content: string | null;
  mode?: number;
}

export interface PlanInput {
  snapshot: Snapshot;
  settings: ResolvedSettings;
  state: OwnershipState | undefined;
  configraVersion: string;
  schemaUrl: string;

  /** Applies to every conflict without its own decision. */
  onConflict?: ConflictAction;

  /** Decisions made for individual conflicts, such as from the wizard. */
  decisions?: Record<string, ConflictAction>;

  /** Write only the saved selections. */
  saveOnly?: boolean;

  /**
   * Paths listed in a leftover pending-run marker. Content at these paths that matches the plan is taken
   * into ownership, because the interrupted run wrote it.
   */
  pending?: ReadonlySet<string>;
}

export interface ScriptSummary {
  name: string;
  command: string;
  writes: boolean;
}

export interface Plan {
  selections: Selections;
  config: SavedConfig;
  changes: PlannedChange[];
  conflicts: Conflict[];
  diagnostics: Diagnostic[];
  checks: ResolvedCheck[];
  scripts: ScriptSummary[];
  dependencies: DependencyChanges;

  /** Every dependency the selected tools declare, per package manager, including reused declarations. */
  managedPackages: { npm: string[]; composer: string[] };
  writes: FileWrite[];
  state: OwnershipState;
}

/**
 * Dependency declarations a plan adds or removes, per package manager.
 */
export interface DependencyChanges {
  npm: { add: Record<string, string>; remove: string[] };
  composer: { add: Record<string, string>; remove: string[] };
}

/**
 * Mutable planning context shared by the per-kind planners.
 */
interface Context {
  input: PlanInput;
  selections: Selections;
  changes: PlannedChange[];
  conflicts: Conflict[];
  diagnostics: Diagnostic[];
  writes: FileWrite[];
  files: Record<string, StateEntry>;
  previous: Record<string, StateEntry>;
}

/**
 * Returns the decision for a conflict: a per-conflict decision, then --on-conflict, then a saved retain.
 */
function decide(context: Context, id: string): ConflictAction | undefined {
  return (
    context.input.decisions?.[id] ??
    context.input.onConflict ??
    (context.selections.decisions[id] ? "retain" : undefined)
  );
}

/**
 * Returns whether an interrupted run listed the path in its pending-run marker.
 */
function isPending(context: Context, path: string): boolean {
  return context.input.pending?.has(path) ?? false;
}

/**
 * Records a conflict with its decision and keeps the saved retain decisions in sync.
 */
function addConflict(context: Context, conflict: Omit<Conflict, "options" | "decision">): ConflictAction | undefined {
  const decision = decide(context, conflict.id);

  context.conflicts.push({ ...conflict, options: ["retain", "replace"], ...(decision ? { decision } : {}) });

  if (decision === "retain") {
    context.selections.decisions[conflict.id] = "retain";
  } else {
    delete context.selections.decisions[conflict.id];
  }

  return decision;
}

/**
 * Matches the line endings of existing content so CRLF checkouts stay CRLF.
 */
function matchLineEndings(content: string, existing: string | undefined): string {
  return existing?.includes("\r\n") ? content.replaceAll(/\r?\n/g, "\r\n") : content;
}

/**
 * Plans one Configra-owned or entry file.
 */
function planFile(context: Context, file: FileContribution, adoptedEntries: Set<string>): void {
  const { snapshot } = context.input;
  const entry = snapshot.entry(file.path);
  const previous = context.previous[file.path];
  const mode = file.executable ? 0o755 : undefined;

  if (entry.kind === "directory" || entry.kind === "symlink") {
    context.diagnostics.push({
      code: "PLAN_PATH_NOT_A_FILE",
      severity: "error",
      path: file.path,
      message: `${file.path} is a ${entry.kind}, so Configra can't write its ${file.tool} file there.`,
    });

    return;
  }

  const current = entry.content;

  if (file.ownership === "entry") {
    if (adoptedEntries.has(file.tool)) {
      return;
    }

    if (current === undefined) {
      context.changes.push({ path: file.path, action: "create", ownership: "entry", reason: file.reason, details: [] });
      context.writes.push({ path: file.path, content: file.content, ...(mode ? { mode } : {}) });
      context.files[file.path] = { kind: "entry" };

      return;
    }

    const adoptable = isPending(context, file.path) && textHash(current) === textHash(file.content);

    if (previous?.kind === "entry" || adoptable || (file.reference !== undefined && current.includes(file.reference))) {
      if (previous?.kind === "entry" || isPending(context, file.path)) {
        context.files[file.path] = { kind: "entry" };
      }

      if (file.reference !== undefined && !current.includes(file.reference)) {
        context.diagnostics.push({
          code: "ENTRY_MISSING_REFERENCE",
          severity: "warning",
          path: file.path,
          message: `${file.path} no longer loads ${file.reference.replace(/^\.\//, "")}, so Configra's ${tools[file.tool].label} settings don't apply. Import it again to use them.`,
        });
      }

      return;
    }

    const decision = addConflict(context, {
      id: file.path,
      path: file.path,
      kind: "unowned-content",
      message: `${file.path} already exists and doesn't load ${file.reference?.replace(/^\.\//, "") ?? "Configra's file"}.`,
    });

    if (decision === "replace") {
      context.changes.push({
        path: file.path,
        action: "update",
        ownership: "entry",
        reason: `${file.reason} (replacing existing content)`,
        details: [],
      });
      context.writes.push({
        path: file.path,
        content: matchLineEndings(file.content, current),
        ...(entry.mode ? { mode: entry.mode } : {}),
      });
      context.files[file.path] = { kind: "entry" };
    } else if (decision === "retain" && file.reference !== undefined) {
      context.diagnostics.push({
        code: "ENTRY_MISSING_REFERENCE",
        severity: "warning",
        path: file.path,
        message: `${file.path} doesn't import ${file.reference.replace(/^\.\//, "")}. Add \`import configra from "${file.reference}";\` and include it to use Configra's settings.`,
      });
    }

    return;
  }

  const desiredHash = textHash(file.content);
  const ownedHash = previous?.kind === "file" ? previous.hash : undefined;
  const own = () => {
    context.files[file.path] = { kind: "file", hash: desiredHash };
  };

  if (current === undefined) {
    if (ownedHash !== undefined) {
      const decision = addConflict(context, {
        id: file.path,
        path: file.path,
        kind: "deleted-owned",
        message: `${file.path} was generated by Configra and has been deleted.`,
      });

      if (decision === "replace") {
        context.changes.push({
          path: file.path,
          action: "create",
          ownership: "file",
          reason: `${file.reason} (recreating a deleted file)`,
          details: [],
        });
        context.writes.push({ path: file.path, content: file.content, ...(mode ? { mode } : {}) });
        own();
      }

      return;
    }

    context.changes.push({ path: file.path, action: "create", ownership: "file", reason: file.reason, details: [] });
    context.writes.push({ path: file.path, content: file.content, ...(mode ? { mode } : {}) });
    own();

    return;
  }

  const currentHash = textHash(current);

  if (currentHash === desiredHash) {
    if (ownedHash !== undefined || isPending(context, file.path)) {
      own();
    }

    return;
  }

  if (ownedHash !== undefined && currentHash === ownedHash) {
    context.changes.push({ path: file.path, action: "update", ownership: "file", reason: file.reason, details: [] });
    context.writes.push({
      path: file.path,
      content: matchLineEndings(file.content, current),
      ...(entry.mode ? { mode: entry.mode } : {}),
    });
    own();

    return;
  }

  const decision = addConflict(context, {
    id: file.path,
    path: file.path,
    kind: ownedHash !== undefined ? "edited-owned" : "unowned-content",
    message:
      ownedHash !== undefined
        ? `${file.path} is Configra-owned but has been edited since Configra wrote it.`
        : `${file.path} already exists with different content.`,
  });

  if (decision === "replace") {
    context.changes.push({
      path: file.path,
      action: "update",
      ownership: "file",
      reason: `${file.reason} (replacing existing content)`,
      details: [],
    });
    context.writes.push({
      path: file.path,
      content: matchLineEndings(file.content, current),
      ...(entry.mode ? { mode: entry.mode } : {}),
    });
    own();
  }
}

/**
 * Plans the lines Configra adds to one line-based file.
 */
function planLines(context: Context, path: string, desired: string[], reason: string): void {
  const current = context.input.snapshot.read(path);
  const currentLines = splitLines(current ?? "");
  const previous = context.previous[path];
  const owned = previous?.kind === "lines" ? previous.lines : [];
  const add: string[] = [];
  const keep: string[] = [];

  for (const line of desired) {
    if (currentLines.includes(line)) {
      if (owned.includes(line) || isPending(context, path)) {
        keep.push(line);
      }

      continue;
    }

    if (owned.includes(line)) {
      const decision = addConflict(context, {
        id: `${path}#${line}`,
        path,
        kind: "deleted-owned",
        message: `Configra added "${line}" to ${path}, and it has since been removed.`,
      });

      if (decision !== "replace") {
        continue;
      }
    }

    add.push(line);
  }

  const remove = owned.filter((line) => !desired.includes(line) && currentLines.includes(line));

  if (add.length > 0 || remove.length > 0) {
    const details: ChangeDetail[] = [
      ...add.map((line) => ({ kind: "add-line" as const, target: line })),
      ...remove.map((line) => ({ kind: "remove-line" as const, target: line })),
    ];

    const content = editLines(current, add, remove);

    if (
      content === "" &&
      current !== undefined &&
      splitLines(current).every((line) => remove.includes(line) || line.trim() === "")
    ) {
      context.changes.push({ path, action: "delete", ownership: "lines", reason: "Remove Configra's lines", details });
      context.writes.push({ path, content: null });
    } else {
      context.changes.push({
        path,
        action: current === undefined ? "create" : "update",
        ownership: "lines",
        reason,
        details,
      });
      context.writes.push({ path, content });
    }
  }

  // Record lines in the planned order, wherever they sit in the file, so the next run sees no change.
  const nowOwned = desired.filter((line) => keep.includes(line) || add.includes(line));

  if (nowOwned.length > 0) {
    context.files[path] = { kind: "lines", lines: nowOwned };
  }
}

/** Matches the pointer of a dependency declaration in `package.json` or `composer.json`. */
const dependencyPointer = /^\/((dev)?[dD]ependencies|require(-dev)?)\/(.+)$/;

/**
 * Lists the dependencies the selected tools declare in one manifest.
 */
function managedNames(contributions: Contribution[], manifest: ManifestFieldContribution["manifest"]): string[] {
  const names = contributions
    .flatMap((contribution) => contribution.fields)
    .filter((field) => field.manifest === manifest && field.kind === "dependency")
    .map((field) => field.path[1] as string);

  return [...new Set(names)].sort();
}

/**
 * Returns whether an existing dependency range is a verified subset of the shipped range.
 */
function compatibleRange(existing: JsonValue | undefined, desired: string): boolean {
  if (typeof existing !== "string" || semver.validRange(existing) === null) {
    return false;
  }

  try {
    return semver.subset(existing, desired);
  } catch {
    return false;
  }
}

/**
 * Plans the managed fields of one JSON manifest.
 */
function planManifest(context: Context, manifestPath: string, fields: ManifestFieldContribution[]): void {
  const { snapshot } = context.input;
  const text = snapshot.read(manifestPath);
  let manifest: JsonObject = {};

  if (text !== undefined) {
    try {
      const parsed = JSON.parse(text) as JsonValue;

      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("not an object");
      }

      manifest = parsed;
    } catch {
      context.diagnostics.push({
        code: "PLAN_MANIFEST_INVALID",
        severity: "error",
        path: manifestPath,
        message: `${manifestPath} isn't a valid JSON object, so Configra can't update its fields.`,
      });

      return;
    }
  }

  const previous = context.previous[manifestPath];
  const ownedFields: Record<string, unknown> = previous?.kind === "fields" ? previous.fields : {};
  const nextOwned: Record<string, JsonValue> = {};
  const details: ChangeDetail[] = [];
  let updated = manifest;
  const desiredPointers = new Set(fields.map((field) => toPointer(field.path)));

  const set = (path: string[], value: JsonValue, own: boolean) => {
    const pointer = toPointer(path);
    const previousValue = getAt(updated, path);

    updated = setAt(updated, path, value);
    details.push({
      kind: "set-field",
      target: pointer,
      value,
      ...(previousValue !== undefined ? { previous: previousValue } : {}),
    });

    if (own) {
      nextOwned[pointer] = value;
    }
  };

  for (const field of fields) {
    const pointer = toPointer(field.path);
    const current = getAt(manifest, field.path);
    const isOwned = pointer in ownedFields;

    if (field.kind === "setting") {
      if (current === undefined) {
        set(field.path, field.value, false);
      }

      continue;
    }

    if (field.kind === "permission") {
      const parent = getAt(manifest, field.path.slice(0, -1));

      // An existing denial stays, and a blanket allowance already covers the entry.
      if (current === false || typeof parent === "boolean") {
        if (current === false || parent === false) {
          context.diagnostics.push({
            code: "PLAN_COMPOSER_PLUGIN_DENIED",
            severity: "warning",
            path: manifestPath,
            message: `${manifestPath} denies the ${field.path.at(-1) ?? ""} Composer plugin, so Composer won't register the WordPress coding standard with PHP_CodeSniffer. Configra leaves the denial in place; allow the plugin under config.allow-plugins to use the standard.`,
          });
        }

        continue;
      }
    }

    if (field.kind === "dependency") {
      const name = field.path[1] as string;
      const productionKey = manifestPath === "composer.json" ? "require" : "dependencies";
      const production = getAt(manifest, [productionKey, name]);

      if (production !== undefined) {
        if (!compatibleRange(production, field.value as string)) {
          const decision = addConflict(context, {
            id: `${manifestPath}#${toPointer([productionKey, name])}`,
            path: manifestPath,
            kind: "unowned-content",
            message: `${productionKey}.${name} is ${JSON.stringify(production)}, which isn't within the tested range ${String(field.value)}.`,
          });

          if (decision === "replace") {
            set([productionKey, name], field.value, false);
          }
        }

        continue;
      }
    }

    if (current === undefined) {
      if (isOwned) {
        const decision = addConflict(context, {
          id: `${manifestPath}#${pointer}`,
          path: manifestPath,
          kind: "deleted-owned",
          message: `Configra set ${field.path.join(".")} in ${manifestPath}, and it has since been removed.`,
        });

        if (decision !== "replace") {
          continue;
        }
      }

      set(field.path, field.value, true);

      continue;
    }

    if (jsonEqual(current, field.value)) {
      if (isOwned || isPending(context, manifestPath)) {
        nextOwned[pointer] = field.value;
      }

      continue;
    }

    if (field.kind === "dependency" && !isOwned && compatibleRange(current, field.value as string)) {
      continue;
    }

    if (isOwned && jsonEqual(current, ownedFields[pointer] as JsonValue)) {
      set(field.path, field.value, true);

      continue;
    }

    const decision = addConflict(context, {
      id: `${manifestPath}#${pointer}`,
      path: manifestPath,
      kind: isOwned ? "edited-owned" : "unowned-content",
      message: isOwned
        ? `${field.path.join(".")} in ${manifestPath} has been edited since Configra set it to ${JSON.stringify(ownedFields[pointer])}.`
        : `${field.path.join(".")} in ${manifestPath} is already ${JSON.stringify(current)}; Configra would set ${JSON.stringify(field.value)}.`,
    });

    if (decision === "replace") {
      set(field.path, field.value, true);
    }
  }

  for (const [pointer, ownedValue] of Object.entries(ownedFields)) {
    if (desiredPointers.has(pointer)) {
      continue;
    }

    const path = fromPointer(pointer);
    const current = getAt(manifest, path);

    if (current === undefined) {
      continue;
    }

    if (!jsonEqual(current, ownedValue as JsonValue)) {
      const decision = addConflict(context, {
        id: `${manifestPath}#${pointer}`,
        path: manifestPath,
        kind: "edited-owned",
        message: `${path.join(".")} in ${manifestPath} is no longer needed but has been edited since Configra set it.`,
      });

      if (decision !== "replace") {
        continue;
      }
    }

    updated = deleteAt(updated, path);
    details.push({ kind: "remove-field", target: pointer, previous: current });
  }

  if (Object.keys(nextOwned).length > 0) {
    context.files[manifestPath] = { kind: "fields", fields: nextOwned };
  }

  if (details.length > 0) {
    const scripts = details.filter((detail) => detail.target.startsWith("/scripts/")).length;
    const dependencies = details.filter((detail) => dependencyPointer.test(detail.target)).length;
    const parts = [
      dependencies > 0 ? `${dependencies} dependency declarations` : "",
      scripts > 0 ? `${scripts} scripts` : "",
    ].filter(Boolean);

    context.changes.push({
      path: manifestPath,
      action: text === undefined ? "create" : "update",
      ownership: "fields",
      reason: parts.length > 0 ? `Update ${parts.join(" and ")}` : "Update project settings",
      details,
    });

    const { formatting } = context.input.settings;
    const indent = formatting.indentStyle === "tab" ? "\t" : " ".repeat(formatting.indentSize);

    context.writes.push({ path: manifestPath, content: serializeJson(updated, text, indent) });
  }
}

/**
 * Plans removal of files and line sets Configra owned that the selections no longer need.
 */
function planRemovals(context: Context, desiredPaths: Set<string>): void {
  for (const [path, entry] of Object.entries(context.previous)) {
    if (desiredPaths.has(path) || path === configPath || path === statePath) {
      continue;
    }

    if (entry.kind === "entry") {
      context.diagnostics.push({
        code: "ENTRY_ORPHANED",
        severity: "warning",
        path,
        message: `${path} belongs to the project, so Configra leaves it. It loads a Configra file that's being removed, so delete it or remove the import.`,
      });

      continue;
    }

    if (entry.kind === "file") {
      const current = context.input.snapshot.read(path);

      if (current === undefined) {
        continue;
      }

      if (textHash(current) !== entry.hash) {
        const decision = addConflict(context, {
          id: path,
          path,
          kind: "edited-owned",
          message: `${path} is no longer needed but has been edited since Configra wrote it.`,
        });

        if (decision !== "replace") {
          continue;
        }
      }

      context.changes.push({
        path,
        action: "delete",
        ownership: "file",
        reason: "No longer needed by the selected tools",
        details: [],
      });
      context.writes.push({ path, content: null });
    }

    if (entry.kind === "lines") {
      planLines(context, path, [], "");
    }

    if (entry.kind === "fields") {
      planManifest(context, path, []);
    }
  }
}

/**
 * Builds the package scripts from the resolved checks.
 */
function scriptFields(checks: ResolvedCheck[]): { fields: ManifestFieldContribution[]; summary: ScriptSummary[] } {
  const summary: ScriptSummary[] = [];
  const lintChecks = checks.filter((check) => check.aggregate === "lint");
  const formatCheck = checks.find((check) => check.aggregate === "format");

  for (const check of lintChecks) {
    summary.push({ name: check.script, command: renderCommand(check.command), writes: false });
  }

  if (lintChecks.length > 0) {
    summary.push({
      name: "lint",
      command: lintChecks.map((check) => `npm run ${check.script}`).join(" && "),
      writes: false,
    });
  }

  const fixes = lintChecks.filter((check) => check.fixCommand);

  if (fixes.length > 0) {
    summary.push({
      name: "lint:fix",
      command: fixes.map((check) => renderCommand(check.fixCommand as ResolvedCheck["command"])).join(" && "),
      writes: true,
    });
  }

  if (formatCheck) {
    summary.push({ name: "format:check", command: renderCommand(formatCheck.command), writes: false });

    if (formatCheck.fixCommand) {
      summary.push({ name: "format", command: renderCommand(formatCheck.fixCommand), writes: true });
    }
  }

  const fields = summary.map((script) => ({
    tool: "configra" as const,
    manifest: "package.json" as const,
    path: ["scripts", script.name],
    value: script.command,
    reason: "Check script",
    kind: "script" as const,
  }));

  return { fields, summary };
}

/**
 * Fields for a manifest Configra creates, plus `engines` for an existing private manifest without one.
 */
function settingFields(context: Context, settings: ResolvedSettings): ManifestFieldContribution[] {
  const manifestText = context.input.snapshot.read("package.json");
  const field = (path: string[], value: JsonValue, reason: string): ManifestFieldContribution => ({
    tool: "configra",
    manifest: "package.json",
    path,
    value,
    reason,
    kind: "setting",
  });

  if (manifestText === undefined) {
    return [
      field(["private"], true, "A tooling manifest isn't published"),
      ...(settings.moduleType ? [field(["type"], settings.moduleType, "Module type for JavaScript files")] : []),
      field(["engines", "node"], ">=24.15", "Node.js version the generated checks need"),
    ];
  }

  let manifest: JsonObject;

  try {
    manifest = JSON.parse(manifestText) as JsonObject;
  } catch {
    return [];
  }

  const engines = getAt(manifest, ["engines", "node"]);

  if (engines === undefined) {
    if (manifest.private === true) {
      return [field(["engines", "node"], ">=24.15", "Node.js version the generated checks need")];
    }

    return [];
  }

  if (typeof engines !== "string" || semver.validRange(engines) === null || !semver.subset(engines, ">=24.15.0")) {
    context.diagnostics.push({
      code: "PLAN_ENGINES_BELOW_MINIMUM",
      severity: "warning",
      path: "package.json",
      message: `engines.node is ${JSON.stringify(engines)}, but the generated checks need Node.js 24.15 or later. Configra leaves it unchanged.`,
    });
  }

  return [];
}

/**
 * Builds the plan.
 */
export function createPlan(input: PlanInput): Plan {
  const { settings, snapshot } = input;
  const selections: Selections = { ...settings.selections, decisions: { ...settings.selections.decisions } };

  const context: Context = {
    input,
    selections,
    changes: [],
    conflicts: [],
    diagnostics: [],
    writes: [],
    files: {},
    previous: input.state?.files ?? {},
  };

  if (input.state && input.state.configraVersion !== input.configraVersion) {
    context.diagnostics.push({
      code: "STATE_VERSION_DIFFERS",
      severity: "warning",
      path: statePath,
      message: `Configra ${input.state.configraVersion} last wrote this project; this is ${input.configraVersion}. Review range and file changes in the preview.`,
    });
  }

  const checks = selections.tools.flatMap((id) => tools[id].checks(settings));
  const contributions: Contribution[] = selections.tools.map((id) => tools[id].render(settings, checks));

  // Tools can share a helper, such as the PHP tool runner, so each path is planned once.
  const files = [
    ...new Map(contributions.flatMap((contribution) => contribution.files).map((file) => [file.path, file])).values(),
  ];
  const desiredPaths = new Set<string>();
  const { fields: scripts, summary } = scriptFields(checks);

  context.diagnostics.push(...contributions.flatMap((contribution) => contribution.diagnostics));

  if (!input.saveOnly) {
    const plannedFiles = new Set(files.map((file) => file.path));
    const adoptedEntries = new Set<string>();
    const fieldRemovals: ManifestFieldContribution[] = [];

    // Competing configuration that would shadow or replace Configra's files.
    const seen = new Set<string>();

    for (const competing of contributions.flatMap((contribution) => contribution.competing)) {
      const key = `${competing.path}#${competing.field?.join(".") ?? ""}`;

      if (seen.has(key) || plannedFiles.has(competing.path)) {
        continue;
      }

      seen.add(key);

      if (competing.field) {
        if (!hasJsonField(snapshot.read(competing.path), competing.field)) {
          continue;
        }

        const id = `${competing.path}#${toPointer(competing.field)}`;

        const decision = addConflict(context, {
          id,
          path: competing.path,
          kind: "competing-config",
          message: `${competing.path} has a "${competing.field.join(".")}" field that ${tools[competing.tool].label} reads instead of Configra's file.`,
        });

        if (decision === "replace") {
          fieldRemovals.push({
            tool: competing.tool,
            manifest: "package.json",
            path: competing.field,
            value: null,
            reason: "Remove competing configuration",
            kind: "setting",
          });
        } else if (decision === "retain") {
          context.diagnostics.push(retainedCompetingDiagnostic(competing.tool, id));
        }

        continue;
      }

      if (!snapshot.exists(competing.path)) {
        continue;
      }

      if (context.previous[competing.path]?.kind === "entry") {
        adoptedEntries.add(competing.tool);
        context.files[competing.path] = { kind: "entry" };
        desiredPaths.add(competing.path);
        context.diagnostics.push({
          code: "ENTRY_RENAME_SUGGESTED",
          severity: "warning",
          path: competing.path,
          message: `${competing.path} is the project's ${tools[competing.tool].label} entry file, but the package's module type now suggests ${files.find((file) => file.tool === competing.tool && file.ownership === "entry")?.path ?? "another name"}. Rename it when convenient.`,
        });

        continue;
      }

      const decision = addConflict(context, {
        id: competing.path,
        path: competing.path,
        kind: "competing-config",
        message: `${competing.path} is ${tools[competing.tool].label} configuration that competes with Configra's.`,
      });

      if (decision === "replace") {
        context.changes.push({
          path: competing.path,
          action: "delete",
          ownership: "file",
          reason: "Remove competing configuration",
          details: [],
        });
        context.writes.push({ path: competing.path, content: null });
      } else if (decision === "retain") {
        context.diagnostics.push(retainedCompetingDiagnostic(competing.tool, competing.path));
      }
    }

    for (const file of files) {
      desiredPaths.add(file.path);
      planFile(context, file, adoptedEntries);
    }

    const linesByPath = new Map<string, { lines: string[]; reasons: string[] }>();

    for (const contribution of contributions.flatMap((item) => item.lines)) {
      const existing = linesByPath.get(contribution.path) ?? { lines: [], reasons: [] };

      existing.lines.push(...contribution.lines.filter((line) => !existing.lines.includes(line)));
      existing.reasons.push(contribution.reason);
      linesByPath.set(contribution.path, existing);
    }

    for (const [path, { lines, reasons }] of [...linesByPath].sort(([a], [b]) => a.localeCompare(b))) {
      desiredPaths.add(path);
      planLines(context, path, lines, reasons.join("; "));
    }

    const packageFields = [
      ...settingFields(context, settings),
      ...scripts,
      ...contributions.flatMap((contribution) => contribution.fields),
    ].filter((field) => field.manifest === "package.json");

    if (packageFields.length > 0 || context.previous["package.json"] || fieldRemovals.length > 0) {
      desiredPaths.add("package.json");
      planManifest(context, "package.json", packageFields);

      if (fieldRemovals.length > 0) {
        applyFieldRemovals(context, fieldRemovals);
      }
    }

    const composerFields = contributions
      .flatMap((contribution) => contribution.fields)
      .filter((field) => field.manifest === "composer.json");

    if (composerFields.length > 0 || context.previous["composer.json"]) {
      desiredPaths.add("composer.json");
      planManifest(context, "composer.json", composerFields);
    }

    planRemovals(context, desiredPaths);
  }

  const config = toSavedConfig(selections, input.schemaUrl);
  const configText = snapshot.read(configPath);
  let configChanged = true;

  if (configText !== undefined) {
    try {
      configChanged = !jsonEqual(JSON.parse(configText) as JsonValue, config as unknown as JsonValue);
    } catch {
      configChanged = true;
    }
  }

  if (configChanged) {
    context.changes.push({
      path: configPath,
      action: configText === undefined ? "create" : "update",
      ownership: "selections",
      reason: "Saved selections",
      details: [],
    });

    context.writes.push({ path: configPath, content: serializeJson(config as unknown as JsonValue, configText) });
  }

  const state: OwnershipState = {
    version: 1,
    configraVersion: input.configraVersion,
    files: input.saveOnly
      ? { ...context.previous }
      : (sortKeys(context.files as unknown as JsonValue) as unknown as OwnershipState["files"]),
  };

  const stateText = snapshot.read(statePath);
  const stateContent = serializeJson(sortKeys(state as unknown as JsonValue) as JsonValue);

  if (!input.saveOnly && (stateText === undefined || textHash(stateText) !== textHash(stateContent))) {
    context.changes.push({
      path: statePath,
      action: stateText === undefined ? "create" : "update",
      ownership: "state",
      reason: "Ownership state for Configra's files, lines, and fields",
      details: [],
    });

    context.writes.push({ path: statePath, content: stateContent });
  }

  const dependencies: DependencyChanges = { npm: { add: {}, remove: [] }, composer: { add: {}, remove: [] } };

  for (const change of context.changes) {
    const manager = change.path === "package.json" ? "npm" : change.path === "composer.json" ? "composer" : undefined;

    if (!manager) {
      continue;
    }

    for (const detail of change.details) {
      const match = dependencyPointer.exec(detail.target);

      if (!match) {
        continue;
      }

      const name = (match[4] as string).replaceAll("~1", "/").replaceAll("~0", "~");

      if (detail.kind === "set-field") {
        dependencies[manager].add[name] = detail.value as string;
      } else {
        dependencies[manager].remove.push(name);
      }
    }
  }

  dependencies.npm.remove.sort();
  dependencies.composer.remove.sort();

  const byPath = (a: { path: string }, b: { path: string }) => a.path.localeCompare(b.path);

  return {
    selections,
    config,
    changes: context.changes.sort(byPath),
    conflicts: context.conflicts.sort((a, b) => a.id.localeCompare(b.id)),
    diagnostics: context.diagnostics,
    checks,
    scripts: summary,
    dependencies,
    managedPackages: {
      npm: managedNames(contributions, "package.json"),
      composer: managedNames(contributions, "composer.json"),
    },
    writes: mergeWrites(context.writes),
    state,
  };
}

/**
 * Returns whether JSON text has a value at a key path. Invalid JSON has no fields.
 */
function hasJsonField(text: string | undefined, path: readonly string[]): boolean {
  if (text === undefined) {
    return false;
  }

  try {
    return getAt(JSON.parse(text) as JsonValue, path) !== undefined;
  } catch {
    return false;
  }
}

/**
 * Reports that keeping competing configuration leaves the tool unusable as configured.
 */
function retainedCompetingDiagnostic(tool: keyof typeof tools, id: string): Diagnostic {
  return {
    code: "PLAN_RETAINED_CONFIG_INCOMPATIBLE",
    severity: "error",
    path: id,
    message: `Keeping ${id} means ${tools[tool].label} won't load Configra's settings. Remove ${tool} from the tool list, or replace the existing configuration.`,
  };
}

/**
 * Applies competing-field removals to the planned `package.json` write.
 */
function applyFieldRemovals(context: Context, removals: ManifestFieldContribution[]): void {
  const index = context.writes.findIndex((write) => write.path === "package.json");
  const original = context.input.snapshot.read("package.json");
  const base = index >= 0 ? context.writes[index]?.content : original;

  if (base === undefined || base === null) {
    return;
  }

  let manifest = JSON.parse(base) as JsonObject;
  const details: ChangeDetail[] = [];

  for (const removal of removals) {
    const previous = getAt(manifest, removal.path);

    manifest = deleteAt(manifest, removal.path);
    details.push({
      kind: "remove-field",
      target: toPointer(removal.path),
      ...(previous !== undefined ? { previous } : {}),
    });
  }

  const content = serializeJson(manifest, original);

  if (index >= 0) {
    context.writes[index] = { path: "package.json", content };
  } else {
    context.writes.push({ path: "package.json", content });
  }

  const change = context.changes.find((item) => item.path === "package.json");

  if (change) {
    change.details.push(...details);
  } else {
    context.changes.push({
      path: "package.json",
      action: "update",
      ownership: "fields",
      reason: "Remove competing configuration",
      details,
    });
  }
}

/**
 * Keeps the last write for each path, so later planners can refine earlier writes.
 */
function mergeWrites(writes: FileWrite[]): FileWrite[] {
  const byPath = new Map<string, FileWrite>();

  for (const write of writes) {
    byPath.set(write.path, write);
  }

  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}
