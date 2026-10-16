import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import path from "node:path";

/**
 * Hash file content for generation ownership and optimistic concurrency checks.
 *
 * @param {string|null} content UTF-8 content, or null for a missing file.
 * @returns {string|null} SHA-256 digest, or null when the file is absent.
 */
export const hash = (content) => (content === null ? null : createHash("sha256").update(content).digest("hex"));

/**
 * Serialize a JSON value with two-space indentation and a trailing newline.
 *
 * @param {unknown} value JSON-serializable value.
 * @returns {string} Serialized text with a trailing newline.
 */
export const json = (value) => JSON.stringify(value, null, 2) + "\n";

/**
 * Normalize a project-relative path while rejecting traversal and protected directories.
 *
 * @param {string} value Relative path to validate.
 * @param {object} [options={}] Path validation controls.
 * @param {boolean} [options.allowRoot=false] Whether `.` is a permitted result.
 * @returns {string} Normalized POSIX relative path.
 * @throws {Error} If the path is absolute, escapes the boundary, or enters a protected directory.
 */
export function relativePath(value, { allowRoot = false } = {}) {
  if (typeof value !== "string" || path.isAbsolute(value) || value.includes("\\") || value.includes("\0")) {
    throw new Error(`Expected a project-relative path: ${value}`);
  }

  const normalized = path.posix.normalize(value);

  if (normalized === ".." || normalized.startsWith("../") || (!allowRoot && normalized === ".")) {
    throw new Error(`Path is outside the selected project or has no filename: ${value}`);
  }

  if (normalized.split("/").some((part) => [".git", "node_modules", "vendor"].includes(part))) {
    throw new Error(`Path enters a protected directory: ${value}`);
  }

  return normalized;
}

/**
 * Resolve a target within the project and reject symbolic-link traversal.
 *
 * @param {string} root Existing absolute project boundary.
 * @param {string} relative Project-relative target filename.
 * @returns {Promise<string>} Validated absolute target path.
 * @throws {Error} If the target escapes the project or traverses a symbolic link.
 */
export async function safePath(root, relative) {
  relativePath(relative);
  const target = path.resolve(root, relative);
  const boundary = await fs.realpath(root);
  const resolvedRoot = path.resolve(root);

  if (!target.startsWith(resolvedRoot + path.sep)) throw new Error(`Path escapes project: ${relative}`);

  let cursor = resolvedRoot;

  for (const segment of path.relative(resolvedRoot, target).split(path.sep)) {
    cursor = path.join(cursor, segment);

    try {
      const actual = await fs.realpath(cursor);

      if (actual !== boundary && !actual.startsWith(boundary + path.sep)) {
        throw new Error(`Path escapes project through a symbolic link: ${relative}`);
      }

      if ((await fs.lstat(cursor)).isSymbolicLink()) throw new Error(`Refusing symbolic link: ${relative}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      break;
    }
  }

  return target;
}

/**
 * Read a safe project file, distinguishing missing files from other filesystem failures.
 *
 * @param {string} root Existing absolute project boundary.
 * @param {string} relative Project-relative filename.
 * @returns {Promise<string|null>} UTF-8 content, or null for a missing file.
 */
export async function read(root, relative) {
  const target = await safePath(root, relative);

  try {
    return await fs.readFile(target, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

/**
 * Read a safe JSON object and use a fallback only when the file is absent.
 *
 * @param {string} root Existing absolute project boundary.
 * @param {string} relative Project-relative JSON filename.
 * @param {object|null} [fallback=null] Result for an absent file.
 * @returns {Promise<object|null>} Parsed JSON object or the supplied fallback.
 * @throws {Error} If existing content is invalid JSON or is not an object.
 */
export async function readJson(root, relative, fallback = null) {
  const content = await read(root, relative);

  if (content === null) return fallback;

  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected a JSON object");
    return parsed;
  } catch (error) {
    throw new Error(`Invalid JSON in ${relative}: ${error.message}`, { cause: error });
  }
}

/**
 * Atomically replace a safe file, or remove it when content is null.
 *
 * @param {string} root Existing absolute project boundary.
 * @param {string} relative Project-relative target filename.
 * @param {string|null} content Replacement UTF-8 content, or null to delete.
 * @returns {Promise<void>} Completes after the write or deletion and temporary-file cleanup.
 * @throws {Error} If path validation or a filesystem operation fails.
 */
export async function write(root, relative, content) {
  const target = await safePath(root, relative);

  if (content === null) {
    await fs.unlink(target);
    return;
  }

  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  let created = false;

  try {
    const handle = await fs.open(temporary, "wx");

    created = true;

    try {
      await handle.writeFile(content);
    } finally {
      await handle.close();
    }

    await safePath(root, relative);
    await fs.rename(temporary, target);
  } finally {
    if (created) await fs.rm(temporary, { force: true });
  }
}

/**
 * List visible child directories while excluding generated and dependency directories.
 *
 * @param {string} root Absolute directory to inspect.
 * @returns {Promise<string[]>} Sorted child directory names; symbolic links are omitted.
 */
export async function directories(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });

  return entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        !["node_modules", "vendor", "dist", "build", "__pycache__"].includes(entry.name),
    )
    .map((entry) => entry.name)
    .sort();
}
