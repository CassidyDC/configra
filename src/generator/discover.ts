import { join } from "node:path";
import semver from "semver";
import type { DiscoveryReport, LanguageId, Prerequisite, Selections, UiId } from "../contracts.js";
import { listDirectory, type Snapshot } from "../platform/filesystem.js";
import { isGitBoundary } from "../platform/git.js";
import { probeVersion, type ProcessRunner } from "../platform/process.js";

/** Directories the scanner never enters. Recursive checks treat them as out of scope too. */
export const skippedDirectories = new Set([
  ".git",
  ".cache",
  ".configra",
  "node_modules",
  "vendor",
  "bower_components",
  "build",
  "dist",
  "coverage",
  "wp-admin",
  "wp-includes",
  "uploads",
]);

const maxDepth = 6;
const maxEntries = 20_000;

const languageByExtension: Record<string, LanguageId> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "typescript",
  css: "css",
  php: "php",
};

export const minimums = {
  node: "24.15.0",
  npm: "11.0.0",
  php: "7.4.0",
  composer: "2.7.0",
  git: "2.0.0",
} as const;

/**
 * Walks the project within fixed bounds and collects the file extensions it finds.
 */
function scanExtensions(root: string): Set<string> {
  const found = new Set<string>();
  const queue: Array<{ path: string; depth: number }> = [{ path: root, depth: 0 }];
  let seen = 0;

  while (queue.length > 0 && seen < maxEntries) {
    const current = queue.shift() as { path: string; depth: number };

    for (const entry of listDirectory(current.path)) {
      seen += 1;

      if (entry.symlink) {
        continue;
      }

      const absolute = join(current.path, entry.name);

      if (entry.directory) {
        if (current.depth < maxDepth && !skippedDirectories.has(entry.name) && !isGitBoundary(absolute)) {
          queue.push({ path: absolute, depth: current.depth + 1 });
        }

        continue;
      }

      if (entry.name.endsWith(".d.ts") || /\.min\.(js|css)$/.test(entry.name)) {
        continue;
      }

      const extension = entry.name.includes(".") ? entry.name.slice(entry.name.lastIndexOf(".") + 1) : "";

      found.add(extension);
    }
  }

  return found;
}

/**
 * Detects whether the target is a full WordPress checkout, a `wp-content` project, or neither, and lists
 * plugin and theme directories it could check. Suggestions never select anything on their own.
 */
function detectWordPress(snapshot: Snapshot): DiscoveryReport["wordpress"] {
  const hasCore = snapshot.isDirectory("wp-includes") || snapshot.exists("wp-config.php");
  const hasContentRoot = snapshot.isDirectory("plugins") || snapshot.isDirectory("themes");

  const kind: DiscoveryReport["wordpress"]["kind"] =
    hasCore && hasContentRoot ? "ambiguous" : hasCore ? "site" : hasContentRoot ? "wp-content" : "none";

  if (kind === "none") {
    return { kind, candidates: [] };
  }

  const base = kind === "wp-content" ? "" : "wp-content/";
  const candidates: string[] = [];

  for (const parent of ["plugins", "mu-plugins", "themes"]) {
    const directory = `${base}${parent}`;

    for (const entry of listDirectory(join(snapshot.root, directory))) {
      const path = `${directory}/${entry.name}`;

      if (entry.symlink || entry.name.startsWith(".")) {
        continue;
      }

      if (entry.directory && !isGitBoundary(join(snapshot.root, path))) {
        candidates.push(path);
      } else if (!entry.directory && parent === "mu-plugins" && entry.name.endsWith(".php")) {
        candidates.push(path);
      }
    }
  }

  return { kind, candidates };
}

/**
 * Detects the JavaScript package managers whose lockfiles or `packageManager` field the project uses.
 */
function detectPackageManagers(snapshot: Snapshot): string[] {
  const managers = new Set<string>();

  const lockfiles: Array<[string, string]> = [
    ["package-lock.json", "npm"],
    ["npm-shrinkwrap.json", "npm"],
    ["yarn.lock", "yarn"],
    ["pnpm-lock.yaml", "pnpm"],
    ["bun.lock", "bun"],
    ["bun.lockb", "bun"],
  ];

  for (const [file, manager] of lockfiles) {
    if (snapshot.exists(file)) {
      managers.add(manager);
    }
  }

  const manifest = readJson(snapshot, "package.json");
  const declared = typeof manifest?.packageManager === "string" ? manifest.packageManager.split("@")[0] : undefined;

  if (declared) {
    managers.add(declared);
  }

  return [...managers].sort();
}

/**
 * Parses a JSON file from the snapshot, or returns undefined when it's missing or invalid.
 */
export function readJson(snapshot: Snapshot, path: string): Record<string, unknown> | undefined {
  const text = snapshot.read(path);

  if (text === undefined) {
    return undefined;
  }

  try {
    const value = JSON.parse(text) as unknown;

    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Builds the advisory discovery report. It never executes project configuration or scripts.
 */
export function discover(snapshot: Snapshot): Omit<DiscoveryReport, "prerequisites"> {
  const extensions = scanExtensions(snapshot.root);
  const languages = [
    ...new Set([...extensions].map((extension) => languageByExtension[extension]).filter(Boolean)),
  ] as LanguageId[];
  const manifest = readJson(snapshot, "package.json");

  const dependencies = {
    ...(manifest?.dependencies as Record<string, unknown> | undefined),
    ...(manifest?.devDependencies as Record<string, unknown> | undefined),
    ...(manifest?.peerDependencies as Record<string, unknown> | undefined),
  };

  const ui: UiId[] = "react" in dependencies || extensions.has("jsx") || extensions.has("tsx") ? ["react"] : [];
  const order: LanguageId[] = ["javascript", "typescript", "css", "php"];

  return {
    wordpress: detectWordPress(snapshot),
    languages: order.filter((language) => languages.includes(language)),
    ui,
    packageManagers: detectPackageManagers(snapshot),
  };
}

/**
 * Checks the executables the generated checks and requested phases need.
 */
export function checkPrerequisites(
  selections: Selections,
  runner: ProcessRunner,
  cwd: string,
  nodeVersion: string = process.versions.node,
): Prerequisite[] {
  const usesComposer = selections.tools.some((tool) => tool === "phpcs" || tool === "phpstan");
  const usesPhp = usesComposer || selections.tools.includes("php-lint");

  const entries: Array<{ name: Prerequisite["name"]; minimum: string; found: string | null; neededFor: string[] }> = [
    { name: "node", minimum: minimums.node, found: nodeVersion, neededFor: ["generated checks", "Configra"] },
    {
      name: "npm",
      minimum: minimums.npm,
      found: probeVersion(runner, "npm", ["--version"], cwd),
      neededFor: ["dependency installation", "generated checks"],
    },
    {
      name: "git",
      minimum: minimums.git,
      found: probeVersion(runner, "git", ["--version"], cwd),
      neededFor: ["Git hooks"],
    },
  ];

  if (usesPhp) {
    entries.push({
      name: "php",
      minimum: minimums.php,
      found: probeVersion(runner, "php", ["-r", "echo PHP_VERSION;"], cwd),
      neededFor: ["PHP checks"],
    });
  }

  if (usesComposer) {
    entries.push({
      name: "composer",
      minimum: minimums.composer,
      found: probeVersion(runner, "composer", ["--version", "--no-ansi"], cwd),
      neededFor: ["PHP tool installation"],
    });
  }

  return entries.map((entry) => {
    const coerced = entry.found ? semver.coerce(entry.found) : null;

    return {
      name: entry.name,
      required: `>=${entry.minimum}`,
      found: entry.found,
      status: entry.found === null ? "missing" : coerced && semver.gte(coerced, entry.minimum) ? "ok" : "unsupported",
      neededFor: entry.neededFor,
    };
  });
}
