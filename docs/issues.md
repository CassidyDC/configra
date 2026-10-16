<!--
Project Issues

Prioritized findings, reproduction details, and proposed fixes from a repository review.
-->

# Project issues

Reviewed on 2026-10-16 against commit `d3c4561`. All findings below are open.
The review covers tracked source, configuration, tests, and documentation.
Locations refer to that revision; line numbers may move as fixes are made.

## Review results

There are 23 findings: two P1 issues, 16 P2 issues, and five P3 issues.

| Priority | Meaning                                                          |
| -------- | ---------------------------------------------------------------- |
| P1       | Address first: ownership safety or a broken supported setup.     |
| P2       | Correctness, compatibility, or significant verification gaps.    |
| P3       | Diagnostics, documentation, automation, or support improvements. |

The existing checks pass: all 45 tests, script linting, documentation linting,
and Prettier's repository check. Passing those checks does not cover the edge
cases below. Reproductions used isolated temporary projects, Node.js 24.18.0,
npm 12.0.1, the repository's installed JavaScript tools, and cached copies of
PHPStan 2.2.8 and PHP_CodeSniffer 3.13.6. Interactive cases were exercised through
a pseudo-terminal.

Evidence is marked **reproduced**, **source and upstream metadata**, or
**coverage/support gap**. Fresh network dependency installations and Windows
execution were not performed. Python linting and environment installation are
already explicitly unsupported; they are not counted as implementation defects.

## Priority 1

### ISS-001: Updates can delete files inside a newly independent Git repository

- **Locations:** [previous managed files](../src/generator/plan.js#L302),
  [selected-package boundary checks](../src/generator/package-graph.js#L108),
  [application preflight](../src/generator/apply.js#L35).
- **Evidence — reproduced:** Generate an `editorconfig` setup with a selected
  nested `child` package. Give `child` its own `.git` directory or worktree marker,
  then update the parent without selecting that child. The proposal contains a
  deletion of `child/.editorconfig`, reports no conflict, and applies successfully.
  Adding a child Git boundary after planning also does not invalidate application.
- **Impact:** Previously recorded ownership allows writes and deletions across a
  Git boundary that the current package selector would reject.
- **Fix:** Check the current Git ownership of every managed target, including
  cleanup targets, and revalidate boundary markers before application. Add cases
  for deselected packages becoming repositories and boundaries changing after planning.

### ISS-002: Community React setups request incompatible ESLint peer versions

- **Location:** [ESLint dependency selection](../src/components/tools/eslint/render.js#L25).
- **Evidence — source and upstream metadata:** A Node.js setup with the `react`
  capability generates `eslint: ^10.0.0` and `eslint-plugin-react: ^7.37.0`.
  The reviewed `eslint-plugin-react` 7.37.5 release declares ESLint support through
  `^9.7`, excluding version 10, in its
  [published-version source manifest](https://github.com/jsx-eslint/eslint-plugin-react/blob/v7.37.5/package.json#L90).
- **Impact:** That resolved combination cannot satisfy its declared peer
  dependencies; clean npm installation can fail before the supported React lint
  setup is usable. This conclusion comes from the generated ranges and upstream
  peer metadata, rather than a fresh network installation.
- **Fix:** Select and verify mutually compatible ESLint, preset, and React plugin
  versions. Add a clean consumer installation and JSX lint smoke test without
  suppressing peer dependency checks.

## Priority 2

### ISS-003: Atomic replacement changes existing file permissions

- **Location:** [temporary-file creation and rename](../src/platform/filesystem.js#L149).
- **Evidence — reproduced:** Create `package.json` with mode `0600`, then generate
  ESLint configuration. The rewritten manifest becomes `0644` under the review
  environment's umask. The replacement file is opened with default permissions.
- **Impact:** Updates can broaden access to existing configuration or remove
  executable bits. Content hashes do not detect this metadata change.
- **Fix:** Preserve existing permission bits when replacing a file and use a
  deliberate mode for new files. Verify both restricted and executable fixtures.

### ISS-004: Matching pre-existing manifest entries are silently adopted and later removed

- **Location:** [JSON ownership recording](../src/generator/plan.js#L340).
- **Evidence — reproduced:** Start with a manually maintained `scripts["lint:js"] = "eslint ."`
  entry and `devDependencies.eslint: "^10.0.0"`. Generate with `tools: ["eslint"]`,
  then update with `tools: []`. Both pre-existing entries are deleted without a
  conflict because their matching initial values were recorded as owned.
- **Impact:** Deselecting a tool can remove dependencies, scripts, and settings
  that existed before the toolset managed the project.
- **Fix:** Track whether a JSON leaf was created, explicitly adopted, or already
  present. Preserve pre-existing entries on removal unless adoption was explicit,
  consistent with the existing treatment of ignore lines and recommendations.

### ISS-005: Saved selection edits can be overwritten between loading and planning

- **Locations:** [loading saved selections](../src/cli/commands/update.js#L26),
  [late selection snapshot](../src/generator/plan.js#L446).
- **Evidence — reproduced:** Load the saved `editorconfig` request and resolve its
  graph. Change the saved selections to `tools: []` before calling `plan`.
  Planning records the new file as its precondition but proposes the old request;
  application succeeds without a conflict and restores `tools: ["editorconfig"]`.
- **Impact:** An editor or another command can lose an intervening saved-selection
  change, despite the optimistic concurrency checks.
- **Fix:** Capture the saved-selection content hash when it is read for resolution
  and carry it through planning and application. Add a regression that changes the
  selection file during discovery.

### ISS-006: Interactive updates discard saved standards when a flag overrides one language

- **Locations:** [interactive saved-selection merge](../src/cli/index.js#L133),
  [prompt defaults](../src/cli/prompts/selections.js#L59).
- **Evidence — reproduced:** Save a WordPress plugin setup with `php=community`.
  Run `update --interactive --standard javascript=community --dry-run --json`
  and accept the displayed defaults. PHP is prompted with `wordpress` and the
  resulting request changes PHP to that standard.
- **Impact:** Changing JavaScript's standard can unexpectedly change PHP's
  standard and generated files. Noninteractive updates correctly merge standards
  by language, so the two update modes behave differently.
- **Fix:** Merge saved and explicit standards by language before collecting prompts,
  using the same merge semantics as the update command. Test partial overrides
  against saved standards for multiple languages.

### ISS-007: Removing the last tool dependency schedules no package-manager reconciliation

- **Location:** [installation operation conditions](../src/generator/plan.js#L263).
- **Evidence — reproduced:** Generate with `tools: ["eslint"]`, then plan an
  update with `tools: []`. The manifest removes the owned dependencies but
  `installations` is empty. The same condition exists for removing all Composer
  contributions.
- **Impact:** `update --install` cannot synchronize installed packages and
  lockfiles after the last dependency contribution for an ecosystem is removed.
- **Fix:** Plan reconciliation from manifest dependency changes, including
  removals, rather than only from nonempty desired contributions. Verify removal
  of the last npm and Composer tool with injected package-manager runners.

### ISS-008: Composer installation updates unrelated application dependencies

- **Location:** [Composer operation arguments](../src/platform/composer.js#L21).
- **Evidence — source and upstream metadata:** Every Composer operation is
  `composer update --no-interaction` without a package allowlist. Composer's
  [CLI documentation](https://getcomposer.org/doc/03-cli.md#update-u-upgrade)
  explains that unrestricted updates resolve the whole project; a package list
  limits which dependencies are updated.
- **Impact:** Installing development tooling into an existing application can
  upgrade unrelated locked dependencies. Retrying `update --install` repeats
  that broader update even when the generated configuration has not changed.
- **Fix:** Pass the managed package changes to a constrained dependency operation
  and preserve unrelated locked versions where possible. Add a fixture with a
  locked application dependency and an available newer version.

### ISS-009: Inline Prettier configuration bypasses conflict detection and wins at runtime

- **Locations:** [filename-based alternative detection](../src/generator/plan.js#L427),
  [generated Prettier configuration](../src/components/tools/prettier/render.js#L33).
- **Evidence — reproduced:** Put `prettier: { useTabs: true, tabWidth: 8 }` in an
  existing `package.json` and generate a default Node.js Prettier setup. Planning
  reports no conflict and creates `prettier.config.cjs`. Prettier's `resolveConfig`
  still returns the inline eight-column tab settings.
- **Impact:** Runtime formatting differs from the generated configuration,
  EditorConfig, and the settings the planner uses to format generated files.
- **Fix:** Detect configuration stored in manifest fields as well as filenames.
  Report the inline field as a conflict and require an explicit merge or
  replacement decision. Verify the configuration actually resolved by Prettier.

### ISS-010: Alternative Lefthook configuration files are not detected

- **Locations:** [Lefthook definition](../src/components/tools/lefthook/definition.js#L15),
  [root hook generation](../src/generator/plan.js#L225).
- **Evidence — reproduced:** An existing `lefthook.yaml` does not produce a
  conflict when the planner adds `lefthook.yml`. The definition has no
  `alternatives` list. Lefthook documents multiple supported main configuration
  names and warns against having more than one in its
  [configuration reference](https://lefthook.dev/configuration/).
- **Impact:** Generation can leave competing hook definitions and an uncertain
  active configuration, without reporting the replacement decision to the user.
- **Fix:** Detect all supported main configuration filenames, including dotted
  names and `.config` locations. Preserve intentionally layered local overrides
  rather than treating them as competing main files. Test selection with the real CLI.

### ISS-011: Webpack generation leaves existing competing build configurations in place

- **Locations:** [Webpack definition](../src/components/tools/webpack/definition.js#L15),
  [generated build script](../src/components/tools/webpack/render.js#L50).
- **Evidence — reproduced:** Start with `webpack.config.js` and select `webpack`.
  The proposal adds `webpack.config.mjs` and reports no conflict. The generated
  build script is `webpack --mode production`, without an explicit `--config`.
- **Impact:** The build relies on automatic configuration discovery while two
  competing files remain. The generated configuration may not be the one used;
  Webpack's [CLI reference](https://webpack.js.org/api/cli/#configuration-options)
  documents explicit configuration selection.
- **Fix:** Declare competing Webpack configurations and require a replacement
  decision, or explicitly select the generated file with a documented coexistence
  policy. Test a build in a consumer that already has a configuration.

### ISS-012: Git repositories below hidden directories are missed by discovery

- **Locations:** [hidden-directory filtering](../src/platform/filesystem.js#L177),
  [boundary discovery](../src/generator/package-graph.js#L67).
- **Evidence — reproduced:** Put an independent Git repository containing
  `bad.js` under `.worktrees/foreign`. Generate the parent ESLint setup and run
  `eslint .`. The foreign file is linted because discovery skips `.worktrees`
  before recording its descendant Git boundary.
- **Impact:** Recursive checks can enter independent hidden worktrees and apply
  the parent's rules, contrary to the documented Git-boundary exclusions.
- **Fix:** Discover Git boundaries inside relevant hidden directories, or exclude
  directory trees that discovery deliberately cannot inspect from recursive
  checks. Add an actual hidden-worktree regression.

### ISS-013: Literal package paths are inserted into glob patterns without escaping

- **Locations:** [child exclusions](../src/generator/layouts/single.js#L24),
  [hook glob prefixes](../src/generator/plan.js#L208).
- **Evidence — reproduced:** Select the valid directory `child[a]` in a nested
  Node.js setup. Its exclusion becomes `child[a]/**`. Running root-local ESLint
  still lints `child[a]/bad.js` because the brackets are interpreted as a glob
  character class rather than literal path characters.
- **Impact:** Ownership exclusions fail, so packages may be checked twice or with
  the wrong rules. Hook inclusion patterns have the same literal-prefix problem.
- **Fix:** Escape literal path segments for each tool's pattern syntax. If a tool
  cannot represent a path safely, reject it before generating files with a clear
  diagnostic. Cover bracket characters and other metacharacters in package paths.

### ISS-014: Workspace name validation ignores unselected registered packages

- **Location:** [selected-only name uniqueness check](../src/generator/package-graph.js#L125).
- **Evidence — reproduced:** Register `packages/*`, create two workspace manifests
  named `duplicate`, and select only one of them. Planning reports no conflict;
  npm's workspace discovery fails with `EDUPLICATEWORKSPACE`.
- **Impact:** A setup accepted by the generator cannot execute npm workspace
  commands or its planned installations.
- **Fix:** Validate name uniqueness across the full registered workspace set
  required by npm, while retaining explicit selection for configuration writes.
  Report the colliding paths before application and test selected/unselected collisions.

### ISS-015: PHPStan fails aggregate linting when a parent has no local PHP files

- **Locations:** [PHPStan paths and script](../src/components/tools/phpstan/render.js#L25),
  [local-before-child delegation](../src/generator/layouts/nested.js#L37).
- **Evidence — reproduced:** Run PHPStan 2.2.8 with the generated general-PHP
  configuration in a package with no local PHP files. It exits with status 1 and
  `No files found to analyse.` A parent whose PHP code is entirely in excluded
  selected children has the same empty local analysis set.
- **Impact:** The aggregate `lint` command stops at the parent before checking
  its child packages, even though the layout is valid.
- **Fix:** Handle an empty local PHP source set explicitly while preserving real
  analysis failures. Add a parent-with-only-child-PHP integration case and verify
  that child analysis still runs.

### ISS-016: Interactive JSON mode writes prompts to stdout

- **Locations:** [selection prompt output](../src/cli/prompts/selections.js#L22),
  [conflict prompt output](../src/cli/prompts/conflicts.js#L20).
- **Evidence — reproduced:** Run an interactive dry run with `--json` through a
  terminal and accept the defaults. Prompt text precedes the JSON proposal on
  stdout, so the complete output cannot be parsed as JSON.
- **Impact:** A supported flag combination violates the documented
  machine-readable stdout contract.
- **Fix:** Send interactive prompt output to stderr or a separate terminal stream,
  or reject the combination clearly. Cover both selection and conflict prompts
  with terminal-based tests.

### ISS-017: Staged filenames can be interpreted as tool options

- **Location:** [ESLint staged-file command](../src/components/tools/eslint/render.js#L61).
- **Evidence — reproduced:** Generate ESLint and Lefthook configuration, stage a
  root file named `--config=example.js`, and run the real pre-commit hook.
  Lefthook invokes `eslint --config=example.js`; ESLint attempts to load
  `example.js` as configuration instead of checking the staged file.
- **Impact:** Valid filenames can change command behavior or fail a commit for
  reasons unrelated to their contents. Quoting alone does not end option parsing.
- **Fix:** Use an end-of-options separator or safe relative filename prefixes,
  according to each tool's CLI. Audit the other staged-file commands and test
  option-shaped filenames through Lefthook.

### ISS-018: Automated tests do not exercise the supported external tool combinations

- **Locations:** [consumer ESLint tests](../tests/integration/cli.test.js#L112),
  [packed-artifact test](../tests/integration/package.test.js#L19),
  [project generation assertions](../tests/unit/generation.test.js#L25).
- **Evidence — coverage/support gap:** Tests execute community ESLint using the
  repository's installed dependencies, mock installation processes, and inspect
  most other generated outputs as text. There is no automated installation and
  execution matrix for WordPress, React, TypeScript, Stylelint, PHP tools, and
  Webpack. The plan documents manual tool verification, which does not provide
  a repeatable regression check.
- **Impact:** Invalid dependency combinations and tool-specific runtime failures
  can coexist with a completely passing repository test suite.
- **Fix:** Add consumer smoke fixtures that install the generated dependency
  sets, load the actual configurations, and lint or build representative files.
  Exercise important capability/standard combinations in a dedicated integration
  job, including the failures listed above.

## Priority 3

### ISS-019: Malformed child selections produce implementation errors

- **Location:** [child inheritance before validation](../src/generator/resolve.js#L240).
- **Evidence — reproduced:** A nested selection with
  `packages: [{ path: "child", languages: 42 }]` fails with
  `languages.includes is not a function`. The inheritance code consumes the
  value before the normal language-list validator runs.
- **Impact:** Invalid input gets an internal JavaScript error instead of a useful
  diagnostic naming the child package and invalid field.
- **Fix:** Validate child selection field types before inheritance. Test malformed
  arrays, standard identifiers, and formatting values consistently at both levels.

### ISS-020: Repository checks are not enforced by a checked-in CI workflow

- **Locations:** [available validation scripts](../package.json),
  [local hook checks](../lefthook.yml).
- **Evidence — coverage/support gap:** No CI workflow is tracked in the repository.
  The local pre-commit hook runs formatting and linting, but does not run `npm test`.
  This observation does not establish whether an external CI service is configured.
- **Impact:** The repository itself provides no repeatable remote gate for test
  failures, packed-artifact regressions, or changes made without local hooks.
- **Fix:** Check in CI configuration that installs from the lockfile and runs
  tests, script linting, documentation linting, and formatting checks. Add the
  external-tool matrix from ISS-018 as a separate job.

### ISS-021: VS Code integration rejects valid JSON with comments

- **Locations:** [strict JSON parsing during merging](../src/generator/plan.js#L332),
  [VS Code contributions](../src/components/tools/vscode/render.js#L30).
- **Evidence — reproduced; documented support gap:** An existing
  `.vscode/settings.json` with a comment and trailing comma is valid for VS Code
  but causes generation to fail with `Invalid JSON`. The generated-project guide
  already documents this limitation.
- **Impact:** Adopting the default VS Code integration requires users to strip
  comments from an otherwise valid editor configuration before any files can be generated.
- **Fix:** Use a JSONC-aware parser and preserve comments and unrelated formatting
  when updating VS Code files. Keep strict JSON parsing for actual manifests.
  Add settings and extension fixtures containing comments and trailing commas.

### ISS-022: Windows process execution and shell support need an explicit policy

- **Locations:** [shell-free process spawning](../src/platform/process.js#L21),
  [POSIX quoting](../src/platform/process.js#L35),
  [npm command selection](../src/platform/npm.js#L75).
- **Evidence — source and upstream metadata; support gap:** Package managers are
  spawned as `npm` and `composer` with `shell: false`, while generated delegation
  commands use POSIX single-quote escaping. Standard Windows npm launchers use
  `.cmd` wrappers, which require different handling according to Node's
  [child-process documentation](https://nodejs.org/api/child_process.html#spawning-bat-and-cmd-files-on-windows).
  The README does not state a supported OS/shell policy. Windows was not tested.
- **Impact:** Windows users can encounter installation and delegation failures
  without an early explanation of the supported environment.
- **Fix:** Either implement and test Windows executable resolution and quoting,
  or explicitly document and validate the supported platforms and shells.
  Keep argument escaping safe when adding platform-specific execution.

### ISS-023: The introductory quickstart runs lint before installing generated dependencies

- **Location:** [README quickstart](../README.md#L15).
- **Evidence — source:** The first copyable command sequence uses
  `cdctool init --project wordpress-plugin` followed immediately by `npm run lint`.
  Generation does not install the required npm or Composer tools without
  `--install`; that explanation appears after the command sequence.
- **Impact:** Following the complete introductory example in a fresh project
  fails because the generated lint commands do not have their dependencies.
- **Fix:** Include `--install` in the example or show the npm and Composer
  installation steps before invoking lint. Validate the documented sequence
  in a clean consumer environment.
