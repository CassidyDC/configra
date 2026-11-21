# Rebuild Configra as a public npm CLI

## Launch features

Publish `@cassidydc/configra` for developers who want to set up linting, formatting, and Git hooks in new or existing projects. Configra generates editable files and declares the required development dependencies. The generated checks run independently of Configra.

| Feature            | First release                                                                                                                                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project presets    | Node.js, PHP, Python, Go, Rust, Laravel, Next.js, standalone web frontends, Django, Tauri, Wails, and WordPress sites, plugins, and themes. Offer React, TypeScript, and Vue as selectable capabilities and community or WordPress standards where applicable. |
| Tooling            | EditorConfig, Prettier, Markdownlint, and `.gitignore` as the baseline. Add ESLint for JavaScript and TypeScript, Stylelint for CSS, and `php -l`, PHP_CodeSniffer, and PHPStan for PHP. Offer VS Code and opt-in build tooling.                               |
| Repository layouts | Standalone projects, explicitly selected nested packages, and existing npm workspaces. Discovery suggests packages for the user to select.                                                                                                                     |
| Git hooks          | Lefthook runs checks on staged paths. The `commit-msg` hook defaults to plain sentence-case subjects and offers Conventional Commits or validation off. Release automation stays outside launch scope.                                                         |
| Installation       | npm for JavaScript tooling, Composer for PHP tooling, and uv or pip for Python tooling. The interactive flow previews file changes, dependency installation, and hook activation for approval. Scripts opt into installation and activation separately.        |

### Framework and application presets

- **Laravel (`laravel`).** Use `php -l` for syntax and Laravel Pint for PHP style checks and explicit fixes. Reuse Laravel's existing Vite config for frontend assets. Offer PHPStan with Larastan for opt-in Laravel-aware analysis. [Laravel Pint](https://laravel.com/docs/13.x/pint) · [Laravel Vite](https://laravel.com/docs/13.x/vite) · [Larastan](https://github.com/larastan/larastan)
- **Next.js (`nextjs`).** Generate an ESLint flat config using `eslint-config-next/core-web-vitals` and add `eslint-config-next/typescript` when TypeScript is selected. Run lint through the ESLint CLI and retain the project's Next.js development and build commands. [Next.js ESLint setup](https://nextjs.org/docs/app/api-reference/config/eslint)
- **Standalone web frontend (`web-frontend`).** Configure browser globals and frontend asset checks for vanilla JavaScript or TypeScript, with React and Vue as selectable capabilities. Suggest Vite when the user opts into a build setup. [Vite project templates](https://vite.dev/guide/)
- **Django (`django`).** Reuse Ruff and the selected `uv` or `pip` workflow. Run `manage.py check` with the project's Python environment and settings. Offer `django-stubs` when the user enables Django-aware mypy checking. [Django system checks](https://docs.djangoproject.com/en/dev/topics/checks/) · [Django stubs](https://github.com/typeddjango/django-stubs)
- **Tauri (`tauri`).** Reuse the web frontend tooling for the app's JavaScript or TypeScript and run Rust formatting and optional Clippy in `src-tauri/`. Respect the project's Tauri build commands and frontend configuration. [Tauri frontend setup](https://v2.tauri.app/start/frontend/)
- **Wails (`wails`).** Run Go formatting and optional `go vet` in the app's Go module. Reuse the web frontend tooling in the app's frontend directory, typically `frontend/`. Exclude generated Wails bindings from frontend lint and format checks and respect the project's Wails build commands. [Wails project structure](https://wails.io/guides/dev/project-structure/)

### JavaScript and PHP checks

- Default each `package.json` that Configra creates to `"type": "module"`. Preserve the module behavior of existing manifests.
- Choose generated config filenames using the planned package manifest. Prefer `.js` for ESM configuration when the manifest declares `"type": "module"`. Use `.mjs` to declare ESM explicitly in CommonJS projects and projects without an explicit module type. Reserve `.cjs` for tools that require CommonJS.
- Use the latest stable ESLint release with flat config in `eslint.config.js` or `eslint.config.mjs`, following the target package's module type. Verify compatible dependency ranges for each generated preset when updating the ESLint version.
- Use `@eslint-react/eslint-plugin` and React's `eslint-plugin-react-hooks` for the community React setup on ESLint 10 and later. Use the official WordPress ESLint preset for the WordPress standard and verify its React and TypeScript combination separately.
- Use native `php -l` for staged and full-project syntax checks. Batch files with PHP 8.3 or later and check one file per invocation with older interpreters. Keep PHP_CodeSniffer for the selected PHP coding standard and PHPStan for static analysis.

### Python setup

- Use Ruff for linting and formatting with shared settings across both installation paths. Support existing Ruff settings in `pyproject.toml` or a standalone Ruff config. Choose the default location for new Ruff configuration before implementing the preset.
- Offer mypy as an opt-in for static type checking. Use `pyproject.toml` or `mypy.ini` for settings, respect the project's existing configuration, and install mypy as a development dependency through the selected Python installer.
- Recommend `uv` for fresh setups and use the existing `uv` workflow when the project has a `uv.lock`. Declare Ruff in the development dependency group and let `uv` manage the lockfile and virtual environment when installation is approved.
- Offer `pip` for an existing virtual environment selected by the user. Install through that environment's Python interpreter and follow the project's development requirements workflow when present. When the installation workflow is unclear, offer configuration generation and request a choice before installing.

### Optional integrations

- **SCSS.** Format SCSS with Prettier. Offer SCSS linting as a separate opt-in that adds the necessary Stylelint configuration and dependencies for `.scss` files.
- **TypeScript.** Offer an opt-in `typecheck` script that runs `tsc --noEmit` using the project's `tsconfig.json`. Offer to generate a starter `tsconfig.json` when the project lacks one. Use the existing config when present.
- **Vue.** Offer an opt-in Vue capability that adds `eslint-plugin-vue` to the generated ESLint config for `.vue` components. Support JavaScript and TypeScript in Vue components, and include `.vue` files in the formatter when Prettier is selected.
- **WordPress builds.** Offer `@wordpress/build` as the default when WordPress build setup is selected and the project meets its layout and WordPress version requirements. Offer `@wordpress/scripts` as a selectable option and as the default for projects that require its Webpack-based block build. Preserve an existing builder selection on update unless the user chooses to switch. Keep standalone Webpack setup available as an independent option. [WordPress build](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-wp-build/) · [WordPress scripts](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-scripts/)
- **WordPress Webpack configuration.** For `@wordpress/scripts`, generate an editable `webpack.config.js` or `webpack.config.mjs` based on the target package's module type. Import the default export from `@wordpress/scripts/config/webpack.config.js` and add the selected project overrides. Preserve upstream block entry discovery, dependency extraction, and asset metadata. Apply each override to its intended config whether WordPress exports one config or separate script and module configs. Pass the generated filename explicitly with `--config` to both `wp-scripts build` and `wp-scripts start`. [Extending the WordPress Webpack config](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-scripts/#extending-the-webpack-config)
- **Vite.** Offer an opt-in Vite build for standalone web frontends and independent frontend assets in WordPress themes and plugins. In a mixed WordPress setup, give Vite its own npm scripts, entry points, and output directory. Use Vite's manifest to enqueue its assets and preserve the WordPress builder's metadata and registration flow. [Vite backend integration](https://vite.dev/guide/backend-integration.html)
- **TOML.** Offer opt-in Tombi formatting and validation for `.toml` files such as `pyproject.toml`, `Cargo.toml`, and `ruff.toml`. Generate `tombi.toml` for project settings and surface an existing Taplo setup in the preview before switching tools.
- **Spelling.** Offer opt-in CSpell for documentation and source files. Generate `cspell.json` with file scope and a shared project vocabulary.
- **Bash and POSIX shell.** Offer opt-in ShellCheck linting and `shfmt` formatting for shell scripts. Generate `.shellcheckrc` and add shell formatting settings to `.editorconfig`.
- **SQL.** Offer opt-in SQLFluff linting and formatting for `.sql` files. Generate `.sqlfluff` using a dialect the user selects, such as MySQL, PostgreSQL, or SQLite.
- **Go and Rust.** Offer each as an independently selectable standalone preset. Wire `gofmt` and `rustfmt` into their respective project checks and Git hooks. Offer `go vet ./...` and `cargo clippy` as opt-ins for full local and CI checks.
- **GitHub Actions.** Offer a `.github/workflows/quality.yml` workflow that runs the generated project checks on pull requests. Offer `actionlint` as a separate option for checking workflow files.
- **Dockerfiles.** Offer Hadolint for existing Dockerfiles and generate `.hadolint.yaml` for project-specific rules.
- **PowerShell.** Offer PSScriptAnalyzer for PowerShell scripts and generate `PSScriptAnalyzerSettings.psd1` for project-specific rules.
- **Git line endings.** Offer a root `.gitattributes` file as an opt-in. Show the proposed line-ending rules in the preview and preserve unrelated attributes already present in the file.

## CLI and safe updates

- Keep `configra init`, `configra update`, and `configra discover`, plus `--help` and `--version`. Support `--cwd`, `--config`, and selection flags for project type, layout, packages, languages, capabilities, standards, and tools. Use `--commit-messages plain|conventional|off`, `--install`, and `--install-hooks`. `--dry-run --json` emits a versioned plan containing changes, conflicts, diagnostics, and proposed commands without writing files or running installers. The CLI and documented JSON are the public interfaces.
- Normalize prompts, flags, and saved selections into the same typed project request. Resolve selections and package ownership, render a plan without writes, then preflight and apply it.
- Generate one hook configuration at the Git root. Allow generating hook configuration before Git initialization, but require an existing Git root for activation. Run target npm installs with lifecycle scripts disabled so Lefthook’s postinstall cannot activate hooks before approval. Activate hooks explicitly without replacing other hook managers or custom hook paths. [Lefthook installation behavior](https://lefthook.dev/usage/commands/install/)
- Store choices in `.configra.json` and ownership in `.configra-state.json`, both at schema version `2`. Reject legacy metadata with fresh-setup instructions. Preserve unrelated manifest entries and leave matching pre-existing content unowned. Update or remove unchanged owned content automatically. Require an explicit interactive decision for each conflict, and stop before writes on unresolved conflicts in noninteractive runs.
- Recheck file snapshots and Git boundaries before applying, preserve file permissions, and write ownership state last. Report file, installation, and hook failures separately. Keep successfully generated files after an install failure so users can retry without recreating them.

## Package settings and ownership

- Let `--config` set standards and formatting per language and per package. Children inherit applicable settings from their nearest selected parent. Explicit child standards merge by language, and explicit child tool and capability lists replace the inherited lists. A WordPress site can use WordPress defaults while a selected plugin uses community JavaScript rules.
- Use a package graph to track selected package roots, their relationships, workspace membership, and Git boundaries. Keep dependencies and local scripts in the owning package. Exclude selected child directories from parent-local checks and have aggregate checks delegate to each child once. Use paths for independent nested packages and exact registered names for npm workspaces. Route staged paths to their owning package through the same graph.

## Filesystem structure

```text
src/
  cli/
    index.ts                 # Executable, arguments, and output
    commands/                # init, update, discover
    prompts/                 # Selections, preview approval, conflicts
  generator/
    resolve.ts               # Presets, capabilities, and explicit choices
    package-graph.ts         # Selected packages, workspaces, and Git boundaries
    plan.ts                  # Proposed files, dependencies, and conflicts
    apply.ts                 # Preflight, writes, installation, activation
    layouts/                 # Standalone, nested, npm workspaces
    state/                   # Selection and ownership schemas
  components/
    registry.ts              # Explicit list of supported integrations
    projects/
      go/
        index.ts
        wails.ts
      javascript/
        node.ts
        nextjs.ts
        web-frontend.ts
      php/
        index.ts            # General PHP preset
        laravel.ts
        wordpress/
          plugin.ts
          site.ts
          theme.ts
      python/
        index.ts            # General Python preset
        django.ts
      rust/
        index.ts
        tauri.ts
    capabilities/
      react.ts
      scss.ts
      typescript.ts
      vue.ts
    standards/
      css/
        community.ts
        wordpress.ts
      javascript/
        community.ts
        wordpress.ts
      php/
        community.ts
        wordpress.ts
      python/
        community.ts
    tools/
      actionlint/
        index.ts
      clippy/
        index.ts
      commitlint/
        index.ts
      cspell/
        index.ts
      django-check/
        index.ts
      editorconfig/
        index.ts
      eslint/
        index.ts
      gitattributes/
        index.ts
      github-actions/
        index.ts
      gitignore/
        index.ts
      go-vet/
        index.ts
      gofmt/
        index.ts
      hadolint/
        index.ts
      lefthook/
        index.ts
      markdownlint/
        index.ts
      mypy/
        index.ts
      php-lint/
        index.ts             # Native php -l
      phpcs/
        index.ts
      phpstan/
        index.ts
      pint/
        index.ts
      prettier/
        index.ts
        options.ts
      psscriptanalyzer/
        index.ts
      ruff/
        index.ts
      rustfmt/
        index.ts
      shellcheck/
        index.ts
      shfmt/
        index.ts
      sqlfluff/
        index.ts
      stylelint/
        index.ts
      tombi/
        index.ts
      typescript/
        index.ts             # Optional typecheck and starter tsconfig.json
      vite/
        index.ts
      vscode/
        index.ts
      webpack/
        index.ts
        templates/
          webpack.config.js
      wordpress-build/
        index.ts
      wordpress-scripts/
        index.ts
        templates/
          webpack.config.js  # Extends the WordPress config
  platform/
    filesystem.ts            # Safe paths, file snapshots, and atomic writes
    git.ts                   # Repository boundaries, worktrees, and hook paths
    process.ts               # Command execution, output, exit codes, and signals
    package-managers/
      composer.ts            # Composer dependency and lockfile operations
      npm.ts                 # npm dependency installs and workspace lookup
      python/
        environment.ts       # Selected virtual environment and Python interpreter
        pip.ts               # Installs into the selected virtual environment
        uv.ts                # Development dependencies and lockfile sync
  contracts.ts               # Internal request, tool contribution, and plan types
tests/
  unit/
  integration/
  fixtures/
examples/                    # Representative selections and generated output
docs/                        # User guide and tool authoring guide
dist/                        # Compiled ESM and runtime templates for npm
```

Each tool's `index.ts` holds its metadata and renderer. The renderer takes resolved package settings and returns typed contributions for configuration files, dependencies, scripts, ignore rules, and hook requirements. Keep static assets in the owning tool's `templates/` directory. The generator combines contributions, and platform adapters handle writes and process execution. Resolve shared formatting settings once for EditorConfig, formatters, and linters. Report incompatible combinations during preview.

Use strict TypeScript and retain Node.js 24 as the minimum. Build one ESM package, point the npm `configra` executable at `dist/cli/index.js`, and copy templates beside their compiled integrations so they work from an installed tarball. Pack runtime files, README, changelog, and license. Set `publishConfig.access` to `public`. [npm package metadata](https://docs.npmjs.com/cli/configuring-npm/package-json/)

## Implementation and release checks

1. Build the CLI, planner, and safe-update flow around a standalone Node.js project. Verify dry runs, idempotent reruns, legacy metadata rejection, conflict handling, and protection of user edits and nested Git repositories. Verify that a newly generated `package.json` declares `"type": "module"` and that the corresponding ESM config uses `.js`.
2. Generate one standalone WordPress plugin under both WordPress and community standards. Verify clean npm and Composer installs and run the generated checks with both standards. Verify `.js` config loading in ESM consumer projects and `.mjs` fallback in CommonJS projects and projects without a declared module type. Exercise native PHP syntax checking with and without multi-file support. Build one compatible WordPress fixture with `@wordpress/build` and another with `@wordpress/scripts` using the generated Webpack config. Verify that the overrides apply and both the single-config and multi-config builds retain WordPress asset metadata.
3. Add nested packages, npm workspaces, the remaining project presets, and optional integrations.
   - Test inheritance and per-language overrides in a WordPress site with a plugin and theme. Verify that parent-local checks exclude selected children, aggregate checks visit each selected child once, and staged paths go to their owning package.
   - Build a standalone frontend with Vite. In a mixed WordPress fixture, run Vite and `wp-scripts build` in both orders and verify that each preserves the other build's outputs and metadata.
   - Exercise the framework presets in fixtures. Run Pint and optional Larastan for Laravel, lint a Next.js TypeScript project with its flat config, and run Django system checks with optional framework-aware mypy.
   - Verify Tauri and Wails in desktop fixtures. Route frontend and native checks to their respective package directories, skip generated Wails bindings, and combine the checks under one Git hook configuration when both directories share a repository.
   - Verify dependency removal and retry and generated checks for each preset. Run clean npm installs and JSX, TSX, and Vue lint fixtures against the current ESLint release. Test Ruff and opt-in mypy through both Python installation paths, including `uv` lockfile updates and `pip` installation into the selected environment.
   - Exercise shell, Dockerfile, and PowerShell checks, SQL dialect selection, and Go and Rust formatting and opt-in analysis in fixtures. Check Tombi formatting and validation and verify that CSpell respects the project vocabulary. Validate the generated GitHub Actions workflow with `actionlint` and verify that it runs the same checks as the corresponding local setup.
   - Check that optional setups appear only when selected and preserve existing `tsconfig.json` and unrelated Git attributes. Use real test repositories to verify that installation leaves hooks inactive, activation works, staged checks run, and both commit-message presets accept and reject representative messages.
4. Run `npm pack`, install the tarball into a clean consumer, and test the CLI and packaged templates. Verify the packed CLI on Linux, macOS, and Windows. Update `README.md` and `CHANGELOG.md`, and commit each completed implementation task using the repository’s existing commit style. Check the registry before choosing the release version, and publish the verified artifact under the existing scope. [Publishing a public scoped npm package](https://docs.npmjs.com/creating-and-publishing-an-organization-scoped-package/)
