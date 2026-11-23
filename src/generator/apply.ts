/**
 * Applies an approved plan: takes the per-project lock, rechecks the snapshot, records the pending-run
 * marker, writes each file through a temporary file beside it, writes ownership state last, and then
 * removes the marker.
 */

import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
  type Stats,
} from "node:fs";
import { hostname } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import type { Diagnostic } from "../contracts.js";
import { normalizeProjectPath, type Snapshot } from "../platform/filesystem.js";
import { findGitRoot } from "../platform/git.js";
import type { ProcessRunner } from "../platform/process.js";
import { configPath, statePath, type FileWrite } from "./plan.js";

/**
 * Where the lock and the pending-run marker live for one project.
 */
export interface RunFiles {
  directory: string;
  lock: string;
  marker: string;

  /** Project-relative directories the run files create inside the project, when there is no Git directory. */
  projectDirectories: string[];
}

/**
 * The pending-run marker written before the first change.
 */
export interface PendingRun {
  version: 1;
  paths: string[];
}

/**
 * Test hooks that run at each write boundary. A throwing hook stands in for a failed write.
 */
export interface ApplyHooks {
  beforeWrite?: (path: string) => void;
  afterPlanCheck?: () => void;
}

export interface ApplyResult {
  ok: boolean;
  written: string[];
  diagnostics: Diagnostic[];
}

const tmpDirectory = ".configra/tmp";

/**
 * Resolves the lock and marker locations: under `configra/` in the Git directory, or in `.configra/tmp/`
 * when the project isn't in a Git repository.
 */
export function runFiles(root: string, runner: ProcessRunner): RunFiles {
  const gitRoot = findGitRoot(root);

  if (gitRoot !== undefined) {
    const result = runner.run("git", ["rev-parse", "--git-path", "configra"], root);
    const output = result.stdout.trim();

    if (!result.error && result.status === 0 && output !== "") {
      const gitPath = resolve(root, output);
      // One Git directory can hold several projects, so key the files by the project's path in the repository.
      const key = createHash("sha256")
        .update(relative(gitRoot, root).split(sep).join("/") || ".")
        .digest("hex")
        .slice(0, 12);

      return {
        directory: gitPath,
        lock: join(gitPath, `${key}.lock`),
        marker: join(gitPath, `${key}.pending.json`),
        projectDirectories: [],
      };
    }
  }

  const directory = join(root, tmpDirectory);

  return {
    directory,
    lock: join(directory, "run.lock"),
    marker: join(directory, "pending.json"),
    projectDirectories: [".configra", tmpDirectory],
  };
}

/**
 * Reads a leftover pending-run marker, returning its paths, or undefined when no run is pending.
 */
export function readPendingRun(files: RunFiles): string[] | undefined {
  let text: string;

  try {
    text = readFileSync(files.marker, "utf8");
  } catch {
    return undefined;
  }

  try {
    const parsed = JSON.parse(text) as Partial<PendingRun>;

    return Array.isArray(parsed.paths) ? parsed.paths.filter((path) => typeof path === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Returns whether a process with the given ID is running on this machine.
 */
function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Takes the per-project lock, replacing a lock left by a process on this machine that no longer runs.
 */
function acquireLock(files: RunFiles): Diagnostic | undefined {
  mkdirSync(files.directory, { recursive: true });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(files.lock, "wx");

      writeFileSync(fd, `${JSON.stringify({ pid: process.pid, host: hostname() })}\n`);
      closeSync(fd);

      return undefined;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }

    let holder: { pid?: number; host?: string } = {};

    try {
      holder = JSON.parse(readFileSync(files.lock, "utf8")) as typeof holder;
    } catch {
      // An unreadable lock is treated as held.
    }

    const stale = holder.host === hostname() && typeof holder.pid === "number" && !processAlive(holder.pid);

    if (!stale) {
      break;
    }

    rmSync(files.lock, { force: true });
  }

  return {
    code: "APPLY_LOCKED",
    severity: "error",
    message: `Another Configra run holds the lock for this project. Wait for it to finish, or delete ${files.lock} if no run is active.`,
  };
}

/**
 * Describes an lstat result the way the snapshot records it.
 */
function kindOf(stats: Stats | undefined): "file" | "directory" | "symlink" | "missing" {
  if (!stats) {
    return "missing";
  }

  return stats.isSymbolicLink() ? "symlink" : stats.isDirectory() ? "directory" : "file";
}

/**
 * Reads lstat without throwing.
 */
function tryLstat(path: string): Stats | undefined {
  try {
    return lstatSync(path);
  } catch {
    return undefined;
  }
}

/**
 * Lists snapshot paths that changed after planning.
 */
function changedSincePlanning(snapshot: Snapshot, ignored: ReadonlySet<string>): string[] {
  const changed: string[] = [];

  for (const [path, entry] of snapshot.entries) {
    if (ignored.has(path)) {
      continue;
    }

    const absolute = join(snapshot.root, path);
    const stats = tryLstat(absolute);
    const kind = kindOf(stats);

    if (kind !== entry.kind) {
      changed.push(path);

      continue;
    }

    if (kind === "file" && (readFileSync(absolute, "utf8") !== entry.content || (stats!.mode & 0o777) !== entry.mode)) {
      changed.push(path);
    }
  }

  return changed.sort();
}

/**
 * Checks a target path immediately before it's written or deleted: it must stay inside the project, every
 * parent must be a real directory in the same Git repository, and the target can't be a directory or symlink.
 */
function unsafePath(root: string, path: string): string | undefined {
  if (normalizeProjectPath(path) !== path || path === ".") {
    return `${path} isn't a project-relative file path.`;
  }

  const parts = path.split("/");
  let current = root;

  for (const [index, part] of parts.entries()) {
    current = join(current, part);

    const stats = tryLstat(current);
    const last = index === parts.length - 1;

    if (!stats) {
      return undefined;
    }

    if (stats.isSymbolicLink()) {
      return `${parts.slice(0, index + 1).join("/")} is a symbolic link, so Configra won't write through it.`;
    }

    if (!last && !stats.isDirectory()) {
      return `${parts.slice(0, index + 1).join("/")} isn't a directory.`;
    }

    if (!last && tryLstat(join(current, ".git"))) {
      return `${parts.slice(0, index + 1).join("/")} is its own Git repository, so it's outside this project.`;
    }

    if (last && stats.isDirectory()) {
      return `${path} is a directory.`;
    }
  }

  return undefined;
}

/**
 * Returns an existing file's permission bits, so a replacement keeps them.
 */
function existingMode(target: string): number | undefined {
  const stats = tryLstat(target);

  return stats?.isFile() ? stats.mode & 0o777 : undefined;
}

/**
 * Writes one file through a temporary file beside it and renames it into place.
 */
function writeAtomically(target: string, content: string, mode: number | undefined): void {
  mkdirSync(dirname(target), { recursive: true });

  const temporary = join(dirname(target), `.${basename(target)}.${randomBytes(6).toString("hex")}.configra-tmp`);

  try {
    writeFileSync(temporary, content, { flag: "wx", ...(mode !== undefined ? { mode } : {}) });

    if (mode !== undefined) {
      chmodSync(temporary, mode);
    }

    renameSync(temporary, target);
  } catch (error) {
    rmSync(temporary, { force: true });

    throw error;
  }
}

/**
 * Orders writes so the saved selections come second to last and ownership state comes last.
 */
export function orderWrites(writes: readonly FileWrite[]): FileWrite[] {
  const rank = (path: string) => (path === statePath ? 2 : path === configPath ? 1 : 0);

  return [...writes].sort((a, b) => rank(a.path) - rank(b.path) || a.path.localeCompare(b.path));
}

/**
 * Applies the plan's writes. Files written before a failure stay in place, and the marker stays behind so
 * the next run can adopt them.
 */
export function applyWrites(
  snapshot: Snapshot,
  writes: readonly FileWrite[],
  files: RunFiles,
  hooks: ApplyHooks = {},
): ApplyResult {
  const root = resolve(snapshot.root);
  const written: string[] = [];
  const lockError = acquireLock(files);

  if (lockError) {
    return { ok: false, written, diagnostics: [lockError] };
  }

  try {
    hooks.afterPlanCheck?.();

    const changed = changedSincePlanning(snapshot, new Set(files.projectDirectories));

    if (changed.length > 0) {
      return {
        ok: false,
        written,
        diagnostics: [
          {
            code: "APPLY_PROJECT_CHANGED",
            severity: "error",
            path: changed[0] as string,
            message: `The project changed after Configra planned this run (${changed.join(", ")}). Run the command again to plan against the current files.`,
          },
        ],
      };
    }

    const ordered = orderWrites(writes);

    if (ordered.length > 0) {
      const marker: PendingRun = { version: 1, paths: ordered.map((write) => write.path) };

      writeAtomically(files.marker, `${JSON.stringify(marker, null, 2)}\n`, undefined);
    }

    for (const write of ordered) {
      const problem = unsafePath(root, write.path);

      if (problem) {
        return {
          ok: false,
          written,
          diagnostics: [{ code: "APPLY_UNSAFE_PATH", severity: "error", path: write.path, message: problem }],
        };
      }

      hooks.beforeWrite?.(write.path);

      const target = join(root, write.path);

      if (write.content === null) {
        rmSync(target, { force: true });
      } else {
        writeAtomically(target, write.content, write.mode ?? existingMode(target));
      }

      written.push(write.path);
    }

    rmSync(files.marker, { force: true });

    return { ok: true, written, diagnostics: [] };
  } catch (error) {
    return {
      ok: false,
      written,
      diagnostics: [
        {
          code: "APPLY_WRITE_FAILED",
          severity: "error",
          message: `Writing files failed: ${(error as Error).message}`,
        },
      ],
    };
  } finally {
    rmSync(files.lock, { force: true });

    // Leave no empty run directory behind inside the project.
    for (const directory of files.projectDirectories.slice(1)) {
      try {
        rmdirSync(join(root, directory));
      } catch {
        // The directory still holds a marker or other files.
      }
    }
  }
}
