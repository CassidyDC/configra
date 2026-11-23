/**
 * Focused edits to shared files. JSON edits change only managed fields and keep key order, indentation,
 * and line endings. Line edits add and remove only Configra's lines.
 */

import type { JsonObject, JsonValue } from "../contracts.js";

/**
 * Encodes a key path as a JSON Pointer such as `/devDependencies/@eslint~1js`.
 */
export function toPointer(path: readonly string[]): string {
  return `/${path.map((key) => key.replaceAll("~", "~0").replaceAll("/", "~1")).join("/")}`;
}

/**
 * Decodes a JSON Pointer back to a key path.
 */
export function fromPointer(pointer: string): string[] {
  return pointer
    .slice(1)
    .split("/")
    .map((key) => key.replaceAll("~1", "/").replaceAll("~0", "~"));
}

/**
 * Reads the value at a key path, or undefined when any segment is missing.
 */
export function getAt(object: JsonValue | undefined, path: readonly string[]): JsonValue | undefined {
  let current: JsonValue | undefined = object;

  for (const key of path) {
    if (current === null || typeof current !== "object" || Array.isArray(current) || !(key in current)) {
      return undefined;
    }

    current = current[key];
  }

  return current;
}

/** Maps whose keys npm keeps sorted, so new entries go in sorted position. */
const sortedMaps = new Set([
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "require",
  "require-dev",
]);

/**
 * Sets a value at a key path, creating parent objects as needed. Returns a new object.
 */
export function setAt(object: JsonObject, path: readonly string[], value: JsonValue): JsonObject {
  const [key, ...rest] = path as [string, ...string[]];

  if (rest.length === 0) {
    return { ...object, [key]: value };
  }

  const child = object[key];
  const childObject = child !== null && typeof child === "object" && !Array.isArray(child) ? child : {};
  const updated = setAt(childObject, rest, value);

  if (rest.length === 1 && sortedMaps.has(key) && !((rest[0] as string) in childObject)) {
    const sorted = Object.fromEntries(Object.entries(updated).sort(([a], [b]) => a.localeCompare(b)));
    const wasSorted = Object.keys(childObject).every(
      (name, index, keys) => index === 0 || (keys[index - 1] as string).localeCompare(name) <= 0,
    );

    return { ...object, [key]: wasSorted ? sorted : updated };
  }

  return { ...object, [key]: updated };
}

/**
 * Removes the value at a key path and drops parent objects the removal leaves empty. Returns a new object.
 */
export function deleteAt(object: JsonObject, path: readonly string[]): JsonObject {
  const [key, ...rest] = path as [string, ...string[]];

  if (!(key in object)) {
    return object;
  }

  if (rest.length === 0) {
    const copy = { ...object };

    delete copy[key];

    return copy;
  }

  const child = object[key];

  if (child === null || typeof child !== "object" || Array.isArray(child)) {
    return object;
  }

  const updated = deleteAt(child, rest);
  const copy = { ...object };

  if (Object.keys(updated).length === 0) {
    delete copy[key];
  } else {
    copy[key] = updated;
  }

  return copy;
}

/**
 * Detects the indentation of a JSON document, defaulting to two spaces.
 */
function detectIndent(text: string): string {
  const match = /^([ \t]+)"/m.exec(text);

  return match?.[1] ?? "  ";
}

/**
 * Serializes JSON with the original document's indentation, line endings, and final newline.
 */
export function serializeJson(value: JsonValue, original?: string, newIndent = "  "): string {
  const indent = original ? detectIndent(original) : newIndent;
  const eol = original?.includes("\r\n") ? "\r\n" : "\n";
  const text = JSON.stringify(value, null, indent);

  return `${eol === "\n" ? text : text.replaceAll("\n", eol)}${eol}`;
}

/**
 * Splits a line-based file into lines, ignoring the final newline.
 */
export function splitLines(text: string): string[] {
  const lines = text.split(/\r?\n/);

  if (lines.at(-1) === "") {
    lines.pop();
  }

  return lines;
}

/**
 * Adds and removes lines in a line-based file, appending new lines in one group at the end.
 */
export function editLines(original: string | undefined, add: readonly string[], remove: readonly string[]): string {
  const eol = original?.includes("\r\n") ? "\r\n" : "\n";
  const lines = splitLines(original ?? "").filter((line) => !remove.includes(line));
  const additions = add.filter((line) => !lines.includes(line));

  if (additions.length > 0 && lines.length > 0 && lines.at(-1)?.trim() !== "") {
    lines.push("");
  }

  lines.push(...additions);

  while (lines.length > 0 && lines.at(-1)?.trim() === "") {
    lines.pop();
  }

  return lines.length === 0 ? "" : `${lines.join(eol)}${eol}`;
}

/**
 * Compares two JSON values structurally.
 */
export function jsonEqual(a: JsonValue | undefined, b: JsonValue | undefined): boolean {
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
}

/**
 * Returns a copy of a JSON value with object keys sorted, for deterministic output and comparisons.
 */
export function sortKeys(value: JsonValue | undefined): JsonValue | undefined {
  if (Array.isArray(value)) {
    return value.map((item) => sortKeys(item) as JsonValue);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(value[key]) as JsonValue]),
    );
  }

  return value;
}
