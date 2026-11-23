/**
 * Dependency installation and explicit Git hook activation: checks that run before any file is written,
 * and the phases that run after the files are applied.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Diagnostic, Prerequisite } from "../contracts.js";
import { findGitRoot } from "../platform/git.js";
import { enclosingWorkspaceRoot, installedBinary, npmInstall } from "../platform/package-managers/npm.js";
import type { ProcessRunner, StreamTarget } from "../platform/process.js";
import type { Plan } from "./plan.js";

/**
 * The later phases a run asks for.
 */
export interface PhaseRequest {
  install: boolean;
  installHooks: boolean;
}

/**
 * The outcome of one phase.
 */
export interface PhaseOutcome {
  ok: boolean;
  message: string;
}

export const activateHooksCommand = { executable: "npx", args: ["--no", "--", "lefthook", "install"] };

/**
 * Returns the JavaScript package managers other than npm that the project uses.
 */
export function unsupportedPackageManagers(packageManagers: readonly string[]): string[] {
  return packageManagers.filter((manager) => manager !== "npm");
}

/**
 * Reports a missing or unsupported prerequisite for a requested phase.
 */
function prerequisiteError(prerequisite: Prerequisite | undefined, phase: string): Diagnostic | undefined {
  if (!prerequisite || prerequisite.status === "ok") {
    return undefined;
  }

  return {
    code: prerequisite.status === "missing" ? "PREREQUISITE_MISSING" : "PREREQUISITE_UNSUPPORTED",
    severity: "error",
    message:
      prerequisite.status === "missing"
        ? `${phase} needs ${prerequisite.name} ${prerequisite.required}, which wasn't found.`
        : `${phase} needs ${prerequisite.name} ${prerequisite.required}, but ${prerequisite.found ?? "an older version"} is installed.`,
  };
}

/**
 * Lists the hook names the generated `lefthook.yml` installs.
 */
function generatedHooks(plan: Plan): string[] {
  const hooks = new Set<string>();

  for (const check of plan.checks) {
    if (check.hook) {
      hooks.add(check.hook);
    }
  }

  if (plan.selections.commitMessages !== "off") {
    hooks.add("commit-msg");
  }

  return [...hooks].sort();
}

/**
 * Checks that the requested phases can run before Configra writes anything.
 */
export function preflight(
  root: string,
  plan: Plan,
  request: PhaseRequest,
  packageManagers: readonly string[],
  prerequisites: readonly Prerequisite[],
  runner: ProcessRunner,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const find = (name: Prerequisite["name"]) => prerequisites.find((prerequisite) => prerequisite.name === name);

  if (request.install) {
    const others = unsupportedPackageManagers(packageManagers);
    const workspaceRoot = enclosingWorkspaceRoot(root);

    if (others.length > 0) {
      diagnostics.push({
        code: "INSTALL_PACKAGE_MANAGER_UNSUPPORTED",
        severity: "error",
        message: `This project uses ${others.join(" and ")}, and Configra installs only with npm. Run without --install and install the declared dependencies with ${others[0]}.`,
      });
    }

    if (workspaceRoot !== undefined) {
      diagnostics.push({
        code: "INSTALL_OUTSIDE_SCOPE",
        severity: "error",
        path: ".",
        message: `npm would install in the workspace root at ${workspaceRoot}, outside this project. Run Configra with --cwd pointing at the workspace root, or run without --install.`,
      });
    }

    const npm = prerequisiteError(find("npm"), "Installing dependencies");
    const node = prerequisiteError(find("node"), "Installing dependencies");

    diagnostics.push(...[node, npm].filter((diagnostic) => diagnostic !== undefined));
  }

  if (request.installHooks) {
    diagnostics.push(...hookPreflight(root, plan, request, find("git"), runner));
  }

  return diagnostics;
}

/**
 * Checks that hook activation can run: a Git root, no other hook manager, and an available Lefthook binary.
 */
function hookPreflight(
  root: string,
  plan: Plan,
  request: PhaseRequest,
  git: Prerequisite | undefined,
  runner: ProcessRunner,
): Diagnostic[] {
  const error = (code: string, message: string): Diagnostic[] => [{ code, severity: "error", message }];

  if (!plan.selections.tools.includes("lefthook")) {
    return error("HOOKS_NOT_SELECTED", "--install-hooks needs the lefthook tool. Add lefthook to --tools.");
  }

  const gitError = prerequisiteError(git, "Activating Git hooks");

  if (gitError) {
    return [gitError];
  }

  const gitRoot = findGitRoot(root);

  if (gitRoot === undefined) {
    return error(
      "HOOKS_NO_REPOSITORY",
      "--install-hooks needs a Git repository. Run `git init`, then activate the hooks with `npx lefthook install`.",
    );
  }

  if (resolve(gitRoot) !== resolve(root)) {
    return error(
      "HOOKS_NOT_GIT_ROOT",
      `Git hooks belong to the repository at ${gitRoot}. Run Configra there with --cwd to configure and activate hooks.`,
    );
  }

  const hooksPath = runner.run("git", ["config", "--get", "core.hooksPath"], root).stdout.trim();

  if (hooksPath !== "") {
    return error(
      "HOOKS_PATH_CUSTOM",
      `core.hooksPath is set to ${hooksPath}, so another hook manager may own the hooks. Remove it with \`git config --unset core.hooksPath\` once you've moved its hooks, then activate with \`npx lefthook install\`.`,
    );
  }

  const hooksDirectory = runner.run("git", ["rev-parse", "--git-path", "hooks"], root).stdout.trim();
  const existing = generatedHooks(plan).filter((hook) => {
    const path = join(resolve(root, hooksDirectory || ".git/hooks"), hook);

    try {
      return existsSync(path) && !readFileSync(path, "utf8").includes("lefthook");
    } catch {
      return false;
    }
  });

  if (existing.length > 0) {
    return error(
      "HOOKS_EXISTING",
      `The repository already has ${existing.join(", ")} hooks that Lefthook would replace. Move them into lefthook-project.yml or remove them, then activate with \`npx lefthook install\`.`,
    );
  }

  const declared = plan.dependencies.npm.add.lefthook !== undefined || hasLefthookDeclared(root);

  if (installedBinary(root, "lefthook") === undefined && !(request.install && declared)) {
    return error(
      "HOOKS_LEFTHOOK_MISSING",
      "Lefthook isn't installed. Pass --install with --install-hooks, or run `npm install` first.",
    );
  }

  return [];
}

/**
 * Suggests removing the installed hooks when the plan deletes `lefthook.yml`. The installed hooks keep
 * working without it, since Lefthook's hook script passes when the config or binary is missing, but they
 * print a notice on every commit.
 */
export function hookCleanupAdvice(root: string, plan: Plan, runner: ProcessRunner): Diagnostic | undefined {
  if (!plan.changes.some((change) => change.path === "lefthook.yml" && change.action === "delete")) {
    return undefined;
  }

  const hooksDirectory = runner.run("git", ["rev-parse", "--git-path", "hooks"], root).stdout.trim();

  if (hooksDirectory === "") {
    return undefined;
  }

  const installed = ["pre-commit", "pre-push", "commit-msg"].some((hook) => {
    try {
      return readFileSync(join(resolve(root, hooksDirectory), hook), "utf8").includes("lefthook");
    } catch {
      return false;
    }
  });

  if (!installed) {
    return undefined;
  }

  return {
    code: "HOOKS_CLEANUP",
    severity: "warning",
    path: "lefthook.yml",
    message:
      "Lefthook's hooks are installed in this repository. Run `npx lefthook uninstall` before applying this change to remove them, or leave them, since they pass without lefthook.yml.",
  };
}

/**
 * Returns whether the project's manifest already declares Lefthook.
 */
function hasLefthookDeclared(root: string): boolean {
  try {
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as Record<
      string,
      Record<string, unknown> | undefined
    >;

    return manifest.devDependencies?.lefthook !== undefined || manifest.dependencies?.lefthook !== undefined;
  } catch {
    return false;
  }
}

/**
 * Runs one phase's command and describes the outcome.
 */
function runPhase(
  runner: ProcessRunner,
  command: { executable: string; args: string[] },
  root: string,
  target: StreamTarget,
): PhaseOutcome {
  const rendered = [command.executable, ...command.args].join(" ");
  const result = runner.stream(command.executable, command.args, root, target);

  if (result.error) {
    return { ok: false, message: `\`${rendered}\` couldn't start: ${result.error.message}` };
  }

  if (result.status !== 0) {
    return { ok: false, message: `\`${rendered}\` exited with code ${String(result.status)}.` };
  }

  return { ok: true, message: `Ran \`${rendered}\`.` };
}

/**
 * Installs the declared npm dependencies with lifecycle scripts disabled.
 */
export function installDependencies(runner: ProcessRunner, root: string, target: StreamTarget): PhaseOutcome {
  return runPhase(runner, npmInstall, root, target);
}

/**
 * Activates the Git hooks with the project's installed Lefthook.
 */
export function activateHooks(runner: ProcessRunner, root: string, target: StreamTarget): PhaseOutcome {
  return runPhase(runner, activateHooksCommand, root, target);
}
