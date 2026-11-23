# Build Configra as a new public npm CLI

## First release

Publish the first release of `@cassidydc/configra` for developers who want to set up linting, formatting, and Git hooks in new or existing projects. Configra generates editable files and declares the required development dependencies. The generated checks run independently of Configra.

| Feature            | First release                                                                                                                                                                                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project presets    | Node.js and WordPress sites. Support WordPress and community standards and verified TypeScript and React combinations.                                                                                                                                                                                   |
| Tooling            | EditorConfig and `.gitignore` are the universal baseline. The launch presets select Prettier and Markdownlint. Use ESLint for JavaScript and TypeScript, Stylelint for selected CSS, and `php -l`, PHP_CodeSniffer, and PHPStan for PHP.                                                                 |
| Repository layouts | Single-project layout by default. WordPress sites check only the plugin and theme directories the user selects and can opt into nested projects so each selected directory owns its tooling.                                                                                                             |
| Git hooks          | Lefthook runs read-only checks on staged paths and runs PHPStan before pushes. The `commit-msg` hook runs a generated, dependency-free script that defaults to plain sentence-case subjects and offers Conventional Commits or validation off. Conventional Commits users can choose commitlint instead. |
| Setup wizard       | `configra init` previews changes and lets users save selections, generate files, or generate and install in one run.                                                                                                                                                                                     |
| Installation       | npm for JavaScript tooling and Composer for PHP tooling. Every setup has a root `package.json` for Lefthook and the root scripts. Saved selections can be replayed on another checkout. Dependency installation and hook activation are separate opt-ins.                                                |

Build the package graph with standalone Node.js in the first four milestones. Before launch, extend it to WordPress sites with optional nested plugins and themes. See [Next release](#next-release) for the layouts, presets, and integrations deferred from launch. Keep generated release automation outside launch scope.

## Preset behavior

### Launch presets

| Preset           | Default languages          | Default UI | Default standards | Default tools                                                                                                              |
| ---------------- | -------------------------- | ---------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `node`           | `javascript`               | None       | `community`       | `editorconfig`, `gitignore`, `prettier`, `markdownlint`, `eslint`, `lefthook`                                              |
| `wordpress-site` | `javascript`, `css`, `php` | None       | `wordpress`       | `editorconfig`, `gitignore`, `prettier`, `markdownlint`, `eslint`, `stylelint`, `php-lint`, `phpcs`, `phpstan`, `lefthook` |

- Launch language IDs are `javascript`, `typescript`, `css`, and `php`. The launch UI ID is `react`. Launch standard IDs are `community` and `wordpress`. The launch tool IDs are those in the table plus `commitlint`. Commit-message validation follows `--commit-messages` rather than the tool list.
- Both presets require Node.js 24 or later and npm 11 or later, which every Node.js 24 release bundles. `wordpress-site` also requires PHP 8.3 or later and Composer 2.7 or later, the first release with `--minimal-changes` for partial updates. These are the versions that run the generated checks. Confirm the shipped dependency set supports them, and show the minimums in help and in prerequisite errors.

| Language   | `community`                                                                    | `wordpress`                                            |
| ---------- | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| JavaScript | `@eslint/js` recommended rules, plus the community React plugins when selected | `@wordpress/eslint-plugin`                             |
| TypeScript | The JavaScript rules plus `typescript-eslint` recommended rules                | `@wordpress/eslint-plugin` with its TypeScript support |
| CSS        | `stylelint-config-standard`                                                    | `@wordpress/stylelint-config`                          |
| PHP        | PSR-12 through PHP_CodeSniffer                                                 | WordPress Coding Standards                             |
| Formatting | Prettier defaults aligned with EditorConfig                                    | `@wordpress/prettier-config`                           |

### Generated files

Each tool with an import mechanism gets two files. The project owns the tool's standard entry file: Configra creates it once with an import of the matching Configra file and commented examples, then never changes it. The Configra file in the `configra/` folder holds everything Configra manages, such as the coding standard, paths, ignored directories, and selection-derived settings, and Configra rewrites it when selections or its defaults change. Each entry file loads its Configra file first, so project overrides below the import win.

| Tool                  | Entry file (created once, project-owned) | Configra file (Configra-owned) |
| --------------------- | ---------------------------------------- | ------------------------------ |
| Prettier              | `prettier.config.js` or `.mjs`           | `configra/prettier.mjs`        |
| Markdownlint          | `.markdownlint-cli2.mjs`                 | `configra/markdownlint.mjs`    |
| ESLint                | `eslint.config.js` or `.mjs`             | `configra/eslint.mjs`          |
| Stylelint             | `stylelint.config.js` or `.mjs`          | `configra/stylelint.mjs`       |
| PHP_CodeSniffer       | `phpcs.xml.dist`                         | `configra/phpcs.xml`           |
| PHPStan               | `phpstan.neon.dist`                      | `configra/phpstan.neon`        |
| Lefthook              | `lefthook.yml`                           | `configra/lefthook.yml`        |
| commitlint (optional) | `commitlint.config.js` or `.mjs`         | `configra/commitlint.mjs`      |

| Other generated content         | Ownership                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| `.configra.json`                | The editable selection file. Configra writes it from the wizard and preserves manual edits. |
| `.configra-state.json`          | Configra-owned ownership state.                                                             |
| `.editorconfig`                 | Configra-owned whole file, because EditorConfig has no import mechanism.                    |
| `.gitignore`, `.prettierignore` | Configra-owned lines. Project lines are left alone.                                         |
| `package.json`, `composer.json` | Configra-owned fields.                                                                      |
| `configra/scripts/`             | Configra-owned helper scripts for batched `php -l` and the `commit-msg` check.              |

- Import Configra files the way each tool supports. ESLint, Prettier, markdownlint-cli2, Stylelint, and commitlint entry files import and spread their Configra module. Stylelint spreads instead of using `extends` so its `ignoreFiles` setting applies. PHP_CodeSniffer uses `<rule ref="./configra/phpcs.xml"/>`, PHPStan uses `includes`, and Lefthook uses `extends`.
- Commit the PHP_CodeSniffer and PHPStan entry files with the `.dist` suffix, following both tools' conventions. Each tool prefers `phpcs.xml` or `phpstan.neon` when present, so a developer can create one locally that includes the `.dist` file and adds personal overrides.
- Write JavaScript files in `configra/` as `.mjs` so they load as ESM in any package. Entry filenames follow the package's module type.
- Start each Configra-owned file with a header such as `Managed by Configra. Put your changes in eslint.config.js.`
- Without executing them, check that each entry file still references its Configra file and warn when the reference is missing. When a tool change needs a different entry-file shape, show the suggested change for manual adoption. Recreate a missing entry file through the normal preview.
- In the nested layout, each selected child gets its own entry files and `configra/` folder.
- Add owned `.gitignore` lines for `node_modules/`, `vendor/`, the personal override files `lefthook-local.yml`, `phpcs.xml`, and `phpstan.neon`, and the ESLint, PHP_CodeSniffer, and PHPStan cache locations. Never ignore WordPress core or uploads by default.
- Exclude `node_modules/`, `vendor/`, `build/`, `dist/`, tool caches, and minified `*.min.js` and `*.min.css` files from every generated check scope by default. Let saved selections add or remove exclusions.
- Helper scripts in `configra/scripts/` use only Node.js built-ins so they run without Configra.
- Let Prettier own formatting for the file types it covers. Turn off overlapping stylistic rules in markdownlint, Stylelint, and ESLint, and use the WordPress ESLint setup without its Prettier rule so formatting runs only through `format` and `format:check`. PHP_CodeSniffer owns PHP formatting, and `lint:fix` runs `phpcbf`. Derive EditorConfig and Prettier settings from the same resolved formatting settings.

### WordPress sites

- Use `wordpress-site` as the only WordPress preset. In either layout, check only the plugin and theme directories the user explicitly selects. Keep WordPress core, unselected plugins and themes, and other third-party code outside generated check scopes. PHPStan may scan unselected plugins and themes to resolve their symbols, but never analyses or reports on them. With no selections, root checks cover only the site's own root files.
- Treat the target as a full site checkout when it contains `wp-includes/` or `wp-config.php`, and as a `wp-content` project when it has root `plugins/` or `themes/` directories without WordPress core. Ask the user to confirm when neither or both apply.
- Suggest existing plugin and theme directories under `wp-content/plugins/`, `wp-content/mu-plugins/`, and `wp-content/themes/` in a full site checkout, or under `plugins/`, `mu-plugins/`, and `themes/` when targeting a `wp-content` project. Suggestions never select a directory on their own. Select directories explicitly in the wizard, with repeatable `--package`, or in saved selections. Single-file must-use plugins can be selected by file path, and root tooling checks them in either layout.
- In the default `single` layout, the site's root tooling checks each selected directory. In the opt-in `nested` layout, configure selected plugins and themes as ordinary child projects with a path and optional settings overrides. They inherit applicable site settings and own their local tooling, dependencies, and `package.json` scripts, including children whose tools all come from Composer.
- Make each nested child's checks runnable from the site root through the aggregate scripts and from the child directory through its own scripts, so they work whether the editor workspace is the site or a single plugin or theme. The site's shared Git hooks route staged checks to each selected child.

### JavaScript and PHP checks

- Mark manifests created solely for tooling as private. Add `"engines": { "node": ">=24" }` to the root manifest when it has no compatible value. Default a fresh project with no existing JavaScript or enclosing module setting to `"type": "module"`. When adding a manifest to existing code, carry forward the enclosing package's explicit module type or leave the type unset if none applies. Preserve the type in existing manifests. [Node.js package type](https://nodejs.org/api/packages.html#type)
- Choose generated config filenames using the planned package manifest. Prefer `.js` for ESM configuration when the manifest declares `"type": "module"`. Use `.mjs` to declare ESM explicitly in CommonJS projects and projects without an explicit module type. Reserve `.cjs` for tools that require CommonJS.
- Use ESLint flat config in `eslint.config.js` or `eslint.config.mjs`, following the target package's module type. Ship a tested set of dependency ranges with Configra. Change the set through a reviewed fixture update and keep generation independent of live registry metadata.
- Use `@eslint-react/eslint-plugin` and React's `eslint-plugin-react-hooks` for the community React setup on ESLint 10 and later. For the WordPress standard, start with the official plugin's flat-config release line introduced in version 25. Verify the complete dependency graph in a standalone consumer, including React and TypeScript, with normal peer dependency checks. [WordPress ESLint changelog](https://github.com/WordPress/gutenberg/blob/trunk/packages/eslint-plugin/CHANGELOG.md)
- Use native `php -l` for staged and full-project syntax checks. Pass multiple files per invocation, which PHP 8.3 supports, and split batches to stay within command-line length limits on Windows. Keep PHP_CodeSniffer for the selected PHP coding standard and PHPStan for static analysis.
- For the WordPress standard, add `szepeviktor/phpstan-wordpress` so PHPStan understands WordPress functions and hooks. Start PHPStan at level 5, which saved selections can change. Record the site's minimum PHP and WordPress versions in saved selections and pass them to PHPStan and WordPress Coding Standards. Keep this target PHP version separate from the PHP 8.3 that runs the tools. Default it from the `Requires PHP` header of each selected plugin or theme, then `composer.json` `require.php`, then WordPress core's minimum. Default the minimum WordPress version from the `Requires at least` header and leave it unset when no header declares it. In the single layout, use the lowest version the selected directories declare, warn when they differ, and suggest the nested layout.
- For the WordPress standard, detect each selected plugin or theme's text domain from its `Text Domain` header and suggest a function prefix from its directory name. Ask for both in the wizard, store them in saved selections, and write them to `configra/phpcs.xml`. In the single layout, list every selected directory's values together.
- Put the managed PHPStan settings in `configra/phpstan.neon`: the level, the WordPress extension, the target PHP version, exclusions, and the selected plugin and theme directories under `paths`. Include the WordPress extension file directly from `vendor/` instead of through `phpstan/extension-installer`, which would need another Composer plugin permission. PHPStan resolves relative paths from the file that declares them, so write paths relative to `configra/`, such as `../wp-content/plugins/my-plugin`.
- In a WordPress site, list the unselected plugin, must-use plugin, and theme directories under `scanDirectories` so PHPStan can resolve classes and functions that the selected code uses without analysing them. Let saved selections remove scanned directories to keep large sites fast. In the nested layout, each child's PHPStan files analyse that child and scan the site's other plugins and themes.
- The project's `phpstan.neon.dist` includes `configra/phpstan.neon`, so its own single values such as the level override Configra's and its lists add to Configra's. Run PHPStan with an explicit memory limit such as `--memory-limit=1G` in generated scripts and hooks.
- Lint TypeScript with `typescript-eslint` rules that don't need type information, so linting works without a `tsconfig.json`. Type-aware rules and `tsc --noEmit` come with the next release's TypeScript option.

### Language and UI selection

- A project preset provides default languages, UI support, and tools. The user can run `configra init --project <id>` with the preset defaults or override language and UI selections. In the interactive wizard, use detected source and UI usage to suggest choices.
- Use comma-separated `--languages` and `--ui` values and the matching `languages` and `ui` arrays in selection JSON. At launch, TypeScript is a language choice and React is the UI choice. SCSS and Vue follow in the [next release](#next-release).
- React adds `.jsx` coverage for JavaScript and `.tsx` coverage for TypeScript, along with React lint rules.

## CLI and saved configuration

### Command and output contract

- Document the CLI and JSON as the public interfaces. Use the commands and options in the help reference below. Treat an explicit config as the input selections and preview the saved result at the project root.
- Normalize prompts, flags, and saved selections into the same typed request. Validate each package selection before applying inheritance. Explicit flags override saved values and preset defaults fill omitted values. An explicit empty list clears that selection. Merge standards by language and document which fields replace lists and which merge maps.
- Keep `--dry-run` read-only and suppress automatic prompts in dry-run and JSON modes. Reject explicit `--interactive` combined with either mode. For workflow commands in JSON mode, emit one versioned document on stdout, including for argument and validation errors. Include stable diagnostic codes, project-relative paths, and structured command arguments. Send child process output to stderr in JSON mode. Use exit code 0 for success, 1 for argument, validation, or execution failure, 2 for unresolved conflicts, and 130 when the user interrupts a run. Block noninteractive writes when validation fails or conflicts remain.
- In a terminal, runs that skip the wizard still show the preview, prompt for each conflict, and ask for approval before writing. `--yes` skips the approval prompt but resolves no conflicts, so unresolved conflicts still exit with code 2. Outside a terminal, write without prompting when the run is valid and conflict-free. Installation and hook activation always need their own flags or wizard approval.
- Configra makes no network requests or telemetry calls itself. Only the npm and Composer installs it runs reach the network.
- Use color and interactive formatting only when stdout is a terminal, and honor `NO_COLOR`. Keep text output readable when piped or captured in CI logs.
- Use the same change details in the text preview, wizard, and JSON plan. For each creation, update, or deletion, show the relative path, owning package, and reason. Show which scripts, dependency declarations, or settings change in shared files. A valid dry run can report planned changes and still exit successfully.
- Publish JSON Schemas and examples for saved selections and machine-readable output. Document content-change kinds, the effect of each flag, and which output fields are stable. Keep internal snapshot and recovery data out of the public plan.

### CLI help reference

`configra` and `configra --help` show the command overview and shared options. `configra <command> --help` shows usage, every flag accepted by that command, accepted values, defaults, conflicts between options, exit codes, and examples. Help and version output work outside a project and exit successfully before any project work.

| Command                       | Purpose                                                                                                                                                                                                                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `configra init [options]`     | Set up a new or existing project, or apply saved selections on a fresh checkout. An eligible terminal session opens the setup wizard. Otherwise, a run without a project uses the Node.js preset, or stops with a diagnostic suggesting `--project wordpress-site` when it detects a WordPress site. |
| `configra update [options]`   | Reapply or change an existing setup, or retry dependency installation. Requires `.configra.json` at the target root or an explicit `--config`.                                                                                                                                                       |
| `configra discover [options]` | Report candidate plugin and theme directories, detected languages and UI, and missing or unsupported prerequisites such as Node.js, npm, PHP, Composer, and Git. Discovery is read-only and leaves selection to the user.                                                                            |

| Flag                         | Commands         | Behavior                                                                                                                                                                                                                                                      |
| ---------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-h`, `--help`               | All              | Show overview or command help.                                                                                                                                                                                                                                |
| `-v`, `--version`            | All              | Print the installed Configra version.                                                                                                                                                                                                                         |
| `--cwd <path>`               | All              | Target an existing directory. Resolve relative paths from the caller's working directory, which is the default target.                                                                                                                                        |
| `--json`                     | All              | Print one versioned JSON result and suppress prompts. Use with `--dry-run` for a read-only generation plan.                                                                                                                                                   |
| `--config <file>`            | `init`, `update` | Read selections from a JSON file. Resolve relative paths under the target root. Defaults to `.configra.json` when present.                                                                                                                                    |
| `--project <id>`             | `init`, `update` | Choose a root preset. Launch IDs are `node` and `wordpress-site`.                                                                                                                                                                                             |
| `--layout <id>`              | `init`, `update` | Choose `single` or `nested`. Fresh setups default to `single`. At launch, WordPress sites can opt into nesting.                                                                                                                                               |
| `--package <path>`           | `init`, `update` | Select a plugin or theme directory relative to the target root. Repeat to select multiple directories. Works in both layouts. Use selection JSON for per-package overrides in the nested layout.                                                              |
| `--languages <ids>`          | `init`, `update` | Set the comma-separated language list, such as `javascript,typescript`.                                                                                                                                                                                       |
| `--ui <ids>`                 | `init`, `update` | Set the comma-separated UI list, such as `react`.                                                                                                                                                                                                             |
| `--standard <language>=<id>` | `init`, `update` | Override a coding standard for one language, such as `php=wordpress`. Repeat for multiple languages.                                                                                                                                                          |
| `--tools <ids>`              | `init`, `update` | Set the comma-separated tool list.                                                                                                                                                                                                                            |
| `--commit-messages <mode>`   | `init`, `update` | Choose `plain` for sentence-case subjects, `conventional` for Conventional Commits, or `off` to disable message validation. Defaults to `plain`. Add `commitlint` to the tools to check Conventional Commits with commitlint instead of the generated script. |
| `--interactive`              | `init`, `update` | Open the terminal wizard with saved selections and flags prefilled. Incompatible with `--dry-run` and `--json`.                                                                                                                                               |
| `--yes`                      | `init`, `update` | Approve the preview without prompting in a terminal. Conflicts still need decisions, and installation and hook activation still need their own flags.                                                                                                         |
| `--dry-run`                  | `init`, `update` | Preview changes, conflicts, and proposed commands without writing files, installing dependencies, or activating hooks.                                                                                                                                        |
| `--install`                  | `init`, `update` | Install declared dependencies after generation. Installation is opt-in for each run.                                                                                                                                                                          |
| `--install-hooks`            | `init`, `update` | Activate Git hooks explicitly. Requires an existing Git root and an available Lefthook binary.                                                                                                                                                                |

Explain how saved values, explicit flags, and preset defaults interact. Show explicit empty lists such as `--ui=`, document wizard outcomes including **Save config only**, and point to the selection schema for settings supplied through JSON. Describe the allowed preset, layout, language, UI, standard, and tool IDs from the same definitions the parser and validator use. List the options supported by the installed release.

Include copyable examples for discovery, a JSON preview, nested WordPress setup, and installation retries.

```sh
configra discover --cwd ./site
configra init --project node --dry-run --json
configra init --project wordpress-site --layout nested --package wp-content/plugins/example --package wp-content/themes/example
configra update --install
```

### Setup wizard

- Launch the wizard from `configra init` when standard input and output are terminals, the target root has no saved config, and the user supplies no explicit config file or selection flags. Use `--cwd` to target a different directory with the same wizard behavior. Use `--interactive` to open the wizard with the available config and flags prefilled, including on `configra update`. Noninteractive runs use the same config, flag, and preset defaults.
- Ask for the project preset and show the layout choices it supports, with single-project generation selected by default for fresh setups. For a WordPress site, suggest plugin and theme directories and require explicit selection in either layout. Ask about languages, UI, standards, and tools using detected source and UI usage as suggestions. Let users accept preset defaults in one step or customize selected packages. Support revisiting answers, retrying invalid answers, and clearing a default selection.
- Preview the proposed `.configra.json`, generated file changes, conflicts, and installer commands with their working directories. Offer **Save config only**, **Generate files**, or **Generate and install**. Resolve conflicts for the selected outcome and preview any resulting changes before final approval. Canceling before approval leaves the project untouched.
- Use the same validation and planning flow for all three outcomes. Save-only writes just `.configra.json`. Both generation paths save the config and use its selections to generate tooling files. Show applicable hook activation in the preview and request separate approval when generating files.

### Saved configuration

- Use `.configra.json` at the project root as the editable source of truth. Store the preset, layout, selected packages, languages, UI, standards, tools, and integration settings. Keep ownership in `.configra-state.json`. Start both schemas at version `1` and report invalid or unsupported schema versions before writes. Treat installation and hook activation as approvals for the current run. Earlier development builds were never published, so read no older config formats. Write a `$schema` reference to the schema shipped with the installed Configra version so editors validate and autocomplete the file.
- Record selected WordPress plugin and theme directories as project-relative paths with any explicit overrides. Switching to the single layout keeps the selections and moves their checks to root tooling. Deselecting a directory removes it from checks. In both cases, preview removing unchanged owned child tooling under the normal conflict rules.
- Apply a saved config on a fresh checkout with `configra init --config .configra.json --install`. Use `configra update --install` to reapply the root config or retry an install after generation succeeds. Pass `--install-hooks` when a scripted run should also activate Git hooks.
- Document two checkout workflows. By default, projects commit generated tooling files with `.configra-state.json` so another checkout can update them safely, and generated ignore rules leave the state file tracked. Projects that commit selections alone regenerate the outputs and recreate state locally. Record any directory-derived defaults used to create manifests so a differently named checkout can reproduce them. Show how to replay with the same Configra release and use package-manager lockfiles for repeatable dependency installs.
- Record the Configra version that last wrote the project in `.configra-state.json`. Warn when a run uses a different version. When a newer release ships new tested ranges, preview range changes for owned dependency declarations on `update` and leave unowned declarations unchanged.
- Document how to stop using Configra: delete `.configra.json` and `.configra-state.json` and keep the generated files, which continue to work as ordinary project files. The `configra/` folder can stay, or be renamed along with the import lines in the entry files.

## Safe updates

- Capture inputs and preconditions when they are first read. Include the selection file, manifests, ownership state, and configuration whose presence affects the result. Resolve settings against the snapshot. Keep discovery and planning read-only and detect competing configuration without executing project configuration or scripts.
- Track ownership at the smallest unit the file format can safely support, such as a complete file, a manifest field, or an added ignore line. Record entry files as created-once content that Configra never updates after creating it. Preserve matching pre-existing content as unowned. Update or remove unchanged owned content. Show conflicts for edited or deleted owned content and competing active configs. Let the user retain existing content, replace or adopt it explicitly, or change the selection. Replan after a conflict decision so the saved selections, generated files, and ownership agree before approval.
- Persist a decision to retain existing content in saved selections so an unchanged rerun respects it. Reuse compatible content without taking ownership. When retaining the content makes a tool setup incompatible, ask the user to adjust the tool selection before generating dependent scripts or hooks.
- Keep manifest patches focused on managed fields. Preserve unrelated keys and comments in formats that allow them. Use format-aware edits for JSONC, TOML, and other shared formats when their integrations are added. Preserve file modes and existing line endings. Distinguish exact pre-apply snapshots from comparisons of generated text ownership so a Git CRLF checkout does not create false conflicts.
- Acquire a per-project lock only after approval and hold it through Configra's writes and any requested install or activation. Recheck preconditions before applying, and validate paths and Git boundaries immediately before each write or deletion, including cleanup of deselected packages. Stage replacements and use a small recovery journal so an interrupted run can resume or roll back safely. Write ownership state last, and direct the next write run to recover before starting fresh. During recovery, surface intervening user edits as conflicts. Store the lock and recovery journal under `configra/` in the Git directory resolved with `git rev-parse --git-path`, or in `configra/.tmp/` with an owned ignore rule when there is no Git repository. Leave dry runs read-only even when recovery is pending.

### Dependency installation

- Use the existing lockfile owner and package-manager workflow. For launch, support npm and Composer installation and report unsupported JavaScript package managers before changing manifests or installing. Keep configuration-only generation available when it can preserve the project's existing package-manager setup.
- Check prerequisites for requested installs or hook activation before applying files, including missing executables and unsupported versions. Keep generation available when the target toolchain is absent and the user selects a file-only run. If install and hook activation are both requested, account for the approved install providing the Lefthook binary.
- Reuse compatible dependencies already declared in the owning manifest, whether they are production or development requirements. Keep their existing version constraints and ownership. Add new tool requirements as development dependencies. Show incompatible or unverified declarations as conflicts before moving, replacing, or duplicating them.
- Resolve and preview the effective installer root. If the installer would write outside the selected project scope, stop before writes and explain how to target that root explicitly. Include a test that runs from a child of an existing npm workspace, even before workspace generation is supported. [npm workspace command behavior](https://docs.npmjs.com/cli/v11/using-npm/workspaces/#running-commands-in-the-context-of-workspaces)
- Plan dependency reconciliation from manifest changes, including removal of the final managed requirement. Reconcile once per lockfile owner. Preserve the managed dependency changes needed for reconciliation across generate-only runs and failed installs, since an unchanged manifest on retry can still have an out-of-sync lockfile. Installation approval applies to the current run. For an existing Composer lockfile, run a partial update of the managed packages with `--minimal-changes` to preserve unrelated locked versions where possible. [Composer partial updates](https://getcomposer.org/doc/03-cli.md#update-u-upgrade)
- During Configra-driven npm installs, disable lifecycle scripts so Lefthook's postinstall cannot activate hooks. Document and test the same script policy for a normal checkout install, including `npm ci --ignore-scripts` when a lockfile is present. Ship presets after verifying their generated checks work under that policy. If a later tool needs an install script, make its setup explicit and test it separately from hook activation. [npm install options](https://docs.npmjs.com/cli/v11/commands/npm-install/#ignore-scripts) · [Lefthook installation behavior](https://lefthook.dev/usage/commands/install/)
- Run Composer with `--no-scripts` so application lifecycle scripts stay under the project's control. Respect its existing Composer plugin policy. Preview any package-specific allowlist entry required to register the WordPress coding standard and preserve existing denials. Verify that PHP_CodeSniffer finds the selected standard after installation. [Composer CLI options](https://getcomposer.org/doc/03-cli.md#global-options) · [Composer plugin settings](https://getcomposer.org/doc/06-config.md#allow-plugins) · [WordPress Coding Standards installation](https://github.com/WordPress/WordPress-Coding-Standards#installation)
- Apply files, reconcile dependencies, and activate hooks as distinct phases. Report each phase's outcome. Keep successfully written files after an installation failure and print a retry command with the original target root and applicable approvals. Skip hook activation after a failed prerequisite. Retry explicitly requested installation even when generation has no changes.

### Git hooks and generated checks

- Generate one hook configuration per Git root. When the requested target is a subdirectory of an existing repository, keep the plan within the requested scope and explain how to run from the Git root to configure hooks. Allow generating hook configuration before Git initialization. Require a Git root and an available Lefthook binary for explicit activation. Inspect the effective hook path and preserve existing hooks and hook managers. Document `npx lefthook install` so collaborators can activate hooks without Configra, and `lefthook-local.yml` for personal hook overrides.
- Use read-only checks in hooks and CI. Keep format and lint fixes in separate explicit commands. Check the staged version of each file where the tool supports it. Otherwise, report a partially staged file and stop before checking a different working-tree version. Skip deleted paths and use the destination path for renames. Handle an empty eligible file set without hiding real tool failures.
- Share resolved check definitions across scripts, hooks, and any generated CI. Apply each tool's option boundary and path-pattern rules. Test names containing spaces, quotes, glob characters, and leading hyphens, plus real partially staged commits and worktrees. Document and test how plain and conventional commit rules handle merge, revert, fixup, and squash subjects, using the same cases for the generated script and commitlint.
- Run fast file-level checks in `pre-commit` on staged paths: `php -l`, PHP_CodeSniffer, ESLint, Stylelint, Prettier, and markdownlint. PHPStan analyses code in the context of the whole project, so run it in a `pre-push` hook against the configured paths, and in `lint` and CI. Generate the `pre-push` hook only when PHPStan is selected. Document that it analyses the working tree, so uncommitted changes can affect the result.
- Generate a dependency-free Node.js script in the target project for the `commit-msg` hook. It reads the message file, ignores comment lines and the verbose-commit cut line, skips merge, revert, `fixup!`, `squash!`, and `amend!` subjects, and applies the selected mode. Plain subjects start with a capital letter, have no type prefix or trailing period, and allow acronyms and proper nouns. Conventional subjects follow `type(scope)!: description`. Limit subjects to 72 characters in both modes. When the user selects commitlint with Conventional Commits, declare `@commitlint/cli` and `@commitlint/config-conventional` and generate a commitlint config in place of the script, overriding its header length limit to match. Reject commitlint with other modes and omit the hook when validation is off.
- Use `lint` for the aggregate read-only checks and `lint:local` for root-only checks in a nested project. Use `lint:fix` for explicit fixes from linters that support them. For each package with a formatter selected, use `format:check` to verify formatting and `format` to apply it. Both use that package's file scope. Show the actual generated commands, their working directories, and which command writes files in the preview and success output. Resolve existing script names through the ordinary conflict flow.
- Keep documented check entry points stable and preserve existing project build, test, and lifecycle scripts. If an integration needs a helper, generate it in the target project so it works when Configra is absent. Removing a hook configuration must leave any installed hook in a working state or present an explicit cleanup step for hooks Configra installed.

## Package settings and ownership

- Let `--config` set standards and formatting per language and per package. Children inherit applicable settings from their nearest selected parent. Explicit child standards merge by language, and explicit child tool and UI lists replace the inherited lists. A WordPress site can use WordPress defaults while a selected plugin or theme uses community JavaScript rules.
- Use a package graph to track selected package roots, relationships, workspace membership, and Git boundaries. Track configuration ownership, check working directories, and installer roots explicitly so a package can own checks in multiple directories while sharing a lockfile with its peers.
- Keep dependencies and local scripts in their owning manifests. Generate a root `package.json` for every setup, and give each nested child its own `package.json` for local scripts even when its tools come from Composer. Exclude selected child directories and independent Git repositories from parent-local checks. Have aggregate checks delegate to each child once by path. Route staged paths through the same graph. Keep the graph ready for npm workspace membership, which arrives in the next release.
- Keep discovery advisory and bounded. Skip dependency and generated directories. Treat directories the scanner deliberately skips as out of scope for recursive checks when Git ownership cannot be determined. Check explicitly selected and previously owned paths independently of discovery.

## Filesystem structure

```text
src/
  cli/
    index.ts                 # Executable, arguments, and output
    commands/                # init, update, discover
    prompts/                 # Setup wizard, preview approval, conflicts
  generator/
    resolve.ts               # Project defaults, language and UI selections, file scopes
    package-graph.ts         # Selected packages, workspaces, and Git boundaries
    plan.ts                  # Proposed files, dependencies, and conflicts
    apply.ts                 # File preflight, recovery, and writes
    install.ts               # Dependency reconciliation
    activate-hooks.ts        # Explicit Git hook activation
    state/                   # Saved selection and ownership validation
  components/
    registry.ts              # Explicit list of supported integrations
    projects/
      node.ts
      wordpress-site.ts
    languages/               # File scopes and coding standards
    ui/                      # Framework-specific file scopes and lint settings
    tools/                   # Tool definitions and renderers
  platform/
    filesystem.ts            # Safe paths, snapshots, and atomic writes
    git.ts                   # Repository boundaries, worktrees, and hook paths
    process.ts               # Commands, output, exit codes, and signals
    package-managers/
      composer.ts
      npm.ts
  contracts.ts               # Internal request, tool contribution, and plan types
tests/
  unit/
  integration/
  fixtures/
examples/                    # Representative selections and generated output
docs/                        # User guide and contributor guide for adding presets and tools
dist/                        # Compiled ESM and runtime templates for npm
```

Start with one module per small preset or tool. Add directories as integrations need more than one module. Keep static assets with the owning tool. Language definitions provide base file scopes and standards, and UI modules add framework-specific file scopes and settings. Resolve these and shared formatting settings once per package for reuse across tools and hooks. Let TypeScript reuse JavaScript standards and SCSS reuse CSS standards. Validate languages independently of standards so Go and Rust can use their toolchain defaults.

Tool renderers take resolved settings and return typed contributions for files, dependency requirements, scripts, ignore rules, hook checks, and competing config locations. Include alternate filenames and inline settings such as `package.json#prettier`. Keep renderers independent of live filesystem and process access. The planner combines contributions against the captured snapshot, reports incompatible contributions as conflicts, and returns a deterministic plan. Represent planned commands as an executable, argument array, and working directory. Platform adapters execute them and handle platform-specific executable resolution.

Use strict TypeScript and runtime schemas for external JSON. Set Node.js 24 as the CLI minimum. Build one ESM package, point the npm `configra` executable at `dist/cli/index.js`, and copy templates beside their compiled integrations. Pack runtime files, public schemas, README, changelog, and license. Set `publishConfig.access` to `public`. [npm package metadata](https://docs.npmjs.com/cli/configuring-npm/package-json/)

Parse arguments with Node's `parseArgs` and one command and option table that also drives help output and validation messages. Build the setup wizard with `@clack/prompts` and a custom step loop for revisiting answers. Define external JSON with TypeBox so the published JSON Schemas are the schemas Configra validates against. Run tests with Vitest, compile with `tsc` to per-file ESM output, and run child processes through `cross-spawn` for Windows executable resolution.

Run the every-PR gates in GitHub Actions on Linux, macOS, and Windows. Publish from GitHub Actions with npm trusted publishing and provenance. Before implementation starts, add an `AGENTS.md` for this repository with the commit policy, check commands, and pointers to both plan files. Configure this repository's own linting, formatting, and hooks by hand with the same files Configra generates, then switch to Configra-managed setup once milestone 3 works.

### Previous code

`dev/docs/references/previous-code/` holds the archived implementation. Port its useful fixtures, samples, and the findings in `dev/docs/references/previous-code/docs/issues.md` as the new code reaches each area. Keep it out of linting, tests, and the published package, and delete it before the first release.

## Implementation milestones

Milestones 1–4 build the standalone Node.js preset in steps that can each be tested and committed on their own.

1. **Plan and preview.** Build the command and option table, help output, selection normalization, package graph, resolver, and planner, with dry-run text and JSON output. Verify prompt-free JSON, identical normalized plans across differently named checkouts, and help output from the packed CLI.
2. **Apply and ownership.** Build file writes, ownership state, conflict decisions, the per-project lock, and the recovery journal. Verify clean creation, adoption of an existing project, ESM and CommonJS consumers, no-op reruns, repeated conflict decisions, and recovery after injected write failures.
3. **Install and hooks.** Build npm installation, Lefthook configuration, explicit hook activation, the generated commit-message script, and the commitlint option. Verify replay on a different checkout, a successful retry after installation failure, inactive hooks until activation, and the shared commit-message cases.
4. **Setup wizard.** Build the wizard's step loop, conflict prompts, the three outcomes, terminal approval for flag runs, and `--yes`. Verify the full flow in a real terminal, that canceling leaves the project untouched, and that save-only writes just `.configra.json`.
5. **WordPress site and first release.** Cover a full site checkout and a `wp-content` project. Exercise both layouts with a selected plugin and theme beside unselected ones. Verify that only selected directories are checked in either layout, inherited site defaults and a child override to community rules, nested child checks run from both the site root and the child directory, and safe cleanup when switching layouts or deselecting a directory. Test replay, clean npm and Composer installs, one aggregate visit per selected child, and staged routing through the shared hooks, and PHPStan in the `pre-push` hook. Verify that each entry file's overrides win over its Configra file, and that PHP_CodeSniffer reads `<file>` paths from the included `configra/phpcs.xml`. If it doesn't, pass the selected paths from the generated scripts and hooks instead. Verify batched PHP linting, including batches split for long file lists, the supported JavaScript, TypeScript, and React combinations, and CSS checks. Run the launch gates before publishing.
6. **Next release.** Continue with general nested projects, npm workspaces, and the remaining presets and integrations in [next-release-plan.md](next-release-plan.md#milestones-and-verification).

## Test and release gates

| When                                    | Required checks                                                                                                                                                                                                                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every PR                                | Type checking, linting, formatting, offline planner and CLI tests, and packed smoke tests on Linux, macOS, and Windows. Exercise the real installed `configra` executable or Windows shim from a clean consumer. Cover the minimum supported Node.js version.                    |
| When a preset or dependency set changes | Clean consumer installs using the generated manifests with the minimum and latest supported npm, Composer, and PHP versions. Run each affected check with passing and failing inputs. Verify the actual config the tool loads and exercise hook or build outputs where relevant. |
| Scheduled and before public releases    | Verify supported dependency ranges in a fresh consumer and repeat the documented quickstart. Use a real terminal for the wizard and real commits for hook activation, staged checks, and commit-message rules.                                                                   |

- Keep representative generated examples and compare normalized plans across equivalent projects in differently named checkout directories. Verify that adding a tooling manifest to an existing project or nested WordPress directory preserves how its JavaScript files run.
- Inject failures at each write boundary, including the final state write. Test concurrent runs, canceled previews, and recovery when affected files have since been edited. Include first generation, updates and removals, symlink and Git-boundary changes after planning, CRLF checkouts, permission preservation, matching user-owned content, conflict decisions on repeat runs, and invalid or unsupported schemas.
- Cover prompt, flag, and JSON equivalence, partial overrides, omitted and empty settings, `--cwd` with an alternate config, missing configs, and stdout isolation when validation or subprocess execution fails. Verify that save-only writes just `.configra.json` and dry runs and canceled previews leave the project untouched.
- Test bare `configra`, both help aliases, and each command's help through the packed CLI. Verify that each accepted flag appears with its purpose and supported values, that command help matches parser availability, and that help works outside a project.
- Test switching presets with `update`, such as `node` to `wordpress-site`, including removal of unchanged owned files the new preset no longer needs.
- Test preview parity, collisions with existing script names, reuse of compatible dependencies, and conflicts when an existing dependency cannot meet the selected tool's needs. Verify generation-only and requested-install behavior with missing target executables.
- Verify installation independently of generation and activation. Remove the last managed dependency, save the generated files, then reconcile on a separate run with no file changes. Repeat after a simulated install failure. Include a locked Composer app with an unrelated dependency that could be upgraded, a lifecycle script, and explicit plugin allow and deny settings. Use a fresh checkout with no Configra installed to run the generated checks after installing their dependencies.
- Confirm that `@cassidydc/configra` is available and publish the first release as `0.1.0`. Treat the CLI and JSON contract as changeable during `0.x` and record breaking changes in the changelog. Build the release tarball with `npm pack` and check its file list, public CLI entry point, schemas, and runtime templates. Test the quickstart from that artifact. Update `README.md` and `CHANGELOG.md`. Publish the same verified tarball as `@cassidydc/configra`. [Publishing a public scoped npm package](https://docs.npmjs.com/creating-and-publishing-an-organization-scoped-package/)

## Next release

The next release picks up the features deferred from launch. [next-release-plan.md](next-release-plan.md) holds the detailed behavior and verification for each item.

- **Repository layouts.** Extend opt-in nesting to projects beyond WordPress sites and support existing npm workspaces. Let users discover and select packages, override inherited settings, and run checks from the root or an individual package.
- **Project presets.** Add general PHP, Python, Go, and Rust presets, plus Laravel, Next.js, standalone web frontends, Django, Tauri, and Wails. Add Python installation through `uv` or `pip`, with Ruff and optional mypy.
- **Frontend tooling.** Add Vue and SCSS support, optional SCSS linting through Stylelint, and optional TypeScript checking with `tsc --noEmit`, type-aware lint rules, and a starter `tsconfig.json` where needed.
- **PHP compatibility.** Offer PHPCompatibility, or PHPCompatibilityWP for WordPress projects.
- **Build tooling.** Offer Vite and standalone Webpack setups, plus `@wordpress/build` and `@wordpress/scripts` for WordPress projects. Support Vite alongside a WordPress builder when they handle separate assets.
- **Editor and workflow options.** Add VS Code settings, a generated GitHub Actions quality workflow, and optional `.gitattributes` and `AGENTS.md` files.
- **Additional checks.** Offer Tombi for TOML, CSpell for spelling, ShellCheck and shfmt for shell scripts, SQLFluff for SQL, actionlint for GitHub Actions, Hadolint for Dockerfiles, and PSScriptAnalyzer for PowerShell.
