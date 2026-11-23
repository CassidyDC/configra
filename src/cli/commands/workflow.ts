/**
 * The shared init and update workflow: read inputs, normalize selections, plan, and report or apply.
 */

import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CommandName, Diagnostic, PlannedCommand, PresetId } from "../../contracts.js";
import { hookSummary } from "../../components/tools/lefthook.js";
import { applyWrites, readPendingRun, runFiles, type ApplyHooks, type RunFiles } from "../../generator/apply.js";
import { checkPrerequisites, discover } from "../../generator/discover.js";
import {
  activateHooks,
  activateHooksCommand,
  hookCleanupAdvice,
  installDependencies,
  preflight,
  unsupportedPackageManagers,
} from "../../generator/install.js";
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
import { Snapshot, toProjectPath } from "../../platform/filesystem.js";
import { isGitBoundary } from "../../platform/git.js";
import { enclosingWorkspaceRoot, npmInstall } from "../../platform/package-managers/npm.js";
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
 * Lists the commands later phases would run, marked approved only when their flag was passed. The install
 * runs where npm would run it, which is the enclosing workspace root when the project is a workspace member.
 */
function plannedCommands(plan: Plan, args: ParsedArgs, root: string): PlannedCommand[] {
  const commands: PlannedCommand[] = [];
  const manifestChanges = plan.changes.some((change) => change.path === "package.json");

  if (manifestChanges || args.install) {
    const workspaceRoot = enclosingWorkspaceRoot(root);

    commands.push({
      phase: "install",
      ...npmInstall,
      args: [...npmInstall.args],
      cwd: workspaceRoot === undefined ? "." : toProjectPath(root, workspaceRoot),
      approved: args.install,
    });
  }

  if (
    plan.selections.tools.includes("lefthook") &&
    (args.installHooks || plan.changes.some((change) => change.path === "lefthook.yml" && change.action === "create"))
  ) {
    commands.push({
      phase: "activate-hooks",
      ...activateHooksCommand,
      args: [...activateHooksCommand.args],
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
  document.commands = plannedCommands(plan, args, root);
  document.diagnostics.push(...plan.diagnostics);

  const others = unsupportedPackageManagers(discovery.packageManagers);

  if (others.length > 0 && !args.install) {
    document.diagnostics.push({
      code: "INSTALL_PACKAGE_MANAGER_UNSUPPORTED",
      severity: "warning",
      message: `This project uses ${others.join(" and ")}. Configra declares the dependencies in package.json; install them with ${others[0]}.`,
    });
  }

  const cleanup = hookCleanupAdvice(root, plan, environment.runner);

  if (cleanup) {
    document.diagnostics.push(cleanup);
  }

  const requested = args.install || args.installHooks;
  const prerequisites =
    args.dryRun || requested ? checkPrerequisites(plan.selections, environment.runner, root) : undefined;

  if (requested && prerequisites) {
    const problems = preflight(root, plan, args, discovery.packageManagers, prerequisites, environment.runner);

    // A dry run reports what would stop the requested phases without failing.
    document.diagnostics.push(
      ...problems.map((problem) => (args.dryRun ? { ...problem, severity: "warning" as const } : problem)),
    );
  }

  if (args.dryRun && prerequisites) {
    document.discovery = { ...discovery, prerequisites };
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

  return `Run \`${["configra update", cwdFlag(args)].filter(Boolean).join(" ")}\` to finish.`;
}

/**
 * Applies a planned, approved run and records the outcome of each phase in its document.
 */
export function applyWorkflow(
  args: ParsedArgs,
  planned: PlannedWorkflow,
  runner: ProcessRunner,
  hooks?: ApplyHooks,
): void {
  const { document, plan, snapshot } = planned;

  if (!plan || !snapshot || !planned.runFiles) {
    return;
  }

  const phases: NonNullable<OutputDocument["phases"]> = [];
  const target = args.json ? "stderr" : "inherit";
  const pending = readPendingRun(planned.runFiles) !== undefined;
  const failRun = () => {
    document.status = "error";
    document.exitCode = 1;
  };

  document.phases = phases;

  if (plan.writes.length === 0 && !pending) {
    phases.push({ phase: "apply", status: "skipped", message: "Everything is up to date." });
  } else {
    const result = applyWrites(snapshot, plan.writes, planned.runFiles, hooks);

    if (result.ok) {
      phases.push({ phase: "apply", status: "done", message: `Wrote ${result.written.length} files.` });
    } else {
      const configWritten = result.written.includes(configPath) || snapshot.exists(configPath);
      const retry = result.written.length > 0 ? ` ${retryAdvice(args, configWritten)}` : "";

      document.diagnostics.push(...result.diagnostics);
      phases.push({
        phase: "apply",
        status: "failed",
        message: `Wrote ${result.written.length} of ${plan.writes.length} files.${retry}`,
      });
      skipPhases(phases, args, "Skipped because writing files failed.");
      failRun();

      return;
    }
  }

  if (args.install) {
    const outcome = installDependencies(runner, snapshot.root, target);

    if (!outcome.ok) {
      const retry = ["configra update --install", args.installHooks ? "--install-hooks" : "", cwdFlag(args)]
        .filter(Boolean)
        .join(" ");

      document.diagnostics.push({
        code: "INSTALL_FAILED",
        severity: "error",
        message: `Installing dependencies failed. The generated files are in place. Fix the problem, then run \`${retry}\`.`,
      });
      phases.push({ phase: "install", status: "failed", message: outcome.message });
      skipPhases(phases, { ...args, install: false }, "Skipped because installation failed.");
      failRun();

      return;
    }

    phases.push({ phase: "install", status: "done", message: outcome.message });
  }

  if (args.installHooks) {
    const outcome = activateHooks(runner, snapshot.root, target);

    phases.push({ phase: "activate-hooks", status: outcome.ok ? "done" : "failed", message: outcome.message });

    if (!outcome.ok) {
      document.diagnostics.push({
        code: "HOOKS_ACTIVATION_FAILED",
        severity: "error",
        message: `Activating Git hooks failed. Run \`npx lefthook install\` once the problem is fixed.`,
      });
      failRun();
    }
  }
}

/**
 * Returns the --cwd flag that targets the same project, or an empty string.
 */
function cwdFlag(args: ParsedArgs): string {
  return args.cwd !== undefined ? `--cwd ${JSON.stringify(args.cwd)}` : "";
}

/**
 * Records the requested phases that won't run.
 */
function skipPhases(phases: NonNullable<OutputDocument["phases"]>, args: ParsedArgs, message: string): void {
  if (args.install) {
    phases.push({ phase: "install", status: "skipped", message });
  }

  if (args.installHooks) {
    phases.push({ phase: "activate-hooks", status: "skipped", message });
  }
}
