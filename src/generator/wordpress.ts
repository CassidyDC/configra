/**
 * WordPress plugin and theme headers, and the saved-selection defaults derived from them: the target PHP
 * version, the minimum WordPress version, and each selected directory's text domain and prefix.
 */

import { join } from "node:path";
import semver from "semver";
import type { Diagnostic, Selections, WordPressPackageSettings } from "../contracts.js";
import { listDirectory, type Snapshot } from "../platform/filesystem.js";
import { readJson } from "./discover.js";

/** The lowest PHP version WordPress core and the shipped PHP tools support. */
export const defaultPhpTargetVersion = "7.4";

/**
 * Header fields Configra reads from a plugin's main file or a theme's `style.css`.
 */
export interface PackageHeaders {
  requiresPhp?: string;
  requiresWordPress?: string;
  textDomain?: string;
}

const headerFields: Record<keyof PackageHeaders, string> = {
  requiresPhp: "Requires PHP",
  requiresWordPress: "Requires at least",
  textDomain: "Text Domain",
};

/**
 * Reads header fields from the start of a file, the way WordPress's `get_file_data` does.
 */
export function parseHeaders(text: string): PackageHeaders & { name?: string } {
  const head = text.slice(0, 8192).replaceAll("\r", "\n");

  const read = (field: string) => {
    const match = new RegExp(`^[ \\t/*#@]*${field}:(.*)$`, "mi").exec(head);
    const value = match?.[1]?.replace(/\s*(?:\*\/|\?>).*$/, "").trim();

    return value ? value : undefined;
  };

  const headers: PackageHeaders & { name?: string } = {};

  for (const [key, field] of Object.entries(headerFields) as Array<[keyof PackageHeaders, string]>) {
    const value = read(field);

    if (value !== undefined) {
      headers[key] = value;
    }
  }

  const name = read("Plugin Name") ?? read("Theme Name");

  if (name !== undefined) {
    headers.name = name;
  }

  return headers;
}

/**
 * Reads a selected plugin, theme, or single-file must-use plugin's headers without executing anything.
 */
export function readPackageHeaders(snapshot: Snapshot, path: string): PackageHeaders {
  if (path.endsWith(".php")) {
    return parseHeaders(snapshot.read(path) ?? "");
  }

  const style = snapshot.read(`${path}/style.css`);

  if (style !== undefined && parseHeaders(style).name !== undefined) {
    return parseHeaders(style);
  }

  for (const entry of listDirectory(join(snapshot.root, path))) {
    if (entry.directory || entry.symlink || !entry.name.endsWith(".php")) {
      continue;
    }

    const headers = parseHeaders(snapshot.read(`${path}/${entry.name}`) ?? "");

    if (headers.name !== undefined) {
      return headers;
    }
  }

  return {};
}

/**
 * Normalizes a version such as `8.1`, `7.4.0`, or `>=8.0` to `major.minor`.
 */
function majorMinor(value: string): string | undefined {
  const range = semver.validRange(value.trim()) ?? undefined;
  const version = (range ? semver.minVersion(range) : null) ?? semver.coerce(value);

  return version ? `${version.major}.${version.minor}` : undefined;
}

/**
 * Returns the lowest of the given `major.minor` versions.
 */
function lowest(versions: string[]): string | undefined {
  return [...versions].sort((a, b) => semver.compare(semver.coerce(a) ?? "0.0.0", semver.coerce(b) ?? "0.0.0"))[0];
}

/**
 * Suggests a function prefix from a directory or file name, such as `my_plugin` for `my-plugin`.
 */
export function suggestPrefix(path: string): string {
  const name = (path.split("/").at(-1) ?? path).replace(/\.php$/, "");

  const prefix = name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "");

  return /^[a-z]/.test(prefix) ? prefix : `p_${prefix}`;
}

/**
 * Suggests a text domain from a directory or file name, as WordPress does when the header omits it.
 */
export function suggestTextDomain(path: string): string {
  return (path.split("/").at(-1) ?? path).replace(/\.php$/, "");
}

/**
 * Fills the WordPress and PHP settings a WordPress site's saved selections leave unset, from the
 * selected directories' headers, and keeps only the selected directories' settings. Saved values win,
 * so a differently named checkout reproduces them.
 */
export function withWordPressDefaults(
  selections: Selections,
  snapshot: Snapshot,
): { selections: Selections; diagnostics: Diagnostic[] } {
  if (selections.project !== "wordpress-site") {
    return { selections, diagnostics: [] };
  }

  const diagnostics: Diagnostic[] = [];
  const headers = new Map(selections.packages.map((path) => [path, readPackageHeaders(snapshot, path)]));
  const php = { ...selections.php };
  const wordpress = { ...selections.wordpress, packages: {} as Record<string, WordPressPackageSettings> };

  const declared = (key: "requiresPhp" | "requiresWordPress") =>
    [...headers.values()]
      .map((header) => (header[key] ? majorMinor(header[key]) : undefined))
      .filter((version): version is string => version !== undefined);

  if (selections.languages.includes("php") && php.targetVersion === undefined) {
    const versions = declared("requiresPhp");
    const composer = readJson(snapshot, "composer.json")?.require as Record<string, unknown> | undefined;
    const composerVersion = typeof composer?.php === "string" ? majorMinor(composer.php) : undefined;

    php.targetVersion = lowest(versions) ?? composerVersion ?? defaultPhpTargetVersion;

    if (new Set(versions).size > 1) {
      diagnostics.push({
        code: "SELECTION_PHP_VERSIONS_DIFFER",
        severity: "warning",
        message: `The selected directories require different PHP versions (${[...new Set(versions)].join(", ")}). Configra checks against the lowest, ${php.targetVersion}. Change php.targetVersion in .configra/config.json to override it.`,
      });
    }
  }

  if (wordpress.minimumVersion === undefined) {
    const versions = declared("requiresWordPress");
    const minimum = lowest(versions);

    if (minimum !== undefined) {
      wordpress.minimumVersion = minimum;
    }

    if (new Set(versions).size > 1) {
      diagnostics.push({
        code: "SELECTION_WORDPRESS_VERSIONS_DIFFER",
        severity: "warning",
        message: `The selected directories require different WordPress versions (${[...new Set(versions)].join(", ")}). Configra checks against the lowest, ${minimum}.`,
      });
    }
  }

  const usesWordPressStandard = selections.languages.includes("php") && selections.standards.php === "wordpress";

  for (const path of selections.packages) {
    const saved = selections.wordpress.packages[path] ?? {};

    wordpress.packages[path] = usesWordPressStandard
      ? {
          textDomain: saved.textDomain ?? headers.get(path)?.textDomain ?? suggestTextDomain(path),
          prefix: saved.prefix ?? suggestPrefix(path),
        }
      : saved;

    if (Object.keys(wordpress.packages[path]).length === 0) {
      delete wordpress.packages[path];
    }
  }

  return { selections: { ...selections, php, wordpress }, diagnostics };
}
