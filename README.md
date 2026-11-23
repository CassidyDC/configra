# Configra

Configra generates editable linting, formatting, and Git hook configuration for Node.js projects and WordPress sites. The generated checks run on their own, so a project keeps working without Configra installed.

> [!NOTE]
> Configra is being rebuilt and hasn't been published yet. The first release will be `0.1.0`.

## Planned first release

- **Presets:** Node.js projects and WordPress sites, with WordPress or community coding standards, TypeScript, and React.
- **Tools:** EditorConfig, Prettier, markdownlint, ESLint, Stylelint, `php -l`, PHP_CodeSniffer, and PHPStan.
- **Git hooks:** Lefthook runs read-only checks on staged files and validates commit messages.
- **Safe updates:** previews, ownership tracking, and conflict handling, so rerunning Configra never overwrites your changes.
- **Setup wizard:** `configra init` walks through the choices, previews the result, and saves them in `.configra.json`.

Requirements for generated checks: Node.js 24 and npm 11 or later, plus PHP 8.3 and Composer 2.7 or later for WordPress PHP tools.

See [refactor-plan.md](dev/docs/plans/refactor-plan.md) for the full first-release plan and [next-release-plan.md](dev/docs/plans/next-release-plan.md) for what follows.

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
