# Generated projects

## Standalone WordPress plugin

```sh
cdctool init --project wordpress-plugin --dry-run
cdctool init --project wordpress-plugin --install
npm run lint:local
npm run hooks:install
```

The setup includes EditorConfig, gitignore, ESLint, Prettier, Stylelint,
Markdownlint, PHP Parallel Lint, PHPCS, PHPStan, VS Code recommendations, and root
Lefthook configuration when the selected boundary permits it. npm development
dependencies belong to `package.json`; PHP dependencies belong to `composer.json`.
The generated project does not need the toolset installed to run its checks.
Initialize a Git repository before installing hooks when starting outside Git.

JavaScript configurations use explicit module extensions. PHP checks run through
`vendor/bin` and use Composer-installed dependencies. Webpack is optional, expects
a `src/index.js` entry (or `.jsx`, `.ts`, `.tsx` for capabilities), and writes to
`dist/`; it does not create application source files or install React itself.

## Standards and formatting

```sh
cdctool init --project wordpress-plugin --standard javascript=community --standard php=community
```

The project environment stays WordPress while the specified languages use
community standards. CSS retains its WordPress default. The resolver derives
EditorConfig and formatter options from language-specific formatting choices.
Explicit formatting overrides must remain compatible with supported standards;
PSR-12 and Python community indentation require four spaces.

## Nested packages and overrides

Create `selections.json` in a WordPress `wp-content` project:

```json
{
  "version": 1,
  "project": "wordpress-site",
  "layout": "nested",
  "standards": { "javascript": "community" },
  "packages": [
    {
      "path": "plugins/example",
      "project": "wordpress-plugin",
      "standards": { "php": "community" }
    },
    {
      "path": "themes/example",
      "project": "wordpress-theme",
      "capabilities": ["react", "typescript"]
    }
  ]
}
```

```sh
cdctool init --config selections.json --dry-run
cdctool init --config selections.json --install
npm run lint
npm --prefix plugins/example run lint:local
```

Selected child directories must already exist. Discovery suggests candidates;
it never selects them automatically. Children inherit their nearest selected
parent's standards, applicable tools, capabilities, and explicit formatting
overrides. A different child project supplies its own default languages; child
language selections filter inherited tools and standards. Child `tools` and
`capabilities` arrays replace inherited arrays. Per-language standard overrides
merge with inherited standards. A plugin or theme definition is identical across
all layouts.

Root checks exclude selected children. A nested package's `lint` checks itself
and delegates to its selected children using package-relative paths. A package's
`lint:local` performs only its own selected checks. npm and Composer operations
remain scoped to the package declaring the dependencies. Generated delegation
commands use POSIX shell quoting for package paths.

## Registered npm workspaces

Given a root `package.json` containing `"workspaces": ["packages/*"]` and existing
workspace manifests:

```sh
cdctool init --project node --layout workspaces --package packages/a --package packages/b
```

The toolset preserves workspace declarations and requires every selected workspace
to be registered. The root aggregate invokes each selected workspace's
`lint:local` once. The root's local configurations exclude selected packages.
Dependency declarations stay in the owning package; npm installation operations
run from the workspace root using `--workspace=<path>`.

## Updates, conflicts, and failure results

Keep both toolset JSON files in version control. Edit saved selections or pass
selection flags to `update`:

```sh
cdctool update --dry-run --json
cdctool update --standard javascript=community
```

Unchanged generated content can be replaced automatically. Manually edited files,
modified managed manifest entries, and competing entries require resolution.
Unrelated scripts, manifest keys, dependencies, VS Code settings, extension
recommendations, and gitignore entries are preserved. Existing JSON files must be
valid JSON objects; comments in VS Code JSON files must be resolved before merging.

Resolve conflicts by reconciling the displayed entries, or use `--force` to replace
the reported generated content. A conflict or failed preflight causes no writes.
Dry runs never write or install, even with `--install`. Removing a tool removes its
unchanged owned content; edited content still requires a conflict decision.

A write failure reports partial progress and does not save successful generation
state prematurely. An installation failure returns a failing exit code while
retaining the successfully generated files and state. Re-run npm or Composer in
the affected package, or retry `update --install`.

Exit codes are `0` for success, `1` for invalid selections, unresolved application
conflicts, write failures, or installation failures, and `2` for a dry-run proposal
containing conflicts.

## Integration baselines

Tool package ranges are declared by their renderers. Generated configurations
follow the upstream [WordPress ESLint flat-config interface](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-eslint-plugin/),
[typescript-eslint flat configuration](https://typescript-eslint.io/getting-started/),
and [Lefthook Git-relative globs and package roots](https://lefthook.dev/configuration/root/).
Community PHP uses [PSR-12](https://www.php-fig.org/psr/psr-12/).
