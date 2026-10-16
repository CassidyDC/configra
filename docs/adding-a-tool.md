# Adding a tool

Create `src/components/tools/<id>/definition.js` and `render.js`. Add a `templates/`
directory only when needed. Register both exports explicitly in
`src/components/registry.js`; update the relevant project defaults or capability
definitions if the tool should be selected automatically.

## Definition

Export metadata containing a stable `id`, supported `languages` and `capabilities`,
package `requirements`, script `operations`, and configuration `scope` (`package`
or `git`). An empty languages list means the tool is language independent.
Definitions contain no installation or project filesystem effects.

## Rendering

Export a renderer accepting resolved package settings and returning any of these
structured contributions:

| Field              | Contribution                                                                  |
| ------------------ | ----------------------------------------------------------------------------- |
| `files`            | Relative paths mapped to complete configuration strings                       |
| `jsonFiles`        | Relative JSON paths mapped to managed objects; unrelated leaves are preserved |
| `lines`            | Relative ignore-file paths mapped to additive line arrays                     |
| `scripts`          | npm script names mapped to commands                                           |
| `npm`              | npm development dependency names mapped to version ranges                     |
| `composer`         | Composer development dependency names mapped to version ranges                |
| `composerSettings` | Additional managed Composer settings                                          |
| `hooks`            | Staged check requirements with `id`, `glob` array, and `run` command          |

The renderer receives language-specific standards and formatting,
capabilities, package ownership, and local exclusions. Apply those exclusions to
all recursive checks. Keep tool-native options in standards or the renderer;
there is no universal rule language.

Use explicit `.mjs` or `.cjs` extensions for JavaScript configurations so generated
files work with both consumer module types. Read templates through
`new URL("./templates/file", import.meta.url)` rather than the current directory.
Renderers may read their own packaged templates; they must never read or write
consumer project files, invoke package managers, or serialize root hooks.

The planner combines hook contributions and sends them to Lefthook. The layout
strategy owns local versus aggregate scripts and dependency placement. Platform
adapters execute the generator's installation requirements only with `--install`.

## Verification

Add unit cases for meaningful standard and capability differences. Add integration
coverage when the tool changes CLI behavior, merging, package ownership, or
installation requirements. Include a packed-artifact case for new templates.

```sh
npm test
npm run lint:scripts
npm run lint:docs
npm run check
```

Document the integration and any unsupported combinations in the README,
generated-project reference, and changelog. Commit the completed increment using
the existing commit message style.
