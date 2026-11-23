/**
 * The versioned JSON result and the text preview. Both render the same change details.
 */

import type {
  CommandName,
  Conflict,
  Diagnostic,
  DiscoveryReport,
  PlannedChange,
  PlannedCommand,
} from "../contracts.js";
import type { ScriptSummary } from "../generator/plan.js";
import type { SavedConfig } from "../generator/state/schemas.js";

export const outputVersion = 1;

/**
 * The stable JSON document workflow commands print in JSON mode.
 */
export interface OutputDocument {
  version: typeof outputVersion;
  configra: string;
  command: CommandName | null;
  status: "ok" | "changes" | "conflicts" | "error";
  exitCode: number;
  dryRun: boolean;
  selections?: Omit<SavedConfig, "$schema">;
  changes: PlannedChange[];
  conflicts: Conflict[];
  dependencies: { npm: { add: Record<string, string>; remove: string[] } };
  scripts: ScriptSummary[];
  hooks: Array<{ hook: string; name: string; run: string }>;
  commands: PlannedCommand[];
  phases?: Array<{
    phase: "apply" | "install" | "activate-hooks";
    status: "done" | "skipped" | "failed";
    message?: string;
  }>;
  discovery?: DiscoveryReport;
  diagnostics: Diagnostic[];
}

/**
 * Returns an empty document for a command, used for argument and validation errors.
 */
export function emptyDocument(configra: string, command: CommandName | null, dryRun: boolean): OutputDocument {
  return {
    version: outputVersion,
    configra,
    command,
    status: "ok",
    exitCode: 0,
    dryRun,
    changes: [],
    conflicts: [],
    dependencies: { npm: { add: {}, remove: [] } },
    scripts: [],
    hooks: [],
    commands: [],
    diagnostics: [],
  };
}

/**
 * Text styling that turns itself off when output isn't a terminal or `NO_COLOR` is set.
 */
export interface Style {
  bold: (text: string) => string;
  dim: (text: string) => string;
  green: (text: string) => string;
  yellow: (text: string) => string;
  red: (text: string) => string;
}

/**
 * Creates the text style for the current output.
 */
export function createStyle(enabled: boolean): Style {
  const wrap = (open: number, close: number) => (text: string) =>
    enabled ? `\u001B[${open}m${text}\u001B[${close}m` : text;

  return { bold: wrap(1, 22), dim: wrap(2, 22), green: wrap(32, 39), yellow: wrap(33, 39), red: wrap(31, 39) };
}

/**
 * Formats a JSON value for a change detail line.
 */
function formatValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/**
 * Where a preview's hints point: to flags, to the terminal prompts that follow a flag run, or to the
 * setup wizard's choices.
 */
export type HintMode = "flags" | "prompts" | "wizard";

/**
 * Renders the text preview of a document.
 */
export function renderText(document: OutputDocument, style: Style, target: string, hints: HintMode = "flags"): string {
  const lines: string[] = [];
  const heading = (text: string) => lines.push("", style.bold(text));
  const title = `Configra ${document.command ?? ""}${document.dryRun ? " (dry run)" : ""}`.trim();

  lines.push(`${style.bold(title)} in ${target}`);

  if (document.selections) {
    const s = document.selections;

    heading("Selections");
    lines.push(`  project          ${s.project}`);

    if (s.packages) {
      lines.push(`  packages         ${s.packages.length > 0 ? s.packages.join(", ") : "(none: root files only)"}`);
    }

    lines.push(`  languages        ${s.languages?.join(", ") || "(none)"}`);
    lines.push(`  ui               ${s.ui?.join(", ") || "(none)"}`);
    lines.push(
      `  standards        ${
        Object.entries(s.standards ?? {})
          .map(([language, standard]) => `${language}=${standard}`)
          .join(", ") || "(none)"
      }`,
    );
    lines.push(`  tools            ${s.tools?.join(", ") || "(none)"}`);
    lines.push(`  commit messages  ${s.commitMessages ?? "plain"}`);
  }

  if (document.changes.length > 0 || document.selections) {
    heading("Changes");

    if (document.changes.length === 0) {
      lines.push("  No changes. Everything is up to date.");
    }

    const width = Math.max(...document.changes.map((change) => change.path.length), 0) + 2;

    for (const change of document.changes) {
      const color = change.action === "create" ? style.green : change.action === "delete" ? style.red : style.yellow;

      lines.push(`  ${color(change.action.padEnd(6))}  ${change.path.padEnd(width)}${style.dim(change.reason)}`);

      for (const detail of change.details) {
        const sign = detail.kind.startsWith("add") || detail.kind === "set-field" ? "+" : "-";
        const isField = detail.kind.endsWith("field");
        const target = isField
          ? detail.target.replace(/^\//, "").replaceAll("/", ".").replaceAll("~1", "/").replaceAll("~0", "~")
          : detail.target;
        const value = detail.value !== undefined ? ` ${formatValue(detail.value)}` : "";
        const previous =
          detail.previous !== undefined && detail.kind === "set-field"
            ? style.dim(` (was ${formatValue(detail.previous)})`)
            : "";

        lines.push(`            ${sign} ${target}${detail.kind.endsWith("line") ? "" : value}${previous}`);
      }
    }
  }

  if (document.conflicts.length > 0) {
    heading("Conflicts");

    for (const conflict of document.conflicts) {
      const decision = conflict.decision ? style.dim(` -> ${conflict.decision}`) : style.yellow(" (needs a decision)");

      lines.push(`  ${conflict.id}${decision}`);
      lines.push(`    ${conflict.message}`);
    }

    if (document.conflicts.some((conflict) => !conflict.decision)) {
      const hint =
        hints !== "flags"
          ? "Configra asks how to settle each conflict next."
          : "Settle conflicts with --on-conflict retain|replace, or answer the prompts in a terminal.";

      lines.push(`  ${style.dim(hint)}`);
    }
  }

  if (document.scripts.length > 0) {
    heading("Scripts (run from the project root)");

    for (const script of document.scripts) {
      lines.push(`  ${script.name.padEnd(14)}${script.command}${script.writes ? style.dim("  (writes files)") : ""}`);
    }
  }

  if (document.hooks.length > 0) {
    heading("Git hooks");

    for (const hook of document.hooks) {
      lines.push(`  ${hook.hook.padEnd(11)} ${hook.name.padEnd(15)}${style.dim(hook.run)}`);
    }
  }

  if (document.commands.length > 0) {
    heading("Commands");

    for (const command of document.commands) {
      const install = command.phase === "install";

      const pending =
        hints === "wizard"
          ? install
            ? "runs with Generate and install"
            : "asked before applying"
          : `pass ${install ? "--install" : "--install-hooks"} to run`;
      const note = command.approved ? "" : style.dim(`  (${pending})`);

      lines.push(`  ${[command.executable, ...command.args].join(" ")}  ${style.dim(`in ${command.cwd}`)}${note}`);
    }
  }

  lines.push(...resultLines(document, style));

  if (document.discovery) {
    const { discovery } = document;

    heading("Discovery");
    lines.push(`  detected languages  ${discovery.languages.join(", ") || "(none)"}`);
    lines.push(`  detected UI         ${discovery.ui.join(", ") || "(none)"}`);

    if (discovery.wordpress.kind !== "none") {
      lines.push(`  WordPress           ${discovery.wordpress.kind}`);
      lines.push(`  candidates          ${discovery.wordpress.candidates.join(", ") || "(none)"}`);
    }

    if (discovery.packageManagers.length > 0) {
      lines.push(`  package managers    ${discovery.packageManagers.join(", ")}`);
    }

    for (const prerequisite of discovery.prerequisites) {
      const status = prerequisite.status === "ok" ? style.green("ok") : style.yellow(prerequisite.status);

      lines.push(
        `  ${prerequisite.name.padEnd(20)}${status}  ${prerequisite.found ?? "not found"} (needs ${prerequisite.required})`,
      );
    }
  }

  lines.push(...diagnosticLines(document.diagnostics, style));

  return `${lines.join("\n")}\n`;
}

/**
 * Renders the outcome of each phase, with a blank line and heading before it.
 */
function resultLines(document: OutputDocument, style: Style): string[] {
  if (!document.phases || document.phases.length === 0) {
    return [];
  }

  return [
    "",
    style.bold("Result"),
    ...document.phases.map((phase) => {
      const color = phase.status === "done" ? style.green : phase.status === "failed" ? style.red : style.dim;

      return `  ${phase.phase.padEnd(15)}${color(phase.status)}${phase.message ? `  ${phase.message}` : ""}`;
    }),
  ];
}

/**
 * Renders diagnostics, with a blank line and heading before them.
 */
export function diagnosticLines(diagnostics: readonly Diagnostic[], style: Style): string[] {
  if (diagnostics.length === 0) {
    return [];
  }

  return [
    "",
    style.bold("Diagnostics"),
    ...diagnostics.map((diagnostic) => {
      const color =
        diagnostic.severity === "error" ? style.red : diagnostic.severity === "warning" ? style.yellow : style.dim;

      return `  ${color(diagnostic.severity)} ${diagnostic.code}: ${diagnostic.message}`;
    }),
  ];
}

/**
 * Renders what an approved run did: each phase's outcome and the diagnostics, without the preview the
 * user already approved.
 */
export function renderOutcome(document: OutputDocument, style: Style): string {
  return `${[...resultLines(document, style), ...diagnosticLines(document.diagnostics, style)].join("\n").trimStart()}\n`;
}
