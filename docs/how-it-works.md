<!--
How Configuration Generation Works

Explanation of how components combine into generated tool configuration files.
-->

# How configuration generation works

The modules in `src/components/` describe project defaults, optional language
features, coding standards, and individual development tools. The generator
combines those descriptions into effective settings for each selected package,
asks the selected tools to render their output, and builds a proposal for writing
the resulting configuration files.

For example, selecting a WordPress plugin provides JavaScript, CSS, and PHP
defaults. Choosing the community PHP standard changes the PHPCS ruleset, while
adding React changes the JavaScript configuration. Both choices flow through the
same generation process.

## The component families

| Location                       | Responsibility                                                                          | Example                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/components/registry.js`   | Registers the available components under stable identifiers.                            | Maps `phpcs` to its metadata and renderer.                                       |
| `src/components/projects/`     | Supplies default languages, tools, environment, and source path hints.                  | `wordpress/plugin.js` defines `wordpress-plugin`.                                |
| `src/components/capabilities/` | Describes optional features within a language.                                          | React and TypeScript require JavaScript and can add ESLint to the default tools. |
| `src/components/standards/`    | Supplies a language's formatting defaults and tool settings.                            | PHP community uses four spaces and the `PSR12` PHPCS ruleset.                    |
| `src/components/tools/`        | Translates effective package settings into tool configuration and related requirements. | PHPCS contributes XML, Composer dependencies, an npm script, and a staged check. |

The registry imports each component explicitly. Adding a file under a component
directory does not make it available automatically. For tools, the registry joins
the default export from `definition.js` with the function from `render.js`:

```js
export const tools = {
  phpcs: { ...phpcs, render: renderPhpcs },
  // Other registered tools...
};
```

The shared internal types, including `ProjectDefinition`, `StandardDefinition`,
`PackageContext`, and `ToolContribution`, are documented in
[`src/contracts.js`](../src/contracts.js).

## From selections to effective package settings

[`src/cli/commands/generate.js`](../src/cli/commands/generate.js) coordinates the
workflow:

```text
CLI flags, prompts, or JSON selections
    -> normalizeRequest()
    -> packageGraph()
    -> resolve()
    -> plan()
    -> apply() unless --dry-run
```

`normalizeRequest()` supplies request defaults and normalizes selected child
paths. `packageGraph()` identifies the selected packages, their parent and child
relationships, npm workspace information, and Git boundaries. Discovery can find
candidate packages, but only explicitly selected children enter generation.

[`src/generator/resolve.js`](../src/generator/resolve.js) then combines the
registered components for each package:

1. **Project:** Look up the requested project and use its language defaults unless
   the user supplied a language list. Current project identifiers are `node`,
   `php`, `wordpress-site`, `wordpress-plugin`, and `wordpress-theme`. The supported
   language identifiers are `javascript`, `css`, and `php`.
2. **Capabilities:** Validate optional capabilities against the selected languages.
   React and TypeScript both require JavaScript. Their identifiers remain
   capabilities in the resolved settings; they do not become separate languages.
3. **Standards:** Choose one standard per language. WordPress projects default to
   `wordpress`; other environments default to `community`. Explicit per-language
   selections override those defaults.
4. **Tools:** Filter project defaults to tools compatible with the selected
   languages. A tool with an empty `languages` list is language independent. If
   the user supplied no explicit tool list, also add the capabilities' default
   tools. An explicit `tools` list replaces these defaults, including capability
   additions; an empty list disables all tools.
5. **Formatting:** Build shared formatting from fallback values, the JavaScript
   standard when JavaScript is selected (otherwise the first selected language's
   standard), and explicit overrides. Build `languageFormatting` by applying each
   language's own standard over that shared formatting, followed by explicit
   overrides. Validate that the result satisfies supported conventions, including
   PHP indentation and LF line endings.

The result contains full standard definitions, selected tool and capability
identifiers, shared and language-specific formatting, source path hints, and
package ownership information. Project paths are hints available to renderers;
individual renderers decide their actual check paths and entry points.

A standard can affect tools without changing the project environment. For example,
a WordPress plugin using community PHP standards gets PSR-12 style checks from
PHPCS, while PHPStan still adds WordPress integration because it checks the
environment. Standards do not select tools automatically.

For child packages, resolution starts from the nearest selected parent. Explicit
formatting overrides and applicable standards merge with child overrides. Child
tool and capability lists replace inherited lists. When no explicit tool list is
inherited or supplied, the child's project provides its default tools. Selecting a
different child project also supplies that project's default languages unless the
child specifies its own.

## What a tool definition and renderer do

Each tool normally has two modules:

- **`definition.js`** describes its identifier, supported languages and
  capabilities, script operations, dependency requirements, ownership scope, and
  competing configuration filenames. The resolver uses language metadata to
  filter and validate tool selections. The planner uses `alternatives` to detect
  existing configurations that would compete with generated output.
- **`render.js`** receives the resolved package settings and returns a
  `ToolContribution`. It translates the environment, standards, capabilities,
  formatting, and exclusions into the tool's native configuration format. Its
  returned scripts and dependency ranges supply the actual generated manifest
  entries; the metadata's operation and requirement lists describe the
  integration.

Before calling renderers, the planner uses a layout module to extend each resolved
package into a `PackageContext`. This adds exclusions for dependencies, build
output, analysis caches, selected children, and independent nested Git
repositories, plus layout and workspace information.

Renderers return any of these contribution fields:

| Field              | What the planner does with it                                               |
| ------------------ | --------------------------------------------------------------------------- |
| `files`            | Proposes complete configuration file contents, such as `eslint.config.mjs`. |
| `jsonFiles`        | Merges managed JSON properties into files such as `.vscode/settings.json`.  |
| `lines`            | Adds owned lines to files such as `.gitignore`.                             |
| `scripts`          | Adds managed npm script entries to `package.json`.                          |
| `npm`              | Adds npm development dependencies to `package.json`.                        |
| `composer`         | Adds Composer development dependencies to `composer.json`.                  |
| `composerSettings` | Adds other managed Composer properties, such as plugin permissions.         |
| `hooks`            | Supplies staged check requirements for the combined Lefthook configuration. |

For example,
[`tools/phpcs/render.js`](../src/components/tools/phpcs/render.js) reads
`project.standards.php.settings.ruleset` and returns `phpcs.xml.dist`, Composer
packages, `lint:php:style`, and a PHP staged check. When the ruleset is `WordPress`,
it also adds WordPress Coding Standards and the Composer installer plugin with
the corresponding permission.

Renderers do not write consumer project files or execute package managers. Most
renderers build strings or structured objects directly. Webpack reads its own packaged
template from `tools/webpack/templates/webpack.config.mjs` and substitutes the
entry filename and Babel presets. `tools/shared.js` provides JSON serialization,
XML escaping, JavaScript filename patterns, and staged check helpers.

## Which tool produces which files

This table lists the current renderers' direct outputs. Scripts and dependency
contributions additionally feed the package manifests.

| Tool           | Configuration output                                                  | Main inputs                                                                                      |
| -------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `editorconfig` | `.editorconfig`                                                       | Shared and language-specific formatting.                                                         |
| `gitignore`    | Owned `.gitignore` lines                                              | Selected languages and tools.                                                                    |
| `eslint`       | `eslint.config.mjs`                                                   | JavaScript standard, environment globals, React, TypeScript, Prettier selection, and exclusions. |
| `prettier`     | `prettier.config.cjs`, `.prettierignore`                              | JavaScript standard, shared formatting, language overrides, and exclusions.                      |
| `stylelint`    | `stylelint.config.mjs`                                                | CSS standard's `settings.extends` and exclusions.                                                |
| `markdownlint` | `.markdownlint-cli2.jsonc`                                            | Common Markdown rules and package exclusions.                                                    |
| `parallellint` | No standalone configuration file                                      | PHP syntax-check scripts, Composer dependency, exclusions, and staged check.                     |
| `phpcs`        | `phpcs.xml.dist`                                                      | PHP standard's `settings.ruleset` and exclusions.                                                |
| `phpstan`      | `phpstan.neon.dist`                                                   | Environment, analysis defaults, and exclusions.                                                  |
| `vscode`       | Managed `.vscode/settings.json` and `.vscode/extensions.json` entries | Formatting, selected tools, and languages.                                                       |
| `webpack`      | `webpack.config.mjs`                                                  | Packaged template and React/TypeScript capabilities.                                             |
| `lefthook`     | One root `lefthook.yml`                                               | Staged check contributions collected from all selected packages.                                 |

Tool renderers can also coordinate through the resolved selections. ESLint adds
`eslint-config-prettier` when Prettier is selected, and gitignore adds `dist/` when
Webpack is selected. React and TypeScript influence ESLint and, if explicitly
selected, Webpack. Neither capability selects Webpack automatically.

## Combining contributions into a file proposal

[`src/generator/plan.js`](../src/generator/plan.js) calls each selected tool's
renderer for each package, initially holding Lefthook aside. It combines the
returned contributions and rejects different values for the same entry within a
contribution category, such as conflicting dependency ranges or script commands.
Hook requirements are accumulated into a list.

The planner then performs the remaining composition:

1. Route staged checks to their owning packages, prefix their globs and exclusions
   with package paths, and give their identifiers a package prefix. If Lefthook
   is selected anywhere, pass the combined checks to its renderer once at the
   selected root. Skip hook generation with a diagnostic when the enclosing Git
   root lies outside the selected project boundary.
2. Prefix package-relative output filenames with their owning package paths.
   Pass contributed scripts through the layout strategy to build `lint:local`
   and aggregate `lint` commands. `single` runs local checks, `nested` delegates
   to selected children by relative path, and `workspaces` delegates from the root
   using exact workspace names.
3. Propose package-scoped manifest entries for scripts, npm development
   dependencies, Composer development dependencies, and Composer settings.
   Prepare installation operations without executing them. Workspace npm
   installations run from the workspace root while declarations stay in the
   package that needs them.
4. Compare proposed content with existing files and previous ownership state.
   Preserve unrelated JSON properties and ignore lines, and report conflicts for
   edited managed content or competing configuration files. Unchanged owned
   output that is no longer needed can be removed.
5. When Prettier is selected for the owning package, format supported generated
   JavaScript, JSON, YAML, and Markdown files with its resolved options. This uses
   the shared `tools/prettier/options.js` helper and the toolset's own Prettier
   dependency during planning.

The resulting `GenerationPlan` contains proposed writes and deletions, conflicts,
diagnostics, file snapshots, and optional installation operations. A dry run
reports this proposal and stops before application.

## A WordPress plugin example

Consider this invocation in an existing plugin directory:

```sh
cdctool init --project wordpress-plugin --capabilities react,typescript --standard php=community --dry-run
```

The plugin definition supplies JavaScript, CSS, PHP, and its default tools.
JavaScript and CSS retain WordPress standards; PHP uses community standards.
React and TypeScript add their capabilities to the resolved settings. The
renderers then produce coordinated output:

- ESLint uses the WordPress configuration and TypeScript support, enables JSX,
  and includes Prettier compatibility because Prettier is a default tool.
- PHPCS selects `PSR12` and requires PHP_CodeSniffer without adding the WordPress
  ruleset packages.
- PHPStan includes WordPress integration because the environment remains
  `wordpress`.
- EditorConfig and VS Code use the resolved per-language formatting: WordPress
  JavaScript and CSS use tabs with width four; community PHP uses four spaces.
- Stylelint uses the WordPress CSS configuration. Prettier uses the WordPress
  JavaScript baseline and corresponding language overrides.
- The planner combines scripts and dependencies into `package.json` and
  `composer.json`, and sends staged checks to the root Lefthook renderer when
  the Git boundary permits it.

Webpack is absent from this default tool list. Selecting it explicitly would add
`webpack.config.mjs`, a build script, Babel dependencies, and an expected
`src/index.tsx` entry for this capability combination. It would not create the
application source file or install React itself.

## Writing files and running the generated tools

[`src/generator/apply.js`](../src/generator/apply.js) checks conflicts and captured
file snapshots before applying a plan. It writes the proposed changes and saves
generation state last. Package managers run afterward only with `--install`.

Two files make subsequent updates reproducible:

- `.cassidydc-toolset.json` stores the normalized selections.
- `.cassidydc-toolset-state.json` tracks owned file hashes, JSON entries, and
  ignore lines so later plans can distinguish generated content from user edits.

The generated configurations refer to dependencies declared in the consumer
package's manifests. Once those dependencies are installed, its scripts and tools
run directly; they do not need the toolset present to interpret components at
runtime. An update reruns the same resolution and rendering process against saved
selections and current ownership state.

For implementation details, see [Architecture](architecture.md),
[Adding a tool](adding-a-tool.md), and
[Generated projects and update behavior](generated-projects.md).
