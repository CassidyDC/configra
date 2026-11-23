/**
 * The shared init and update workflow: read inputs, normalize selections, plan, and report or apply.
 */

import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CommandName, Diagnostic, PlannedCommand, PresetId } from "../../contracts.js";
import { hookSummary } from "../../components/tools/lefthook.js";
import { applyWrites, readPendingRun, runFiles, type ApplyHooks, type RunFiles } from "../../generator/apply.js";
import { checkPrerequisites, discover } from "../../generator/discover.js";
import { normalizeSelections } from "../../generator/normalize.js";
import { configPath, createPlan, statePath, type Plan } from "../../generator/plan.js";
import { resolveSettings } from "../../generator/resolve.js";
import {
  configSchema,
  parseVersioned,
  stateSchema,
  type OwnershipState,
  type SavedConfig,
} from "../../generator/state/schemas.js";
import { Snapshot } from "../../platform/filesystem.js";
import { isGitBoundary } from "../../platform/git.js";
import type { ProcessRunner } from "../../platform/process.js";
import type { ParsedArgs } from "../args.js";
import { emptyDocument, type OutputDocument } from "../output.js";

/**
 * The environment a workflow runs in. Injected so tests control the terminal, processes, and paths.
 */
export interface WorkflowEnvironment {
  /** The caller's working directory, which relative --cwd and --config paths resolve from. */
  cwd: string;
  version: string;
  runner: ProcessRunner;
  interactive: boolean;

  /** Test hooks for the apply phase. */
  applyHooks?: ApplyHooks;
}

export interface WorkflowResult {
  document: OutputDocument;

  /** The target root, shown in the text preview. */
  target: string;
}

/**
 * A planned run ready for the apply phase.
 */
export interface PlannedWorkflow extends WorkflowResult {
  plan?: Plan;
  state?: OwnershipState;
  snapshot?: Snapshot;
  runFiles?: RunFiles;
}

/**
 * The `$schema` URL for saved selections, pinned to the installed Configra version.
 */
export function schemaUrl(version: string): string {
  return `https://unpkg.com/@cassidydc/configra@${version}/dist/schemas/config.v1.json`;
}

/**
 * Finishes a document with an error status from its diagnostics.
 */
function fail(document: OutputDocument, diagnostics: Diagnostic[]): OutputDocument {
  document.diagnostics.push(...diagnostics);
  document.status = "error";
  document.exitCode = 1;

  return document;
}

/**
 * Validates selected plugin and theme paths against the project before resolving settings.
 */
function validatePackages(snapshot: Snapshot, packages: readonly string[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const path of packages) {
    const entry = snapshot.entry(path);
    const isMuPluginFile = entry.kind === "file" && path.endsWith(".php");

    if (entry.kind !== "directory" && !isMuPluginFile) {
      diagnostics.push({
        code: "SELECTION_PACKAGE_NOT_FOUND",
        severity: "error",
        path,
        message: `${path} isn't a directory or a single-file must-use plugin in the project.`,
      });
    } else if (entry.kind === "directory" && isGitBoundary(join(snapshot.root, path))) {
      diagnostics.push({
        code: "SELECTION_PACKAGE_OUTSIDE_PROJECT",
        severity: "error",
        path,
        message: `${path} is its own Git repository, so it's outside this project. Run Configra there instead.`,
      });
    }
  }

  return diagnostics;
}

/**
 * Lists the commands later phases would run, marked approved only when their flag was passed.
 */
function plannedCommands(plan: Plan, args: ParsedArgs): PlannedCommand[] {
  const commands: PlannedCommand[] = [];
  const manifestChanges = plan.changes.some((change) => change.path === "package.json");

  if (manifestChanges || args.install) {
    commands.push({
      phase: "install",
      executable: "npm",
      args: ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
      cwd: ".",
      approved: args.install,
    });
  }

  if (
    plan.selections.tools.includes("lefthook") &&
    (args.installHooks || plan.changes.some((change) => change.path === "lefthook.yml" && change.action === "create"))
  ) {
    commands.push({
      phase: "activate-hooks",
      executable: "npx",
      args: ["--no", "--", "lefthook", "install"],
      cwd: ".",
      approved: args.installHooks,
    });
  }

  return commands;
}

/**
 * Plans an init or update run and, outside dry-run mode, hands the plan to the apply phase.
 */
export function planWorkflow(
  command: CommandName,
  args: ParsedArgs,
  environment: WorkflowEnvironment,
): PlannedWorkflow {
  const root = resolve(environment.cwd, args.cwd ?? ".");
  const document = emptyDocument(environment.version, command, args.dryRun);
  const result = { document, target: args.cwd ?? "." };

  try {
    if (!statSync(root).isDirectory()) {
      throw new Error("not a directory");
    }
  } catch {
    fail(document, [
      { code: "TARGET_NOT_FOUND", severity: "error", message: `--cwd ${args.cwd ?? "."} isn't an existing directory.` },
    ]);

    return result;
  }

  const snapshot = new Snapshot(root);
  const hasTargetConfig = snapshot.exists(configPath);

  if (command === "init" && hasTargetConfig) {
    fail(document, [
      {
        code: "INIT_CONFIG_EXISTS",
        severity: "error",
        path: configPath,
        message: "This project already has .configra/config.json. Use `configra update` to reapply or change it.",
      },
    ]);

    return result;
  }

  if (command === "update" && !hasTargetConfig) {
    fail(document, [
      {
        code: "UPDATE_CONFIG_MISSING",
        severity: "error",
        path: configPath,
        message: "This project has no .configra/config.json. Use `configra init` to set it up.",
      },
    ]);

    return result;
  }

  let saved: SavedConfig | undefined;
  const configSource = args.config
    ? resolve(environment.cwd, args.config)
    : hasTargetConfig
      ? join(root, configPath)
      : undefined;

  if (configSource) {
    let text: string | undefined;

    try {
      text = args.config ? readFileSync(configSource, "utf8") : snapshot.read(configPath);
    } catch {
      text = undefined;
    }

    if (text === undefined) {
      fail(document, [
        {
          code: "CONFIG_NOT_FOUND",
          severity: "error",
          path: args.config ?? configPath,
          message: `Can't read ${args.config ?? configPath}.`,
        },
      ]);

      return result;
    }

    const parsed = parseVersioned<SavedConfig>(text, configSchema, args.config ?? configPath, "CONFIG");

    if (!parsed.value) {
      fail(document, parsed.diagnostics);

      return result;
    }

    saved = parsed.value;
  }

  let state: OwnershipState | undefined;
  const stateText = snapshot.read(statePath);

  if (stateText !== undefined) {
    const parsed = parseVersioned<OwnershipState>(stateText, stateSchema, statePath, "STATE");

    if (!parsed.value) {
      fail(document, parsed.diagnostics);

      return result;
    }

    state = parsed.value;
  }

  const discovery = discover(snapshot);
  let fallback: PresetId = "node";

  if (!args.project && !saved) {
    if (discovery.wordpress.kind !== "none") {
      fail(document, [
        {
          code: "INIT_WORDPRESS_DETECTED",
          severity: "error",
          message:
            "This looks like a WordPress site. Pass --project wordpress-site and select directories with --package, or pass --project node to set up a Node.js project.",
        },
      ]);

      document.discovery = { ...discovery, prerequisites: [] };

      return result;
    }

    fallback = "node";
  }

  const normalized = normalizeSelections(
    {
      ...(args.project !== undefined ? { project: args.project } : {}),
      ...(args.packages !== undefined ? { packages: args.packages } : {}),
      ...(args.languages !== undefined ? { languages: args.languages } : {}),
      ...(args.ui !== undefined ? { ui: args.ui } : {}),
      ...(args.standards !== undefined ? { standards: args.standards } : {}),
      ...(args.tools !== undefined ? { tools: args.tools } : {}),
      ...(args.commitMessages !== undefined ? { commitMessages: args.commitMessages } : {}),
    },
    saved,
    fallback,
  );

  document.diagnostics.push(...normalized.diagnostics);

  if (!normalized.selections) {
    return { ...result, document: fail(document, []) };
  }

  const packageDiagnostics = validatePackages(snapshot, normalized.selections.packages);

  if (packageDiagnostics.length > 0) {
    return { ...result, document: fail(document, packageDiagnostics) };
  }

  const files = runFiles(root, environment.runner);
  const pending = readPendingRun(files);
  const pendingPaths = pending ? new Set(pending) : undefined;
  const settings = resolveSettings(normalized.selections, snapshot, pendingPaths);

  if (pending !== undefined) {
    document.diagnostics.push({
      code: "APPLY_PENDING_RUN",
      severity: "warning",
      message: args.dryRun
        ? "An earlier Configra run stopped before it finished. The next run that writes files adopts the files it wrote that match this plan and reports the rest as conflicts."
        : "An earlier Configra run stopped before it finished. This plan adopts the files it wrote that match and reports the rest as conflicts.",
    });
  }

  const plan = createPlan({
    snapshot,
    settings,
    state,
    configraVersion: environment.version,
    schemaUrl: schemaUrl(environment.version),
    ...(args.onConflict ? { onConflict: args.onConflict as "retain" | "replace" } : {}),
    ...(pendingPaths ? { pending: pendingPaths } : {}),
  });

  const { $schema: _schema, ...selections } = plan.config;

  document.selections = selections;
  document.changes = plan.changes;
  document.conflicts = plan.conflicts;
  document.dependencies = plan.dependencies;
  document.scripts = plan.scripts;
  document.hooks = hookSummary(settings, plan.checks);
  document.commands = plannedCommands(plan, args);
  document.diagnostics.push(...plan.diagnostics);

  if (args.dryRun) {
    document.discovery = { ...discovery, prerequisites: checkPrerequisites(plan.selections, environment.runner, root) };
  }

  const hasErrors = document.diagnostics.some((diagnostic) => diagnostic.severity === "error");
  const unresolved = plan.conflicts.some((conflict) => !conflict.decision);

  document.status = hasErrors ? "error" : unresolved ? "conflicts" : plan.changes.length > 0 ? "changes" : "ok";

  if (hasErrors) {
    document.exitCode = 1;
  } else if (args.dryRun && args.exitCode && (plan.changes.length > 0 || plan.conflicts.length > 0)) {
    document.exitCode = 3;
  }

  return { ...result, plan, snapshot, runFiles: files, ...(state ? { state } : {}) };
}

/**
 * Explains how to finish an interrupted run: `update` once the saved selections exist, or the same command.
 */
function retryAdvice(args: ParsedArgs, configWritten: boolean): string {
  if (!configWritten) {
    return "Run the same command again to finish.";
  }

  return `Run \`configra update${args.cwd !== undefined ? ` --cwd ${JSON.stringify(args.cwd)}` : ""}\` to finish.`;
}

/**
 * Applies a planned, approved run and records the outcome of each phase in its document.
 */
export function applyWorkflow(args: ParsedArgs, planned: PlannedWorkflow, hooks?: ApplyHooks): void {
  const { document, plan, snapshot } = planned;

  if (!plan || !snapshot || !planned.runFiles) {
    return;
  }

  const pending = readPendingRun(planned.runFiles) !== undefined;

  if (plan.writes.length === 0 && !pending) {
    document.phases = [{ phase: "apply", status: "skipped", message: "Everything is up to date." }];

    return;
  }

  const result = applyWrites(snapshot, plan.writes, planned.runFiles, hooks);

  if (result.ok) {
    document.phases = [{ phase: "apply", status: "done", message: `Wrote ${result.written.length} files.` }];

    return;
  }

  const configWritten = result.written.includes(configPath) || snapshot.exists(configPath);
  const retry = result.written.length > 0 ? ` ${retryAdvice(args, configWritten)}` : "";

  document.diagnostics.push(...result.diagnostics);
  document.phases = [
    {
      phase: "apply",
      status: "failed",
      message: `Wrote ${result.written.length} of ${plan.writes.length} files.${retry}`,
    },
  ];
  document.status = "error";
  document.exitCode = 1;
}
