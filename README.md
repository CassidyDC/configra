<!--
CassidyDC Toolset

CassidyDC Toolset overview, installation, usage, and development guidance.
-->

# CassidyDC Toolset

Generate editable development configuration for Node.js, PHP, Python, and WordPress
sites, plugins, and themes. Requires Node.js 24 or newer. PHP tools additionally
require PHP and Composer when installed or run.

## Installation and usage

```sh
npm install --global @cassidydc/cassidydc-toolset
cdctool init --project wordpress-plugin --dry-run
cdctool init --project wordpress-plugin
npm run lint
```

Generation writes configuration files and dependency declarations. Use `--install`
to install dependencies after generation, or run npm and Composer yourself before
running the generated checks. Webpack is enabled only when explicitly selected.

```sh
cdctool init --project wordpress-theme --capabilities react,typescript
cdctool init --project wordpress-plugin --standard javascript=community --standard php=community
cdctool init --interactive
cdctool discover
cdctool update --dry-run
cdctool update
cdctool --help
```

Selections are saved in `.cassidydc-toolset.json`; generation ownership is tracked
separately in `.cassidydc-toolset-state.json`. Keep both under version control.
Edited generated files and conflicting manifest entries stop application until
resolved. `--force` explicitly replaces the reported conflicting generated content.
Competing configuration filenames are also reported for explicit replacement.
Unrelated manifest fields and scripts are preserved. `--dry-run` never writes files
or installs dependencies; add `--json` for the complete machine-readable plan.

## Package layouts

Use `single` for one package, `nested` for independent child packages, or
`workspaces` for packages already registered in the root npm workspace declaration.
Only explicitly selected children are configured.

```sh
cdctool init --project wordpress-site --layout nested --package plugins/example --package themes/example
cdctool init --project node --layout workspaces --package packages/example
```

Use `--config selections.json` for per-package project, language, capability,
standard, tool, and formatting overrides. `--tools` replaces the default tool list.
Generated `lint:local` scripts check one package; `lint` also delegates to selected
children. Root checks exclude selected child directories.

Python currently provides editor, ignore, Markdown, and VS Code configuration;
Python linting and environment installation are not yet integrated.

## Development and reference

```sh
npm ci
npm test
npm run lint:scripts
npm run lint:docs
npm run check
```

File documentation headers include a descriptive title directly above the `@file`
tag, or above the description in other comment formats.

Component definitions, named functions, and reusable helpers use JSDoc. Shared
internal structures are documented in `src/contracts.js`; imported types use local
aliases declared once per file.

- [Architecture](docs/architecture.md)
- [Adding a tool](docs/adding-a-tool.md)
- [Generated projects and update behavior](docs/generated-projects.md)
- [Architecture plan](docs/plans/architecture-plan.md)
