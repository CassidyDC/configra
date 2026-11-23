import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, type Stats } from "node:fs";
import { isAbsolute, join, posix, relative, resolve, sep } from "node:path";

/**
 * What a snapshot saw at one project-relative path when it was first read.
 */
export interface SnapshotEntry {
  kind: "file" | "directory" | "symlink" | "missing";
  content?: string;
  mode?: number;
}

/**
 * Normalizes a user-supplied project-relative path to POSIX form, or returns undefined when it escapes
 * the project or is absolute.
 */
export function normalizeProjectPath(input: string): string | undefined {
  if (input.trim() === "" || isAbsolute(input) || /^[a-zA-Z]:/.test(input)) {
    return undefined;
  }

  const normalized = posix.normalize(input.replaceAll("\\", "/")).replace(/\/+$/, "");

  if (normalized === ".." || normalized.startsWith("../") || normalized === "") {
    return undefined;
  }

  return normalized === "." ? "." : normalized.replace(/^\.\//, "");
}

/**
 * Converts an absolute path inside the root to a POSIX project-relative path.
 */
export function toProjectPath(root: string, absolute: string): string {
  return relative(root, absolute).split(sep).join("/");
}

/**
 * Hashes text after normalizing line endings, so a CRLF checkout of generated text compares equal.
 */
export function textHash(text: string): string {
  return createHash("sha256").update(text.replaceAll("\r\n", "\n")).digest("hex");
}

/**
 * Reads the project without changing it. Every path's first observation is recorded so later phases can
 * confirm nothing changed between planning and applying.
 */
export class Snapshot {
  readonly root: string;
  readonly entries = new Map<string, SnapshotEntry>();

  constructor(root: string) {
    this.root = resolve(root);
  }

  /**
   * Returns what exists at a project-relative path, reading it on first use.
   */
  entry(path: string): SnapshotEntry {
    const cached = this.entries.get(path);

    if (cached) {
      return cached;
    }

    const entry = readEntry(join(this.root, path));

    this.entries.set(path, entry);

    return entry;
  }

  /**
   * Returns a file's text, or undefined when it isn't a regular file.
   */
  read(path: string): string | undefined {
    const entry = this.entry(path);

    return entry.kind === "file" ? entry.content : undefined;
  }

  exists(path: string): boolean {
    return this.entry(path).kind !== "missing";
  }

  isDirectory(path: string): boolean {
    return this.entry(path).kind === "directory";
  }
}

/**
 * Reads one path without following symlinks.
 */
function readEntry(absolute: string): SnapshotEntry {
  let stats: Stats;

  try {
    stats = lstatSync(absolute);
  } catch {
    return { kind: "missing" };
  }

  if (stats.isSymbolicLink()) {
    return { kind: "symlink" };
  }

  if (stats.isDirectory()) {
    return { kind: "directory" };
  }

  return { kind: "file", content: readFileSync(absolute, "utf8"), mode: stats.mode & 0o777 };
}

/**
 * Lists a directory's entries as names, or an empty list when it can't be read.
 */
export function listDirectory(absolute: string): Array<{ name: string; directory: boolean; symlink: boolean }> {
  try {
    return readdirSync(absolute, { withFileTypes: true })
      .map((dirent) => ({ name: dirent.name, directory: dirent.isDirectory(), symlink: dirent.isSymbolicLink() }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
