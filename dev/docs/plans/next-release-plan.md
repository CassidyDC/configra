# Configra next-release plan

This plan covers the presets, layouts, and integrations deferred from the first release in [refactor-plan.md](refactor-plan.md). Use the same preview, ownership, and installation flow for these additions and verify them in clean consumer fixtures before publishing. Presets for other ecosystems still get the root `package.json` for Lefthook and the root scripts, and use EditorConfig and `.gitignore` alongside their own toolchains.

## Repository layouts

- Extend opt-in nesting to projects beyond WordPress sites and support existing npm workspaces. Let users discover and select packages, override inherited settings, and run checks from the root or an individual package.
- Use paths for independent nested packages and exact registered names for npm workspaces. Validate duplicate names across all registered workspaces, including unselected ones.

## Project presets

### Language presets

- **PHP (`php`).** Use `php -l`, PHP_CodeSniffer with the community standard, and PHPStan, installed through Composer.
- **Python (`python`).** Use Ruff and optional mypy, installed through `uv` or `pip` as described in [Python setup](#python-setup).
- **Go (`go`).** Wire `gofmt` into project checks and Git hooks. Offer `go vet ./...` as an opt-in for full local and CI checks.
- **Rust (`rust`).** Wire `rustfmt` into project checks and Git hooks. Offer `cargo clippy` as an opt-in for full local and CI checks.

### Framework and application presets

- **Laravel (`laravel`).** Use `php -l` for syntax and Laravel Pint for PHP style checks and explicit fixes. Reuse Laravel's existing Vite config for frontend assets. Offer PHPStan with Larastan for opt-in Laravel-aware analysis. [Laravel Pint](https://laravel.com/docs/13.x/pint) · [Laravel Vite](https://laravel.com/docs/13.x/vite) · [Larastan](https://github.com/larastan/larastan)
- **Next.js (`nextjs`).** Enable React as part of the preset. Generate an ESLint flat config using `eslint-config-next/core-web-vitals` and add `eslint-config-next/typescript` when TypeScript is selected. Run lint through the ESLint CLI and retain the project's Next.js development and build commands. [Next.js ESLint setup](https://nextjs.org/docs/app/api-reference/config/eslint)
- **Standalone web frontend (`web-frontend`).** Configure browser globals and frontend asset checks for JavaScript or TypeScript. Offer React and Vue as UI choices and suggest Vite when the user opts into a build setup. [Vite project templates](https://vite.dev/guide/)
- **Django (`django`).** Reuse Ruff and the selected `uv` or `pip` workflow. Run `manage.py check` with the project's Python environment and settings. Offer `django-stubs` when the user enables Django-aware mypy checking. [Django system checks](https://docs.djangoproject.com/en/dev/topics/checks/) · [Django stubs](https://github.com/typeddjango/django-stubs)
- **Tauri (`tauri`).** Reuse the web frontend tooling for the app's JavaScript or TypeScript and run Rust formatting and optional Clippy in `src-tauri/`. Respect the project's Tauri build commands and frontend configuration. [Tauri frontend setup](https://v2.tauri.app/start/frontend/)
- **Wails (`wails`).** Run Go formatting and optional `go vet` in the app's Go module. Reuse the web frontend tooling in the app's frontend directory, typically `frontend/`. Exclude generated Wails bindings from frontend lint and format checks and respect the project's Wails build commands. [Wails project structure](https://wails.io/guides/dev/project-structure/)

### Python setup

- Use Ruff for linting and formatting with shared settings across both installation paths. Support existing Ruff settings in `pyproject.toml` or a standalone Ruff config. Choose the default location for new Ruff configuration before implementing the preset.
- Offer mypy as an opt-in for static type checking. Use `pyproject.toml` or `mypy.ini` for settings, respect the project's existing configuration, and install mypy as a development dependency through the selected Python installer.
- Recommend `uv` for fresh setups and use the existing `uv` workflow when the project has a `uv.lock`. Declare Ruff in the development dependency group and let `uv` manage the lockfile and virtual environment when installation is approved.
- Offer `pip` for an existing virtual environment selected by the user. Install through that environment's Python interpreter and follow the project's development requirements workflow when present. When the installation workflow is unclear, offer configuration generation and request a choice before installing.

## Optional integrations

- **Vue.** Add Vue as a UI choice. Cover `.vue` files and support JavaScript and TypeScript script blocks through `eslint-plugin-vue`. Include Vue components in formatting when Prettier is selected.
- **SCSS.** Add SCSS as a language choice that reuses CSS standards. Format selected SCSS files with Prettier. Offer SCSS linting as a separate opt-in that adds the necessary Stylelint configuration and dependencies for `.scss` files.
- **TypeScript.** Offer an opt-in `typecheck` script that runs `tsc --noEmit` using the project's `tsconfig.json`, along with type-aware lint rules. Offer to generate a starter `tsconfig.json` when the project lacks one. Use the existing config when present.
- **PHP compatibility.** Offer PHPCompatibility, or PHPCompatibilityWP for WordPress projects, checked against the minimum PHP version recorded in saved selections.
- **WordPress builds.** Offer `@wordpress/build` as the default when WordPress build setup is selected and the project meets its layout and WordPress version requirements. Offer `@wordpress/scripts` as a selectable option and as the default for projects that require its Webpack-based block build. Preserve an existing builder selection on update unless the user chooses to switch. Keep standalone Webpack setup available as an independent option. [WordPress build](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-wp-build/) · [WordPress scripts](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-scripts/)
- **WordPress Webpack configuration.** For `@wordpress/scripts`, generate an editable `webpack.config.js` or `webpack.config.mjs` based on the target package's module type. Import the default export from `@wordpress/scripts/config/webpack.config.js` and add the selected project overrides. Preserve upstream block entry discovery, dependency extraction, and asset metadata. Apply each override to its intended config whether WordPress exports one config or separate script and module configs. Pass the generated filename explicitly with `--config` to both `wp-scripts build` and `wp-scripts start`. [Extending the WordPress Webpack config](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-scripts/#extending-the-webpack-config)
- **Vite.** Offer an opt-in Vite build for standalone web frontends and independent frontend assets in WordPress themes and plugins. In a mixed WordPress setup, give Vite its own npm scripts, entry points, and output directory. Use Vite's manifest to enqueue its assets and preserve the WordPress builder's metadata and registration flow. [Vite backend integration](https://vite.dev/guide/backend-integration.html)
- **VS Code.** Offer `.vscode/settings.json` and `.vscode/extensions.json` with formatter, linter, and file-association settings and extension recommendations for the selected tools. Merge into existing JSONC files with format-aware edits and own only the keys Configra adds.
- **GitHub Actions.** Offer a `.github/workflows/quality.yml` workflow that runs the generated project checks on pull requests. Offer `actionlint` as a separate option for checking workflow files.
- **Git line endings.** Offer a root `.gitattributes` file as an opt-in. Show the proposed line-ending rules in the preview and preserve unrelated attributes already present in the file.
- **TOML.** Offer opt-in Tombi formatting and validation for `.toml` files such as `pyproject.toml`, `Cargo.toml`, and `ruff.toml`. Generate `tombi.toml` for project settings and surface an existing Taplo setup in the preview before switching tools.
- **Spelling.** Offer opt-in CSpell for documentation and source files. Generate `cspell.json` with file scope and a shared project vocabulary.
- **Bash and POSIX shell.** Offer opt-in ShellCheck linting and `shfmt` formatting for shell scripts. Generate `.shellcheckrc` and add shell formatting settings to `.editorconfig`.
- **SQL.** Offer opt-in SQLFluff linting and formatting for `.sql` files. Generate `.sqlfluff` using a dialect the user selects, such as MySQL, PostgreSQL, or SQLite.
- **Dockerfiles.** Offer Hadolint for existing Dockerfiles and generate `.hadolint.yaml` for project-specific rules.
- **PowerShell.** Offer PSScriptAnalyzer for PowerShell scripts and generate `PSScriptAnalyzerSettings.psd1` for project-specific rules.

### Agent instructions

- Offer a root `AGENTS.md` as an opt-in for projects that want to document their development workflow and commit policy.
- Generate a short `AGENTS.md` with the project layout, package-specific working directories where applicable, and commands for setup, linting, formatting, builds, and tests. Include only commands available in the target project. Identify generated files and where to change their inputs when applicable.
- Document when to commit, which files to stage, and how to write the subject. Offer a commit-after-verification instruction as an explicit project choice, as Configra uses for its own repository. Recommend staging only the task's changes. For plain subjects, recommend a sentence-case imperative without a prefix, such as `Add agent guidance to the refactor plan`. For Conventional Commits, give an example such as `docs: add agent guidance`. With validation off, omit any generated commit-message format rule.
- Derive commands, package paths, and commit-message guidance from the same resolved settings used to generate scripts and hooks. Keep project-specific coding guidance short, including the target package's JavaScript module conventions where applicable.
- Include `AGENTS.md` in the normal preview. Preserve an existing unowned file and show any differing proposed guidance for manual adoption. Apply the existing ownership and conflict rules to files Configra generated.

## Milestones and verification

1. **General nested projects and npm workspaces.** Exercise a mixed nested project and a mixed npm workspace. Verify inheritance, per-package overrides, explicit selection and replay, duplicate workspace names, one aggregate visit per selected package, and staged routing.
2. **Additional presets and integrations.** Implement the remaining scope and verify it with consumer fixtures.
   - Exercise Pint and Larastan, Next.js flat config, Django checks and optional mypy, Tauri and Wails routing, and both Python install workflows. Verify Go and Rust formatting and analysis, Vue and SCSS coverage, and generated CI using the same checks as local scripts.
   - Exercise both WordPress builders, including both upstream Webpack config shapes. Build Vite and `wp-scripts` in both orders in a mixed fixture and verify that both builders keep their assets and metadata.
   - Check SQL dialect selection, project spelling vocabulary, TOML formatting, shell, Dockerfile, PowerShell, and GitHub Actions linting. Verify that opt-ins preserve existing TypeScript configs, Git attributes, VS Code JSONC settings, and agent guidance. Exercise each generated agent commit policy against the hook configuration.
