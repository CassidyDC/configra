<!--
Toolset Architecture

Overview of the generation pipeline, internal contracts, and package ownership.
-->

# Architecture

The toolset turns selections into editable, self-contained project files. Its
internal JavaScript interfaces are documented with JSDoc in `src/contracts.js`;
they are not a public package API.

## Pipeline

1. `bin/cdctool.js` starts `src/cli/index.js` and sets the exit code.
2. The CLI parses flags or collects structured interactive selections. Prompt
   modules are loaded only for interactive runs.
3. `package-graph.js` discovers candidate manifests and WordPress package paths.
   Explicit selections establish package ownership and parent relationships.
   Workspace registration and Git boundaries are tracked independently.
4. `resolve.js` combines registered project definitions, capabilities, standards,
   inherited settings, and explicit overrides. Unsupported combinations fail
   before rendering.
5. `plan.js` invokes pure tool renderers, applies a layout strategy, reads existing
   state through platform adapters, and returns changes, conflicts, diagnostics,
   snapshots, and optional installation operations. It never writes project files.
6. The CLI presents the proposal. Dry runs stop here.
7. `apply.js` validates conflicts and every captured file snapshot before writing.
   It records state after successful file generation and optionally installs
   declared dependencies. Installation failures remain distinct from file writes.

## Components and dependency direction

`src/components/registry.js` explicitly registers supported projects, capabilities,
standards, and tools. Components do not discover or install themselves.

- Projects describe environment defaults. WordPress projects support both
  WordPress and community standards, independently of layout.
- Capabilities add React and TypeScript support without selecting a bundler.
- Standards describe language-specific tool settings and formatting baselines.
- Tools own their configurations, scripts, dependency declarations, and hook
  requirements. Only Lefthook serializes the combined root hook configuration.

The CLI depends on the generator. The generator depends on components, layouts,
and platform adapters. Components never import CLI workflows or perform project
writes. Templates are located relative to the installed module. Prettier is the
runtime formatting dependency used to render output consistently with generated settings.

The community baselines are ESLint recommended for JavaScript, Stylelint standard
for CSS, and PSR-12 for PHP. These names describe the chosen baselines rather than
a universal community convention.

## Ownership and layouts

Every selected package owns its configuration and dependency declarations.
`single` runs local checks. `nested` delegates through relative package paths and
installs dependencies independently. `workspaces` delegates using exact registered
workspace package names and installs dependencies from the registration root.
Existing workspace declarations are preserved. Exact name selectors prevent npm
from including nested workspaces a second time.

`lint:local` runs one package's checks. Aggregate `lint` commands delegate once to
each selected package. Local configurations exclude selected child directories,
independent nested Git repositories, and generated analysis caches.
Staged checks use Git-relative globs, a package working directory, and child
exclusions. Generation below an enclosing Git root skips hook management because
the root hook configuration is outside the selected boundary. Hook installation
is a separate, explicit `npm run hooks:install` operation.

## State and safe application

`.cassidydc-toolset.json` stores versioned selections.
`.cassidydc-toolset-state.json` separately tracks generated-file hashes, managed
JSON entries, and owned ignore lines. Updates preserve unrelated JSON keys,
scripts, dependency entries, ignore lines, and VS Code extension recommendations.
Competing active configuration files are reported as conflicts rather than leaving
two configurations with ambiguous precedence. Conflicts stop all writes unless
explicitly resolved interactively or with `--force`.

Unchanged output is not rewritten. Removed tools relinquish their unchanged
managed files and entries. A changed generated file or managed entry requires a
conflict decision. Symbolic-link targets and paths outside the project are
rejected. File writes use temporary files and rename; a failure partway through a
multi-file operation reports the completed paths rather than claiming a rollback.
Generation state is written last. This is not a multi-file filesystem transaction.

`--install` runs npm and Composer only after successful file generation. Their
lockfiles and normal lifecycle behavior belong to those package managers. No
external installations run during automated generation tests.
