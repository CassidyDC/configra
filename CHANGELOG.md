# Changelog for CassidyDC Toolset

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [UNRELEASED]

### Added

- Add a registry-driven configuration sample catalog and `npm run samples:generate` to regenerate it.

- Explain how components combine into generated tool configuration in `docs/how-it-works.md`.

- Document prioritized repository review findings and proposed fixes in `docs/issues.md`.

- Document component definitions, named functions, and shared internal contracts with JSDoc types.

- Implement configurable project generation with explicit project, language, capability, standard, and tool selections.
- Add standalone, nested-package, and registered npm workspace layouts with package-scoped checks and root hook ownership.
- Add dry-run previews, saved selections, safe updates, conflict detection, and optional npm and Composer installation.
- Add automated CLI, generation, safety, layout, and packed-artifact validation.

### Changed

- Add descriptive titles to file documentation headers throughout the repository.

- Declare imported JSDoc types once per file with local aliases for readable annotations.

- Move the `cdctool` executable to `bin/cdctool.js` and package the component-based implementation and templates.

### Fixed

- Keep nested workspace checks from running twice by delegating with exact package names.
- Format generated files consistently with their selected standards and exclude Git boundaries and analysis caches from recursive checks.
- Detect competing active configurations and preserve structured installation failure results in JSON output.

### Removed

- Remove Python project and language options until Python support is ready.
