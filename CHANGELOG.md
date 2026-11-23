# Changelog for Configra

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). The CLI and JSON contract may change between `0.x` releases, and breaking changes are listed here.

## [0.1.0] - Unreleased

### Added

- Plan the first release and the next release of the rebuilt CLI.
- Add repository configuration for EditorConfig, ESLint, Prettier, markdownlint, Lefthook, and VS Code.
- Add type checking, Vitest, the `tsc` build, a packed smoke test, and a CI matrix on Linux, macOS, and Windows.
- Record the milestone 1 spike results in the first-release plan, including a tool version per coding standard and PHP 7.4 as the minimum.
- Use ESLint 10 for the WordPress standard and document its known npm peer warnings in the README.
- Raise the Node.js minimum to 24.15, which Stylelint 18 requires, and keep WordPress CSS on Stylelint 17 until its config supports 18.
- Add the command and option table, help output, selection normalization, the resolver, and the planner for the Node.js preset, with JavaScript, TypeScript, and React coverage.
- Preview plans with `--dry-run` as text or one versioned JSON document, and exit with code 3 for pending changes with `--exit-code`.
- Publish JSON Schemas for saved selections and machine-readable output, plus generated examples under `examples/`.
- Ship tested dependency ranges generated from fixture manifests that Dependabot keeps current.
- Apply plans: write files atomically under a per-project lock, record ownership state last, and settle conflicts with `--on-conflict retain` or `replace`. Unresolved conflicts exit with code 2 without writing.
- Finish an interrupted run by rerunning: Configra adopts the files the earlier run wrote that match the new plan and reports the rest as conflicts.
- Base a fresh manifest's module type only on files whose module system follows `package.json#type`.
- Install the declared dependencies with `--install`, using npm with lifecycle scripts disabled, and retry a failed install with `configra update --install`.
- Activate the Git hooks with `--install-hooks` after checking for a Git root, an available Lefthook binary, and hooks from other hook managers.
- Stop before writing when `--install` would run outside the project, such as in an enclosing npm workspace root, or with a package manager other than npm.
- Suggest `npx lefthook uninstall` when a plan removes `lefthook.yml` while its hooks are installed.
- Add clean consumer install tests for each JavaScript, TypeScript, and React combination with `npm run test:consumer`.
- Manage this repository's EditorConfig, Prettier, markdownlint, ESLint, and Lefthook setup with Configra.
- Add the setup wizard to `configra init` and `configra update --interactive`, with suggestions from the project's files, a Change an answer step, and the Generate files, Generate and install, and Save config only outcomes.
- Show the preview in a terminal, ask how to settle each conflict, and ask for approval before writing. Canceling or declining exits with code 130 and writes nothing.
- Add the WordPress site preset with Stylelint, `php -l`, PHP_CodeSniffer, and PHPStan. Checks cover only the selected plugin and theme directories, and PHPStan scans the unselected ones for symbols.
- Read each selected plugin and theme's PHP and WordPress versions and text domain, suggest prefixes, and save them in `.configra/config.json`. The wizard asks to confirm them.
- Install the PHP tools with Composer after npm, updating only the managed packages when a lockfile exists, and check that PHP_CodeSniffer registered the WordPress standard.
- Add generated helpers that batch `php -l` on PHP 8.3 and later and run Composer-installed tools the same way on every platform.
- Add a release workflow that tests the packed tarball in a clean consumer and publishes that same file with npm trusted publishing and provenance.

### Fixed

- Anchor the generated `/phpcs.xml` and `/phpstan.neon` ignore lines to the root, so they no longer ignore the managed `.configra/phpcs.xml` and `.configra/phpstan.neon`.
- Record owned ignore lines in their planned order, so an update that appends lines doesn't change the ownership state again on the next run.
