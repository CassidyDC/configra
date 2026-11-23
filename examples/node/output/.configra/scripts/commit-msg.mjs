#!/usr/bin/env node
// Managed by Configra. Change the commit-message mode in .configra/config.json.
//
// Checks a commit message subject. Used by the `commit-msg` Git hook with:
//   node .configra/scripts/commit-msg.mjs --mode <plain|conventional> <message-file>
// Uses only Node.js built-ins, so it runs without Configra installed.

import { readFileSync } from "node:fs";

const MAX_LENGTH = 72;
const CUT_LINE = /^# -+ >8 -+$/;
const SKIPPED = /^(Merge |Revert "|Revert |fixup! |squash! |amend! )/;
const TYPE_PREFIX = /^[\w-]+(\([^)]*\))?!?:\s/;
const CONVENTIONAL = /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([\w./-]+\))?!?: \S/;

/**
 * Returns the first non-comment line of the message, ignoring the verbose-commit diff.
 */
export function readSubject(message) {
  for (const line of message.split(/\r?\n/)) {
    if (CUT_LINE.test(line)) {
      break;
    }

    if (line.startsWith("#") || line.trim() === "") {
      continue;
    }

    return line.trim();
  }

  return "";
}

/**
 * Returns the problems with a subject in the given mode, or an empty list when it passes.
 */
export function checkSubject(subject, mode) {
  if (subject === "" || SKIPPED.test(subject)) {
    return [];
  }

  const problems = [];

  if (subject.length > MAX_LENGTH) {
    problems.push(`Keep the subject within ${MAX_LENGTH} characters (it has ${subject.length}).`);
  }

  if (/[^.]\.$/.test(subject) || subject === ".") {
    problems.push("Remove the trailing period from the subject.");
  }

  if (mode === "plain") {
    if (TYPE_PREFIX.test(subject)) {
      problems.push("Write a plain subject without a type prefix such as `feat:`.");
    } else if (!/^\p{Lu}/u.test(subject)) {
      problems.push("Start the subject with a capital letter.");
    }
  }

  if (mode === "conventional" && !CONVENTIONAL.test(subject)) {
    problems.push("Write the subject as `type(scope)!: description`, such as `feat(cli): add the init command`.");
  }

  return problems;
}

/**
 * Parses `--mode <mode> <file>` and returns the exit code.
 */
export function main(argv) {
  const modeIndex = argv.indexOf("--mode");
  const mode = modeIndex === -1 ? "plain" : argv[modeIndex + 1];
  const file = argv.find((arg, index) => index !== modeIndex && index !== modeIndex + 1);

  if (!file || (mode !== "plain" && mode !== "conventional")) {
    console.error("Usage: commit-msg.mjs --mode <plain|conventional> <message-file>");

    return 1;
  }

  const subject = readSubject(readFileSync(file, "utf8"));
  const problems = checkSubject(subject, mode);

  if (problems.length > 0) {
    console.error(`Commit message check failed (${mode} mode):\n  ${subject}\n`);
    console.error(problems.map((problem) => `- ${problem}`).join("\n"));

    return 1;
  }

  return 0;
}

if (import.meta.main) {
  process.exitCode = main(process.argv.slice(2));
}
