# Configra

Configra generates editable linting, formatting, and Git hook configuration for Node.js projects and WordPress sites. The generated checks run on their own, so a project keeps working without Configra installed.

## Quickstart

Configra needs Node.js 24.15 or later and npm 11 or later. Run it in the project you want to set up:

```sh
npx @cassidydc/configra init
```

In a terminal, `init` opens the setup wizard. To set up a project without prompts, pass the selections as flags:

```sh
npx @cassidydc/configra init --project node --languages javascript,typescript --install --install-hooks --yes
```

Preview any run without writing anything with `--dry-run`, as text or as one JSON document with `--json`. Run `configra --help` or `configra init --help` for every option. The [examples](https://github.com/CassidyDC/configra/tree/main/examples) show the generated files and JSON plan for representative selections.

## What Configra sets up

- **Presets:** Node.js projects and WordPress sites, with the WordPress or community coding standards, TypeScript, and React.
- **Tools:** EditorConfig, `.gitignore` rules, Prettier, markdownlint, ESLint, Stylelint, `php -l`, PHP_CodeSniffer, and PHPStan.
- **Scripts:** `lint` runs every read-only check, `lint:fix` applies fixes, and `format:check` and `format` run Prettier. Each tool also gets its own script, such as `lint:js`.
- **Git hooks:** Lefthook checks staged files before each commit, runs PHPStan before each push, and checks commit-message subjects.
- **Safe updates:** previews, ownership tracking, and conflict handling, so rerunning Configra never overwrites your changes.

The WordPress site preset and the PHP tools also need PHP 7.4 or later and Composer 2.7 or later.

Each tool gets two files. Configra owns the file in `.configra/`, such as `.configra/eslint.mjs`, and rewrites it when your selections change. Your project owns the tool's usual entry file, such as `eslint.config.js`. Configra creates it once to load its file, and your settings after that line win. Lefthook is the exception: Configra owns `lefthook.yml`, and your settings go in `lefthook-project.yml`, which overrides it.

## Usage

### Setup wizard

In a terminal, `configra init` with no saved config and no selection flags opens the setup wizard. It suggests a preset, languages, and UI from the project's files, and lets you accept the preset's defaults in one step or customize each choice. After the preview, choose an outcome:

- **Generate files** saves `.configra/config.json` and writes the tooling files.
- **Generate and install** also installs the declared dependencies.
- **Save config only** writes just `.configra/config.json`. Run `configra update` later to generate the files.
- **Change an answer** goes back to any earlier question.

The wizard asks how to settle each conflict and asks separately before activating Git hooks. Canceling, such as with Escape or Ctrl+C, leaves the project untouched and exits with code 130. Open the wizard for an existing setup with `configra update --interactive`.

Runs with selection flags or a saved config skip the wizard. In a terminal, they still show the preview, ask how to settle each conflict, and ask before writing. Pass `--yes` to approve without prompting and `--on-conflict retain` or `replace` to settle every conflict. Outside a terminal and with `--json`, a valid run writes without prompting, and unsettled conflicts exit with code 2.

### WordPress sites

`configra init --project wordpress-site` sets up root tooling for a site that checks only the plugin and theme directories you select. WordPress core, unselected plugins and themes, and other third-party code stay out of every check.

```sh
configra init --project wordpress-site --package wp-content/plugins/example --package wp-content/themes/example
```

- Configra treats the target as a full site when it contains `wp-includes/` or `wp-config.php`, and as a `wp-content` directory when it has `plugins/` or `themes/` at the root. The wizard suggests the directories it finds and asks where they are when the layout is unclear. Select a single-file must-use plugin by its file path.
- The PHP tools check only selected directories, so they need at least one. Without a selection, the other checks cover only the site's own root files.
- `php -l` runs through `.configra/scripts/php-lint.mjs`, which checks many files per run on PHP 8.3 and later and one file at a time on earlier versions, which otherwise check only the first file. `php -l` checks syntax for the PHP version that runs it, not for the site's minimum version. PHPStan's target version and the WordPress Coding Standards minimum narrow that gap.
- PHP_CodeSniffer and PHPStan run through `.configra/scripts/php-tool.mjs`, which runs Composer's `vendor/bin` scripts with `php` so they work the same way on Windows. PHPStan runs in the `pre-push` hook and in `lint`, and analyses the working tree, so uncommitted changes can affect the result.
- Configra reads `Requires PHP`, `Requires at least`, and `Text Domain` from each selected plugin and theme, suggests a prefix from its directory name, and saves the results in `.configra/config.json`, where you can change them. PHPStan targets the lowest declared PHP version and scans the unselected plugins and themes so it can resolve their functions and classes without reporting on them.
- Composer runs with `--no-scripts`. With an existing `composer.lock`, Configra updates only the packages it manages with `--minimal-changes`, so unrelated locked versions stay put. The WordPress standard needs Composer to allow `dealerdirect/phpcodesniffer-composer-installer`. Configra adds that entry to `config.allow-plugins`, keeps an existing denial, and checks that PHP_CodeSniffer lists the standard after installing.

### Installing dependencies and activating hooks

Configra declares the tools as development dependencies in `package.json`. It installs them only with `--install` and activates Git hooks only with `--install-hooks`:

```sh
configra init --install --install-hooks
```

- Installation runs `npm install --ignore-scripts --no-audit --no-fund`, so no lifecycle script runs and Lefthook's postinstall can't activate hooks. When the PHP tools are selected, Composer runs next. If either fails, the generated files stay in place and `configra update --install` retries it.
- Configra installs JavaScript dependencies with npm only. In a project that uses another package manager, it still generates the files, and you install the declared dependencies with that package manager.
- When the project is a member of an npm workspace, npm would install in the workspace root, so `--install` stops before writing. Run Configra from the workspace root instead.
- Hook activation runs `npx --no -- lefthook install`. It needs a Git repository whose root is the project, Lefthook installed or installed by the same run, and no existing hooks or `core.hooksPath` from another hook manager.

Hooks stay inactive until someone activates them. After cloning a project that Configra set up, collaborators run:

```sh
npm ci --ignore-scripts
composer install --no-scripts  # When the PHP tools are selected
npx lefthook install
```

The generated checks work with lifecycle scripts disabled. Put personal hook settings in `lefthook-local.yml`, which overrides both `lefthook.yml` and `lefthook-project.yml`. Running `lefthook run` by hand also installs the hooks as a side effect, so the generated scripts don't use it.

The `pre-commit` hook checks only the staged content of each file, and the `commit-msg` hook validates the subject line. If you remove Lefthook from the selected tools, the installed hooks keep passing without their config, and `npx lefthook uninstall` removes them.

See [refactor-plan.md](dev/docs/plans/refactor-plan.md) for the full first-release plan and [next-release-plan.md](dev/docs/plans/next-release-plan.md) for what follows.

### Saved selections and updates

`.configra/config.json` holds your selections and is the file to edit. `.configra/state.json` records which files, lines, and fields Configra owns. Commit both with the generated files, so another checkout can update them safely.

- `configra update` reapplies the saved selections, and its flags change them. It previews changes to files you've edited as conflicts instead of overwriting them.
- `configra update --dry-run --exit-code` exits with code 3 when the generated files have drifted from the selections, so CI can catch it.
- On a fresh checkout that committed only `.configra/config.json`, `configra update --install` regenerates the files, recreates the state, and installs the tools. Use the same Configra release and commit your lockfiles for repeatable results.

To stop using Configra, delete `.configra/config.json` and `.configra/state.json`. The generated files keep working as ordinary project files. The rest of `.configra/` can stay where it is, or you can rename it along with the import lines in the entry files.

## Known issues

### npm peer warnings with the WordPress ESLint setup

The WordPress JavaScript standard uses ESLint 10 with [`@wordpress/eslint-plugin`](https://www.npmjs.com/package/@wordpress/eslint-plugin). ESLint 9 reached [end of life](https://eslint.org/version-support/) on 2026-08-06. The plugin supports ESLint 10, but its `recommended` config bundles three plugins whose published peer ranges still stop at ESLint 9:

| Bundled plugin                                                                          | Used for                                                        | Upstream ESLint 10 work                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`eslint-plugin-react`](https://github.com/jsx-eslint/eslint-plugin-react) 7.37.5       | React rules such as `react/jsx-key`                             | Issue [#3977](https://github.com/jsx-eslint/eslint-plugin-react/issues/3977), pull request [#4022](https://github.com/jsx-eslint/eslint-plugin-react/pull/4022)                                                                                    |
| [`eslint-plugin-import`](https://github.com/import-js/eslint-plugin-import) 2.32.0      | Import checks such as `import/no-unresolved` and `import/named` | Support merged in [#3230](https://github.com/import-js/eslint-plugin-import/pull/3230), waiting for a release ([#3278](https://github.com/import-js/eslint-plugin-import/issues/3278))                                                             |
| [`eslint-plugin-jsx-a11y`](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y) 6.10.2 | Accessibility rules such as `jsx-a11y/alt-text`                 | Issue [#1075](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/issues/1075), pull requests [#1081](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/pull/1081) and [#1079](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/pull/1079) |

The `recommended` config loads all three for every WordPress setup, with or without React. As a result:

- `npm install` succeeds but prints `npm warn ERESOLVE overriding peer dependency`.
- `npm ls` reports `eslint@10 invalid` for those three plugins.

The warnings don't affect linting. The WordPress plugin wraps the React and import plugins in a compatibility layer, the accessibility plugin uses no removed ESLint APIs, and the React rule with a known ESLint 10 crash ([#3970](https://github.com/jsx-eslint/eslint-plugin-react/issues/3970)) is turned off. ESLint 10 and ESLint 9 report the same problems on the same files. Configra doesn't add npm `overrides` to hide the warnings. They will go away once the three plugins publish ESLint 10 support and `@wordpress/eslint-plugin` picks up those releases.

### Stylelint 17 for WordPress CSS

The WordPress CSS standard uses Stylelint 17, while the community CSS standard uses Stylelint 18. The latest [`@wordpress/stylelint-config`](https://www.npmjs.com/package/@wordpress/stylelint-config), 27.2.0, requires Stylelint 17, and npm refuses to install it with Stylelint 18. Configra moves WordPress CSS to Stylelint 18 once a release supports it, which [Gutenberg PR #87149](https://github.com/WordPress/gutenberg/pull/87149) is working toward.

## Development

```sh
npm ci
npm run lint
npm run format:check
npm run hooks:install
```

See [AGENTS.md](AGENTS.md) for the commit policy and code conventions.

## License

[MIT](LICENSE)
