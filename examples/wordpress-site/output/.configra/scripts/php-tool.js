#!/usr/bin/env node
// Managed by Configra.
//
// Runs a Composer-installed PHP tool the same way on every platform. Used by package scripts and Git hooks:
//   node .configra/scripts/php-tool.js <phpcs|phpcbf|phpstan> [args...]
// Composer's bin proxies are PHP scripts, so this runs them with `php` instead of a shell. Uses only
// Node.js built-ins, so it runs without Configra.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Returns Composer's bin directory, honoring `config.bin-dir` and `config.vendor-dir`.
 */
export function binDirectory(root = process.cwd()) {
  let config = {};

  try {
    config = JSON.parse(readFileSync(join(root, "composer.json"), "utf8")).config ?? {};
  } catch {
    // Composer's defaults apply without a readable composer.json.
  }

  return config["bin-dir"] ?? join(config["vendor-dir"] ?? "vendor", "bin");
}

/**
 * Maps a tool's exit code to the check's result. PHP_CodeSniffer 3's phpcbf exits with 1 after fixing
 * every fixable problem, and PHPStan exits with 1 when the configured paths contain no PHP files.
 */
export function exitCode(tool, status, output) {
  if (tool === "phpcbf" && status === 1) {
    return 0;
  }

  if (tool === "phpstan" && status === 1 && output.includes("No files found to analyse")) {
    return 0;
  }

  return status ?? 1;
}

/**
 * Runs the tool and returns the exit code.
 */
export function runTool(tool, args) {
  const binary = join(binDirectory(), tool);

  if (!existsSync(binary)) {
    process.stderr.write(`${tool} isn't installed. Run \`composer install\` to install the PHP tools.\n`);

    return 1;
  }

  // PHPStan's output is captured so an empty set of files can be recognized; the others stream.
  const capture = tool === "phpstan";

  const result = spawnSync("php", [binary, ...args], {
    encoding: "utf8",
    stdio: capture ? ["inherit", "pipe", "pipe"] : "inherit",
  });

  if (result.error) {
    process.stderr.write(`PHP couldn't start: ${result.error.message}\n`);

    return 1;
  }

  const output = capture ? `${result.stdout}${result.stderr}` : "";

  if (capture) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
  }

  return exitCode(tool, result.status, output);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [tool, ...args] = process.argv.slice(2);

  process.exitCode = tool ? runTool(tool, args) : 1;
}
