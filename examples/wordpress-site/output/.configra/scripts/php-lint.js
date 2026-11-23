#!/usr/bin/env node
// Managed by Configra. Change the checked paths and exclusions in .configra/config.json.
//
// Checks PHP syntax with the native linter. Used by the `lint:php-syntax` script and the `pre-commit` hook:
//   node .configra/scripts/php-lint.js [paths...]
// Without paths, it checks the selected paths below. Uses only Node.js built-ins, so it runs without Configra.

import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// configra:settings
const settings = { paths: ["wp-content/plugins/example","wp-content/themes/example"], excluded: ["node_modules/","vendor/","build/","dist/",".configra/",".cache/","*.min.js","*.min.css"] };
// configra:end

/** Command-line length to stay under. Windows limits a command line to 32,767 characters. */
export const MAX_COMMAND_LENGTH = process.platform === "win32" ? 30_000 : 100_000;

/** PHP 8.3 is the first release whose `php -l` checks every file it's given. */
export const MULTI_FILE_VERSION_ID = 80_300;

/**
 * Returns whether a project-relative path matches an exclusion in `.gitignore` syntax.
 */
export function isExcluded(path, excluded) {
  const segments = path.split("/");

  return excluded.some((entry) => {
    if (entry.endsWith("/")) {
      const directory = entry.slice(0, -1);

      return directory.includes("/")
        ? `${path}/`.startsWith(`${directory}/`)
        : segments.slice(0, -1).includes(directory);
    }

    const pattern = new RegExp(`^${entry.replaceAll(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[^/]*")}$`);

    return pattern.test(segments.at(-1) ?? "");
  });
}

/**
 * Lists the PHP files under the given files and directories, skipping excluded paths.
 */
export function collectFiles(paths, excluded, root = process.cwd()) {
  const files = [];

  const visit = (absolute) => {
    const path = relative(root, absolute).split(sep).join("/") || ".";
    let stats;

    try {
      stats = statSync(absolute);
    } catch {
      return;
    }

    if (path !== "." && isExcluded(stats.isDirectory() ? `${path}/x` : path, excluded)) {
      return;
    }

    if (stats.isDirectory()) {
      for (const name of readdirSync(absolute).sort()) {
        visit(join(absolute, name));
      }
    } else if (path.endsWith(".php")) {
      files.push(path);
    }
  };

  for (const path of paths) {
    visit(join(root, path));
  }

  return [...new Set(files)];
}

/**
 * Splits files into batches whose command lines stay under the limit.
 */
export function batches(files, baseLength, limit = MAX_COMMAND_LENGTH) {
  const result = [];
  let current = [];
  let length = baseLength;

  for (const file of files) {
    if (current.length > 0 && length + file.length + 3 > limit) {
      result.push(current);
      current = [];
      length = baseLength;
    }

    current.push(file);
    length += file.length + 3;
  }

  if (current.length > 0) {
    result.push(current);
  }

  return result;
}

/**
 * Returns the PHP version ID that runs the checks, such as 80300, or undefined when PHP is missing.
 */
function phpVersionId() {
  const result = spawnSync("php", ["-r", "echo PHP_VERSION_ID;"], { encoding: "utf8" });

  return result.status === 0 ? Number(result.stdout.trim()) : undefined;
}

/**
 * Lints the files and returns the exit code.
 */
export function lint(files) {
  if (files.length === 0) {
    return 0;
  }

  const versionId = phpVersionId();

  if (versionId === undefined) {
    process.stderr.write("PHP isn't installed or isn't on PATH, so PHP syntax can't be checked.\n");

    return 1;
  }

  // Display errors on stderr and don't also log them there, so each parse error prints once.
  const base = ["-d", "display_errors=stderr", "-d", "log_errors=0", "-l"];
  const groups = versionId >= MULTI_FILE_VERSION_ID ? batches(files, base.join(" ").length + 4) : files.map((f) => [f]);
  let failed = false;

  for (const group of groups) {
    const result = spawnSync("php", [...base, ...group], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
    const output = result.stdout
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "" && !line.startsWith("No syntax errors detected"));

    if (output.length > 0) {
      process.stdout.write(`${output.join("\n")}\n`);
    }

    if (result.status !== 0) {
      failed = true;
    }
  }

  return failed ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);

  process.exitCode = lint(collectFiles(args.length > 0 ? args : settings.paths, settings.excluded));
}
