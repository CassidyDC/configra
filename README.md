# Configra

Configra generates editable linting, formatting, and Git hook configuration for Node.js projects and WordPress sites. The generated checks run on their own, so a project keeps working without Configra installed.

> [!NOTE]
> Configra is being rebuilt and hasn't been published yet. The first release will be `0.1.0`.

## Planned first release

- **Presets:** Node.js projects and WordPress sites, with WordPress or community coding standards, TypeScript, and React.
- **Tools:** EditorConfig, Prettier, markdownlint, ESLint, Stylelint, `php -l`, PHP_CodeSniffer, and PHPStan.
- **Git hooks:** Lefthook runs read-only checks on staged files and validates commit messages.
- **Safe updates:** previews, ownership tracking, and conflict handling, so rerunning Configra never overwrites your changes.
- **Setup wizard:** `configra init` walks through the choices, previews the result, and saves them in `.configra/config.json`.

Requirements for generated checks: Node.js 24.15 and npm 11 or later, plus PHP and Composer 2.7 or later for WordPress PHP tools.

The current build plans, previews, and writes a Node.js setup with `configra init`. Preview without writing with `--dry-run`, as text or with `--json`. In a terminal, pass `--yes` to approve the preview until the approval prompt arrives. Dependency installation and hook activation arrive in a later milestone. The [examples](examples/) show the generated files and JSON plan for representative selections.

See [refactor-plan.md](dev/docs/plans/refactor-plan.md) for the full first-release plan and [next-release-plan.md](dev/docs/plans/next-release-plan.md) for what follows.

## Known issues

### npm peer warnings with the WordPress ESLint setup

The WordPress JavaScript standard uses ESLint 10 with [`@wordpress/eslint-plugin`](https://www.npmjs.com/package/@wordpress/eslint-plugin). ESLint 9 reached [end of life](https://eslint.org/version-support/) on 2026-08-06. The plugin supports ESLint 10, but its `recommended` config bundles three plugins whose published peer ranges still stop at ESLint 9:

| Bundled plugin                                                                          | Used for                                                        | Upstream ESLint 10 work                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`eslint-plugin-react`](https://github.com/jsx-eslint/eslint-plugin-react) 7.37.5       | React rules such as `react/jsx-key`                             | Issue [#3977](https://github.com/jsx-eslint/eslint-plugin-react/issues/3977), pull request [#4022](https://github.com/jsx-eslint/eslint-plugin-react/pull/4022)                                                                                    |
| [`eslint-plugin-import`](https://github.com/import-js/eslint-plugin-import) 2.32.0      | Import checks such as `import/no-unresolved` and `import/named` | Support merged in [#3230](https://github.com/import-js/eslint-plugin-import/pull/3230), waiting for a release ([#3278](https://github.com/import-js/eslint-plugin-import/issues/3278))                                                             |
| [`eslint-plugin-jsx-a11y`](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y) 6.10.2 | Accessibility rules such as `jsx-a11y/alt-text`                 | Issue [#1075](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/issues/1075), pull requests [#1081](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/pull/1081) and [#1079](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/pull/1079) |

The `recommended` config loads all three for every WordPress setup, with or without React. As a result:

- `npm install` succeeds but prints `npm warn ERESOLVE overriding peer dependency`.
- `npm ls` reports `eslint@10 invalid` for those three plugins.

The warnings don't affect linting. The WordPress plugin wraps the React and import plugins in a compatibility layer, the accessibility plugin uses no removed ESLint APIs, and the React rule with a known ESLint 10 crash ([#3970](https://github.com/jsx-eslint/eslint-plugin-react/issues/3970)) is turned off. ESLint 10 and ESLint 9 report the same problems on the same files. Configra doesn't add npm `overrides` to hide the warnings. They will go away once the three plugins publish ESLint 10 support and `@wordpress/eslint-plugin` picks up those releases.

### Stylelint 17 for WordPress CSS

The WordPress CSS standard uses Stylelint 17, while the community CSS standard uses Stylelint 18. The latest [`@wordpress/stylelint-config`](https://www.npmjs.com/package/@wordpress/stylelint-config), 27.2.0, requires Stylelint 17, and npm refuses to install it with Stylelint 18. Configra moves WordPress CSS to Stylelint 18 once a release supports it, which [Gutenberg PR #87149](https://github.com/WordPress/gutenberg/pull/87149) is working toward.

## Development

```sh
npm ci
npm run lint
npm run format:check
npm run hooks:install
```

See [AGENTS.md](AGENTS.md) for the commit policy and code conventions.

## License

[MIT](LICENSE)
