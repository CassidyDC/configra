/**
 * Internal contracts shared by the CLI, generator, components, and adapters.
 * These types describe implementation details rather than a public JavaScript API.
 * @module contracts
 */

/**
 * @typedef {import("node:child_process").StdioOptions} StdioOptions
 * @typedef {typeof import("./platform/filesystem.js").write} FileWriter
 */

/** @typedef {"single"|"nested"|"workspaces"} Layout Selected package ownership strategy. */

/** @typedef {string|number|boolean|null|unknown[]|Object<string, unknown>} JsonValue Primitive, array, or object read from JSON content. */

/**
 * Formatting choices shared by editor settings, formatters, and language standards.
 * @typedef {object} Formatting
 * @property {"space"|"tab"} indentStyle Indentation character.
 * @property {number} indentSize Indentation or tab display width.
 * @property {"lf"|"crlf"} endOfLine Line-ending convention.
 * @property {number} printWidth Preferred line width.
 */

/**
 * Overridable selections accepted from flags, prompts, or saved configuration.
 * @typedef {object} Selections
 * @property {string} [project] Registered project identifier.
 * @property {string[]} [languages] Selected language identifiers.
 * @property {string[]} [capabilities] Capability identifiers; replaces an inherited list.
 * @property {Object<string, string>} [standards] Standard identifiers keyed by language.
 * @property {string[]} [tools] Explicit tool identifiers; replaces project defaults.
 * @property {Partial<Formatting>} [formatting] Explicit shared formatting overrides.
 */

/**
 * Selections for one child package, relative to the selected project root.
 * @typedef {Selections & {path: string}} PackageSelection
 */

/**
 * Input before defaults and child package shorthand are normalized.
 * @typedef {Selections & {version?: 1, layout?: Layout, packages?: Array<string|PackageSelection>}} ProjectInput
 */

/**
 * Normalized, reproducible selections stored separately from generation metadata.
 * @typedef {Selections & {version: 1, project: string, layout: Layout, packages: PackageSelection[]}} ProjectRequest
 */

/**
 * Defaults associated with a project environment, independent of package layout.
 * @typedef {object} ProjectDefinition
 * @property {string} id Stable registration identifier.
 * @property {string[]} languages Default languages.
 * @property {string[]} tools Default tool identifiers.
 * @property {string} environment Runtime or application environment.
 * @property {string[]} paths Suggested source paths relative to a package.
 * @property {string[]} [discovery] WordPress child package discovery hints.
 */

/**
 * Optional language support that can be composed with a project definition.
 * @typedef {object} CapabilityDefinition
 * @property {string} id Stable registration identifier.
 * @property {string} language Required language identifier.
 * @property {string[]} extensions Additional filename extensions without dots.
 * @property {string[]} tools Tools added when the user has not supplied an explicit list.
 */

/**
 * A documented language baseline with formatting and tool-native settings.
 * @typedef {object} StandardDefinition
 * @property {string} id Standard identifier within the language registry.
 * @property {string} language Language governed by the baseline.
 * @property {string} baseline Human-readable name of the chosen conventions.
 * @property {Partial<Formatting>} formatting Language-specific formatting defaults.
 * @property {Object<string, JsonValue>} settings Tool-native standard settings.
 */

/**
 * Pure metadata describing a supported tool integration.
 * @typedef {object} ToolDefinition
 * @property {string} id Stable registration identifier.
 * @property {string[]} languages Supported languages; empty means language independent.
 * @property {string[]} capabilities Supported optional capabilities.
 * @property {string[]} operations Contributed npm script names.
 * @property {"package"|"git"} scope Configuration ownership boundary.
 * @property {string[]} requirements Ecosystem-prefixed package requirement identifiers.
 * @property {string[]} [alternatives] Existing configuration files that would compete with generated output.
 */

/**
 * A discovered manifest location or independent nested Git boundary.
 * @typedef {object} PackageCandidate
 * @property {string} path Project-relative directory, or `.` for the root.
 * @property {string[]} manifests Manifest filenames found directly in that directory.
 * @property {boolean} [gitBoundary] Whether discovery stopped at an independent Git repository.
 */

/**
 * Ownership relationships for an explicitly selected package.
 * @typedef {object} PackageNode
 * @property {string} path Project-relative package directory.
 * @property {string|null} parent Nearest selected parent, or null for the project root.
 * @property {boolean} workspace Whether the package matches root workspace declarations.
 * @property {string} [workspaceName] Package name used for exact npm workspace selection.
 * @property {string[]} children Direct selected child paths, relative to the project root.
 */

/**
 * Package ownership and discovery information, with a separate Git boundary.
 * @typedef {object} PackageGraph
 * @property {string} root Canonical absolute project boundary.
 * @property {string|null} gitRoot Enclosing Git root, if present.
 * @property {PackageCandidate[]} candidates Discovered candidates; discovery does not select them.
 * @property {PackageNode[]} packages Selected packages in parent-before-child order.
 * @property {string[]} workspacePatterns Preserved root npm workspace declarations.
 * @property {Object<string, string|null>} snapshots Manifest hashes captured during discovery.
 */

/**
 * Effective selections after project defaults, inheritance, and overrides are combined.
 * @typedef {object} ResolvedSettings
 * @property {string} project Registered project identifier.
 * @property {string} environment Runtime or application environment.
 * @property {string[]} languages Selected languages.
 * @property {string[]} capabilities Selected capability identifiers.
 * @property {Object<string, StandardDefinition>} standards Effective standard definitions by language.
 * @property {string[]} tools Selected tool identifiers.
 * @property {Formatting} formatting Shared fallback formatting.
 * @property {Object<string, Formatting>} languageFormatting Effective formatting by language.
 * @property {string[]} sourcePaths Project source path hints.
 * @property {Partial<Formatting>} [formattingOverrides] Explicit formatting choices inherited by children.
 * @property {string[]} [toolOverrides] Explicit tool choices inherited by children.
 */

/**
 * Effective settings attached to one selected package's ownership relationships.
 * @typedef {PackageNode & ResolvedSettings} ResolvedPackage
 */

/**
 * A normalized request and all of its effective package settings.
 * @typedef {object} ResolvedProject
 * @property {ProjectRequest} request Reproducible selections.
 * @property {PackageGraph} graph Selected package ownership graph.
 * @property {ResolvedPackage[]} packages Effective packages in parent-before-child order.
 */

/**
 * Additional layout information supplied to tool renderers.
 * @typedef {object} LayoutContext
 * @property {string[]} descendants All selected descendant paths relative to the project root.
 * @property {string[]} excludes Package-relative exclusions for recursive checks.
 * @property {Layout} layout Selected layout strategy.
 * @property {Object<string, string|undefined>} workspaceNames Exact workspace names indexed by selected package path.
 */

/**
 * Resolved package settings extended with renderer-specific layout information.
 * @typedef {ResolvedPackage & LayoutContext} PackageContext
 */

/**
 * A tool's staged-file check before or after Git-relative ownership is applied.
 * @typedef {object} HookRequirement
 * @property {string} id Command identifier, qualified by package during planning.
 * @property {string[]} glob Filename patterns; the planner prefixes child package paths.
 * @property {string} run Shell command containing Lefthook file placeholders.
 * @property {string} [root] Package working directory relative to the Git root.
 * @property {string[]} [excludes] Git-relative exclusions added by the planner.
 */

/**
 * Pure proposed output from one tool renderer; no project writes or installations.
 * @typedef {object} ToolContribution
 * @property {Object<string, string>} [files] Relative file paths mapped to complete contents.
 * @property {Object<string, Object<string, JsonValue>>} [jsonFiles] Structured JSON entries merged by ownership.
 * @property {Object<string, string[]>} [lines] Additive ignore-file entries.
 * @property {Object<string, string>} [scripts] npm script names and commands.
 * @property {Object<string, string>} [npm] npm development dependency names and version ranges.
 * @property {Object<string, string>} [composer] Composer development dependency names and version ranges.
 * @property {Object<string, JsonValue>} [composerSettings] Additional managed Composer settings.
 * @property {HookRequirement[]} [hooks] Staged-file check requirements.
 */

/**
 * A registered tool's metadata together with its pure rendering implementation.
 * @typedef {ToolDefinition & {render: function(PackageContext, {hooks?: HookRequirement[]} =): ToolContribution}} ToolIntegration
 */

/**
 * A proposed file write or deletion with its optimistic concurrency precondition.
 * @typedef {object} FileChange
 * @property {string} path Project-relative target filename.
 * @property {string|null} before Previous content hash, or null for a new file.
 * @property {string|null} content Complete replacement content, or null to remove the file.
 */

/**
 * A generated entry requiring an explicit replacement decision.
 * @typedef {object} GenerationConflict
 * @property {string} path Project-relative conflicting filename.
 * @property {string} reason Human-readable conflict explanation.
 */

/**
 * A package-scoped dependency operation prepared without executing a process.
 * @typedef {object} InstallationOperation
 * @property {"npm"|"composer"} ecosystem Package manager ecosystem.
 * @property {string} package Owning package's project-relative path.
 * @property {string} command Executable name.
 * @property {string[]} args Arguments passed directly without a shell.
 * @property {string} cwd Absolute execution directory.
 */

/**
 * Complete generation proposal, including all preconditions and optional installations.
 * @typedef {object} GenerationPlan
 * @property {string} root Canonical project boundary.
 * @property {FileChange[]} changes Proposed writes and deletions; successful generation state is last.
 * @property {GenerationConflict[]} conflicts Entries requiring resolution before any write.
 * @property {string[]} diagnostics Informational messages.
 * @property {InstallationOperation[]} installations Dependency operations run only when requested.
 * @property {Object<string, string|null>} snapshots Hashes of all files checked before application.
 * @property {ProjectRequest} request Normalized selections used to create the proposal.
 */

/**
 * Process completion or spawn failure associated with a dependency operation.
 * @typedef {InstallationOperation & {success: boolean, error?: string, code?: number|null, signal?: NodeJS.Signals|null}} InstallationResult
 */

/**
 * Process output routing shared by installation runners.
 * @typedef {object} ProcessOptions
 * @property {StdioOptions} [stdio] Stream routing; defaults to inherited terminal output.
 */

/**
 * Optional application controls and injectable adapters for verification.
 * @typedef {object} ApplyOptions
 * @property {boolean} [force] Explicitly replace all reported conflicting generated content.
 * @property {boolean} [install] Run dependency operations after successful file generation.
 * @property {function(InstallationOperation, ProcessOptions): Promise<InstallationResult>} [execute] Installation runner override.
 * @property {FileWriter} [writeFile] File adapter override.
 * @property {StdioOptions} [stdio] Installation process output routing.
 */

/**
 * File generation outcome, kept separate from any subsequent installation failures.
 * @typedef {object} ApplyResult
 * @property {boolean} generated Whether all file and state changes completed successfully.
 * @property {string[]} applied Successfully written or removed project-relative paths.
 * @property {Array<{path: string, error: string}|(InstallationResult & {phase: "installation"})>} failed File or installation failures.
 * @property {InstallationResult[]} installations Results of requested dependency operations.
 */

/**
 * Operational CLI options that are never persisted as project selections.
 * @typedef {object} CommandOptions
 * @property {boolean} [dryRun] Plan without writing files or installing packages.
 * @property {boolean} [json] Emit machine-readable output.
 * @property {boolean} [install] Install dependencies after generation.
 * @property {boolean} [force] Explicitly replace reported conflicts.
 * @property {boolean} [interactive] Prompt for conflict decisions when needed.
 */

/**
 * Output callbacks used by CLI workflows and tests.
 * @typedef {object} CliIO
 * @property {function(string): unknown} out Writes a normal output message.
 * @property {function(string): unknown} error Writes a diagnostic or failure message.
 */
export {};
