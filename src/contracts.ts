/**
 * Internal request, tool contribution, and plan types shared across the CLI, generator, and components.
 */

export type PresetId = "node" | "wordpress-site";

export type LanguageId = "javascript" | "typescript" | "css" | "php";

export type UiId = "react";

export type StandardId = "community" | "wordpress";

export type ToolId =
  | "editorconfig"
  | "gitignore"
  | "prettier"
  | "markdownlint"
  | "eslint"
  | "stylelint"
  | "php-lint"
  | "phpcs"
  | "phpstan"
  | "lefthook";

export type CommitMessageMode = "plain" | "conventional" | "off";

export type CommandName = "init" | "update";

export type ConflictAction = "retain" | "replace";

export type ModuleType = "module" | "commonjs";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type Severity = "error" | "warning" | "info";

/**
 * A stable, machine-readable message about the request, the project, or the plan.
 */
export interface Diagnostic {
  code: string;
  severity: Severity;
  message: string;
  path?: string;
}

/**
 * Formatting settings shared by EditorConfig and Prettier.
 */
export interface FormatSettings {
  indentStyle: "space" | "tab";
  indentSize: number;
  lineWidth: number;
  endOfLine: "lf" | "crlf";
  quoteStyle: "double" | "single";
  semicolons: boolean;
  trailingCommas: "all" | "es5" | "none";
  bracketSpacing: boolean;
}

/**
 * Per-package WordPress settings recorded in saved selections.
 */
export interface WordPressPackageSettings {
  textDomain?: string;
  prefix?: string;
}

/**
 * The fully normalized selections that drive a plan. Saved configs, flags, and preset defaults all
 * resolve to this shape.
 */
export interface Selections {
  project: PresetId;
  packages: string[];
  languages: LanguageId[];
  ui: UiId[];
  standards: Partial<Record<LanguageId, StandardId>>;
  tools: ToolId[];
  commitMessages: CommitMessageMode;
  exclusions: { add: string[]; remove: string[] };
  formatting: Partial<FormatSettings>;
  php: { targetVersion?: string; phpstanLevel?: number; scanDirectories: { remove: string[] } };
  wordpress: { minimumVersion?: string; packages: Record<string, WordPressPackageSettings> };
  decisions: Record<string, "retain">;
}

/**
 * A file Configra generates. `file` content is Configra-owned and rewritten; `entry` content is created
 * once and then belongs to the project.
 */
export interface FileContribution {
  tool: ToolId;
  path: string;
  ownership: "file" | "entry";
  content: string;
  reason: string;
  executable?: boolean;

  /** For entry files, the import or include text that must stay in the file. */
  reference?: string;
}

/**
 * Lines Configra adds to a shared line-based file such as `.gitignore`.
 */
export interface LinesContribution {
  tool: ToolId;
  path: ".gitignore" | ".prettierignore";
  lines: string[];
  reason: string;
}

/**
 * A field Configra sets in a shared manifest, addressed by its key path.
 */
export interface ManifestFieldContribution {
  tool: ToolId | "configra";
  manifest: "package.json" | "composer.json";
  path: string[];
  value: JsonValue;
  reason: string;

  /**
   * A `setting` fills an unset field without owning it. A `permission`, such as a Composer plugin
   * allowlist entry, is owned like a dependency but never overrides an existing denial.
   */
  kind: "dependency" | "script" | "setting" | "permission";
}

/**
 * A configuration location that would shadow or compete with the configuration Configra generates.
 */
export interface CompetingConfig {
  tool: ToolId;
  path: string;

  /** A manifest field such as `["prettier"]` in `package.json`. */
  field?: string[];
}

/**
 * A command expressed as an executable and arguments, independent of any shell.
 */
export interface CommandSpec {
  executable: string;
  args: string[];
}

/**
 * One resolved check, shared by package scripts, Git hooks, and previews.
 */
export interface ResolvedCheck {
  id: string;
  tool: ToolId;

  /** The package script that runs the full read-only check, such as `lint:js`. */
  script: string;
  command: CommandSpec;
  fixCommand?: CommandSpec;

  /** The Git hook that runs the check, if any. */
  hook?: "pre-commit" | "pre-push";

  /** Extensions the staged check covers, such as `["js", "mjs"]`. */
  extensions: string[];

  /** Staged-file globs that replace the ones built from `extensions`. */
  globs?: string[];

  /** Arguments placed before the staged file list in the hook command. */
  stagedArgs?: string[];

  /** Whether the hook passes staged files. PHPStan runs on the configured paths instead. */
  usesStagedFiles: boolean;

  /** Runs the command as written instead of through `npx`, for executables npm doesn't provide. */
  direct?: boolean;
  aggregate: "lint" | "format";
}

/**
 * Everything one tool contributes to a plan.
 */
export interface Contribution {
  files: FileContribution[];
  lines: LinesContribution[];
  fields: ManifestFieldContribution[];
  competing: CompetingConfig[];
  diagnostics: Diagnostic[];
}

/**
 * One planned change to a file, as shown in previews and the JSON plan.
 */
export interface PlannedChange {
  path: string;
  action: "create" | "update" | "delete";
  ownership: "file" | "entry" | "lines" | "fields" | "selections" | "state";
  reason: string;
  details: ChangeDetail[];
}

/**
 * A line or field change inside a shared file.
 */
export interface ChangeDetail {
  kind: "add-line" | "remove-line" | "set-field" | "remove-field";
  target: string;
  value?: JsonValue;
  previous?: JsonValue;
}

/**
 * Existing content that Configra cannot change without a decision.
 */
export interface Conflict {
  id: string;
  path: string;
  kind: "unowned-content" | "edited-owned" | "deleted-owned" | "competing-config";
  message: string;
  options: ConflictAction[];
  decision?: ConflictAction;
}

/**
 * A command Configra runs in a later phase, with its working directory relative to the project root.
 */
export interface PlannedCommand {
  phase: "install" | "activate-hooks";

  /** The package manager an install command runs. */
  manager?: "npm" | "composer";
  executable: string;
  args: string[];
  cwd: string;
  approved: boolean;
}

/**
 * A tool or runtime the generated checks or requested phases need.
 */
export interface Prerequisite {
  name: "node" | "npm" | "git" | "php" | "composer" | "lefthook";
  required: string;
  found: string | null;
  status: "ok" | "missing" | "unsupported";
  neededFor: string[];
}

/**
 * Advisory findings about the project that help choose selections.
 */
export interface DiscoveryReport {
  wordpress: { kind: "site" | "wp-content" | "ambiguous" | "none"; candidates: string[] };
  languages: LanguageId[];
  ui: UiId[];
  packageManagers: string[];
  prerequisites: Prerequisite[];
}

/**
 * Settings resolved once per plan from the selections and the captured project snapshot, then shared by
 * every tool renderer. Renderers never read the filesystem or run processes themselves.
 */
export interface ResolvedSettings {
  selections: Selections;
  globals: "node" | "browser";

  /** The `type` the root `package.json` declares after the plan, if any. */
  moduleType: ModuleType | undefined;

  /** The extension for generated JavaScript files: `.js` in ESM packages, `.mjs` otherwise. */
  configExtension: ".js" | ".mjs";
  formatting: FormatSettings;
  formattingStandard: StandardId;

  /** File extensions each selected language covers, including UI additions. */
  extensions: Partial<Record<LanguageId, string[]>>;

  /** Excluded directories (with a trailing slash) and file globs, in `.gitignore` syntax. */
  exclusions: string[];

  /** Selected single files, such as a must-use plugin, that checks cover directly. */
  scopeFiles: string[];

  /** The selected plugin and theme paths PHP tools check, or the whole project outside WordPress. */
  phpPaths: string[];

  /** The lowest PHP version the checked code supports, such as `7.4`. */
  phpTargetVersion: string;

  /** Unselected plugin and theme directories PHPStan scans for symbols without analysing them. */
  scanDirectories: string[];

  /** Glob prefixes for check scopes: `**\/` for the whole project, a directory path, or `` for root files only. */
  scopePrefixes: string[];

  /** Development dependency ranges for the given standard. */
  npmRange: (name: string, standard?: StandardId) => string;
  composerRange: (name: string, standard?: StandardId) => string;
}
