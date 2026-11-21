# Rebuild Configra as a public npm CLI

## Launch features

Publish `@cassidydc/configra` for developers who want to set up linting, formatting, and Git hooks in new or existing projects. Configra generates editable files and declares the required development dependencies. The generated checks run independently of Configra.

| Feature            | First release                                                                                                                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project presets    | Node.js, PHP, Python, and WordPress sites, plugins, and themes. Offer React and TypeScript as selectable capabilities and community or WordPress standards where applicable.                                                                        |
| Tooling            | EditorConfig, Prettier, Markdownlint, and `.gitignore` as the baseline. Add ESLint for JavaScript and TypeScript, Stylelint for CSS, and PHP Parallel Lint, PHP_CodeSniffer, and PHPStan for PHP. Offer VS Code and Webpack as independent options. |
| Repository layouts | Standalone projects, explicitly selected nested packages, and existing npm workspaces. Discovery suggests packages for the user to select.                                                                                                          |
| Git hooks          | Lefthook runs checks on staged paths. The `commit-msg` hook defaults to plain sentence-case subjects and offers Conventional Commits or validation off. Release automation stays outside launch scope.                                              |
| Installation       | npm for JavaScript tooling and Composer for PHP tooling. The interactive flow previews file changes, dependency installation, and hook activation for approval. Scripts opt into installation and activation separately.                            |

The Python preset will generate linting and formatting configuration. Choose the Python tools, config file, and dependency installation workflow before implementing the preset.

### Optional language and Git configuration

- **SCSS.** Format SCSS with Prettier. Offer SCSS linting as a separate opt-in that adds the necessary Stylelint configuration and dependencies for `.scss` files.
- **TypeScript.** Offer an opt-in `typecheck` script that runs `tsc --noEmit` using the project's `tsconfig.json`. Offer to generate a starter `tsconfig.json` when the project lacks one. Use the existing config when present.
- **Git line endings.** Offer a root `.gitattributes` file as an opt-in. Show the proposed line-ending rules in the preview and preserve unrelated attributes already present in the file.

## CLI and safe updates

- Keep `configra init`, `configra update`, and `configra discover`, plus `--help` and `--version`. Support `--cwd`, `--config`, and selection flags for project type, layout, packages, languages, capabilities, standards, and tools. Use `--commit-messages plain|conventional|off`, `--install`, and `--install-hooks`. `--dry-run --json` emits a versioned plan containing changes, conflicts, diagnostics, and proposed commands without writing files or running installers. The CLI and documented JSON are the public interfaces.
- Resolve selections and package ownership, render a plan without writes, then preflight and apply it. Keep dependencies and local scripts in their owning package. Delegate to each selected child once, and generate one hook configuration at the Git root. Allow generating hook configuration before Git initialization, but require an existing Git root for activation. Run target npm installs with lifecycle scripts disabled so Lefthook’s postinstall cannot activate hooks before approval. Activate hooks explicitly without replacing other hook managers or custom hook paths. [Lefthook installation behavior](https://lefthook.dev/usage/commands/install/)
- Store choices in `.configra.json` and ownership in `.configra-state.json`, both at schema version `2`. Reject legacy metadata with fresh-setup instructions. Preserve unrelated manifest entries and leave matching pre-existing content unowned. Update or remove unchanged owned content automatically. Require an explicit interactive decision for each conflict, and stop before writes on unresolved conflicts in noninteractive runs.
- Recheck file snapshots and Git boundaries before applying, preserve file permissions, and write ownership state last. Report file, installation, and hook failures separately. Keep successfully generated files after an install failure so users can retry without recreating them.

## Filesystem structure

```text
src/
  cli/
    index.ts                 # Executable, arguments, and output
    commands/                # init, update, discover
    prompts/                 # Selections, preview approval, conflicts
  generator/
    resolve.ts               # Presets, capabilities, and explicit choices
    plan.ts                  # Proposed files, dependencies, and conflicts
    apply.ts                 # Preflight, writes, installation, activation
    layouts/                 # Standalone, nested, npm workspaces
    state/                   # Selection and ownership schemas
  components/
    registry.ts              # Explicit list of supported integrations
    projects/                # Node.js, PHP, Python, and WordPress presets
    capabilities/            # React and TypeScript
    standards/               # Language-specific coding standards
    tools/
      eslint/
        index.ts             # Tool metadata and renderer
        templates/           # Only where the tool needs static assets
      prettier/
      lefthook/
      commitlint/
      …                       # One folder per remaining tool
  platform/                  # Filesystem, Git, subprocess, npm, Composer
tests/
  unit/
  integration/
  fixtures/
examples/                    # Representative selections and generated output
docs/                        # User guide and tool authoring guide
dist/                        # Compiled ESM and runtime templates for npm
```

Use strict TypeScript and retain Node.js 24 as the minimum. Build one ESM package, point the npm `configra` executable at `dist/cli/index.js`, and copy templates beside their compiled integrations so they work from an installed tarball. Pack runtime files, README, changelog, and license. Set `publishConfig.access` to `public`. [npm package metadata](https://docs.npmjs.com/cli/configuring-npm/package-json/)

## Implementation and release checks

1. Build the CLI, planner, and safe-update flow around a standalone Node.js project. Verify dry runs, idempotent reruns, legacy metadata rejection, conflict handling, and protection of user edits and nested Git repositories.
2. Add PHP, Python, WordPress, nested packages, npm workspaces, and the remaining tools. Verify clean npm and Composer installs, dependency removal and retry, generated checks for each preset, and the React/TypeScript ESLint combination. Test the Python setup in a standalone project. Check that SCSS linting, TypeScript type checking, starter configuration, and Git attributes follow their opt-in selections, including preservation of existing `tsconfig.json` and unrelated Git attributes. Use real test repositories to verify that installation leaves hooks inactive, activation works, staged checks run, and both commit-message presets accept and reject representative messages.
3. Run `npm pack`, install the tarball into a clean consumer, and test the CLI and packaged templates. Verify the packed CLI on Linux, macOS, and Windows. Update `README.md` and `CHANGELOG.md`, and commit each completed implementation task using the repository’s existing commit style. Check the registry before choosing the release version, and publish the verified artifact under the existing scope. [Publishing a public scoped npm package](https://docs.npmjs.com/creating-and-publishing-an-organization-scoped-package/)
