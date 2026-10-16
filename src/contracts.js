/**
 * Internal contracts, not a public JavaScript API.
 * @typedef {object} ProjectRequest
 * @property {1} version Selection schema version.
 * @property {string} project Stable project identifier.
 * @property {string[]} [languages] Selected language identifiers.
 * @property {string[]} [capabilities] Optional capability identifiers.
 * @property {Object<string, string>} [standards] Standards by language.
 * @property {string[]} [tools] Explicit tool selection (replaces defaults).
 * @property {object} [formatting] Shared formatting overrides.
 * @property {"single"|"nested"|"workspaces"} layout Package layout.
 * @property {Array<object>} packages Child selections, with relative `path` and overrides.
 * @typedef {object} PackageGraph
 * @property {string} root Absolute project boundary.
 * @property {string|null} gitRoot Independent Git boundary.
 * @property {Array<object>} candidates Discovered manifests and WordPress packages.
 * @property {Array<object>} packages Explicitly selected packages and their relationships.
 * @typedef {object} ResolvedProject
 * @property {ProjectRequest} request Reproducible selections.
 * @property {PackageGraph} graph Package ownership graph.
 * @property {Array<object>} packages Effective package settings.
 * @typedef {object} ToolContribution
 * @property {Object<string, string>} [files] Relative file contents.
 * @property {Object<string, string>} [scripts] npm scripts.
 * @property {Object<string, string>} [npm] npm development dependencies.
 * @property {Object<string, string>} [composer] Composer development dependencies.
 * @property {Array<object>} [hooks] Staged-file check requirements.
 * @typedef {object} GenerationPlan
 * @property {string} root Project boundary.
 * @property {Array<object>} changes Proposed writes and deletions with preconditions.
 * @property {Array<object>} conflicts Changes requiring explicit resolution.
 * @property {string[]} diagnostics Informational messages.
 * @property {Array<object>} installations Optional dependency operations.
 * @typedef {object} ApplyResult
 * @property {boolean} generated Whether all files and state were written.
 * @property {string[]} applied Successfully changed paths.
 * @property {Array<object>} failed Failed file or installation operations.
 * @property {Array<object>} installations Installation results, separate from generation.
 */
export {};
