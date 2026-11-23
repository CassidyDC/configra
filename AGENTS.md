# Agent Instructions

## Project context

- Configra is being rebuilt from scratch as a TypeScript CLI published to npm as `@cassidydc/configra`.
- [refactor-plan.md](dev/docs/plans/refactor-plan.md) is the source of truth for the first release. Work through its implementation milestones in order and keep the plan current when a decision changes.
- [next-release-plan.md](dev/docs/plans/next-release-plan.md) holds the presets, layouts, and integrations deferred from the first release. Don't implement them before the first release unless the plan changes.
- `dev/docs/references/previous-code/` is the archived implementation. Read it for reference and port useful fixtures, samples, and the findings in `dev/docs/references/previous-code/docs/issues.md`, but don't edit, lint, test, or import from it.

## Commands

```sh
npm ci                # Install dependencies
npm run lint          # ESLint and markdownlint
npm run lint:fix      # Apply ESLint and markdownlint fixes
npm run format:check  # Check formatting with Prettier
npm run format        # Apply Prettier formatting
npm run hooks:install # Activate the Lefthook Git hooks
npm run typecheck     # Type-check source, tests, and scripts with tsc
npm test              # Run the offline unit and integration tests with Vitest
npm run test:smoke    # Build, pack, install into a clean consumer, and run the installed CLI
npm run test:consumer # Install each generated JavaScript setup from the registry and run its checks
npm run build         # Compile src/ to dist/ and copy runtime assets
```

Run `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm test` before committing. Run `npm run test:smoke` when a change affects the build, the packed files, or the CLI entry point. Run `npm run test:consumer` when a preset, tool renderer, or dependency set changes.

## Code conventions

- Write source in strict TypeScript as ECMAScript modules (ESM). Use `.ts` for source and tests. Use `.js` for JavaScript configuration files, `.mjs` when a file must declare ESM explicitly, and `.cjs` only for tools that require CommonJS.
- Follow the stack in the plan: Node's `parseArgs`, `@clack/prompts`, TypeBox, Vitest, `tsc`, and `cross-spawn`. Add a runtime dependency only when the code that needs it lands.

## Repository tooling

- Configra manages this repository's EditorConfig, Prettier, markdownlint, ESLint, and Lefthook setup. Don't edit `.configra/`, `.editorconfig`, or `lefthook.yml` by hand.
- Change shared settings, such as the line width and exclusions, in `.configra/config.json`, then run `npm run build` and `node dist/cli/index.js update`. Put repository-specific rules in `eslint.config.js`, `prettier.config.js`, `.markdownlint-cli2.mjs`, and `lefthook-project.yml`.

## Commits

- Finish each task or feature by committing its completed changes. Stage only the files that belong to the task.
- Write a plain, sentence-case imperative subject without a prefix, such as `Add the command option table`. Keep the subject within 72 characters.
- When relevant, document completed tasks or features in `CHANGELOG.md` and `README.md`.

## Code spacing rules

- Put a blank line before each JSDoc block, except at the start of a file.
- Separate a control-flow statement from the preceding statement at the same level with a blank line. This includes `if`, loops, `switch`, `try`, `return`, `throw`, `break`, and `continue`. Do not pad the start of a block or detach `else`, `catch`, `finally`, or `do...while` continuations.
- Put a blank line after a completed block, control-flow statement, or multiline expression statement when another statement follows at the same level. Keep function-call arguments and chained expressions together.
- Put a blank line after a standalone `let`, `const`, or `var` when the next statement is not another variable declaration. Keep consecutive variable declarations together; do not pad before closing syntax or inside loop headers.
- Put a blank line after every export declaration, including `export const`, before any following code or comment.
- Separate a `const` declaration spanning more than three source lines from neighboring statements with blank lines, including adjacent variable declarations.

Exceptions to these spacing rules:

- Keep a `const` and the single-line statement that immediately precedes its block's closing syntax together, even when the `const` spans multiple lines. Retain any required blank line before the `const`.
- If every statement directly inside a code block fits on one source line, omit blank lines between them. Apply this separately to nested blocks. Keep comments attached to their code and preserve spacing before JSDoc blocks.
